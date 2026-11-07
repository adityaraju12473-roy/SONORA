import { Request, Response } from 'express';
import { cloudinary } from '../config/cloudinary';
import { ENV } from '../config/env';
import { dataStore } from '../data/dataStore';
import { Song } from '../types';

interface ParsedCloudinaryTrack {
  asset_id: string;
  public_id: string;
  filename: string;
  title: string;
  artist_name: string;
  album_name: string;
  duration: number;
  format: string;
  bytes: number;
  secure_url: string;
  created_at: string;
  isAlreadyImported: boolean;
  existingSongId?: string;
}

/**
 * Cleanly parse artist and song title from public_id or filename
 */
function parseTrackMetadata(publicId: string, context?: Record<string, any>): { title: string; artist: string; album: string } {
  // If metadata was explicitly stored in Cloudinary context
  if (context?.custom) {
    const c = context.custom;
    if (c.title || c.artist) {
      return {
        title: c.title || publicId.split('/').pop() || 'Unknown Track',
        artist: c.artist || 'Unknown Artist',
        album: c.album || 'Cloudinary Stream',
      };
    }
  }

  // Extract base filename without folder path
  const basename = publicId.split('/').pop() || publicId;
  // Strip extension
  let cleanName = basename.replace(/\.[a-zA-Z0-9]+$/, '');
  // Replace underscores and url-encoded characters
  cleanName = cleanName.replace(/_/g, ' ').replace(/%20/g, ' ').trim();

  // Try splitting by " - " or " – "
  if (cleanName.includes(' - ')) {
    const parts = cleanName.split(' - ');
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim(),
      album: 'Cloudinary Stream',
    };
  }

  if (cleanName.includes(' – ')) {
    const parts = cleanName.split(' – ');
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' – ').trim(),
      album: 'Cloudinary Stream',
    };
  }

  return {
    title: cleanName,
    artist: 'Unknown Artist',
    album: 'Cloudinary Stream',
  };
}

/**
 * GET /api/cloudinary/assets
 * Lists audio assets from Cloudinary using the server-side Admin API.
 * Uses resource_type: 'video' and handles pagination via next_cursor.
 */
export async function getCloudinaryAudioAssets(req: Request, res: Response) {
  try {
    if (!ENV.hasCloudinary) {
      const missing = ENV.getMissingCredentials().cloudinary;
      return res.status(400).json({
        success: false,
        error: 'Cloudinary credentials missing in server/.env',
        missingCredentials: missing,
        instructions: 'Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env.',
      });
    }

    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const maxResults = req.query.max_results ? Math.min(Math.max(parseInt(req.query.max_results as string, 10), 1), 500) : 50;
    const nextCursor = typeof req.query.next_cursor === 'string' ? req.query.next_cursor : undefined;

    // Call Cloudinary Admin API: must use resource_type: 'video' for audio assets
    const result = await cloudinary.api.resources({
      resource_type: 'video',
      type: 'upload',
      prefix: prefix || undefined,
      max_results: maxResults,
      next_cursor: nextCursor,
      context: true,
      tags: true,
    });

    const resources = result.resources || [];
    const parsedTracks: ParsedCloudinaryTrack[] = [];

    for (const r of resources) {
      const { title, artist, album } = parseTrackMetadata(r.public_id, r.context);
      
      // Check duplicate status against existing songs
      const existingByAssetId = r.asset_id ? await dataStore.getSongByCloudinaryAssetId(r.asset_id) : null;
      const existingByPublicId = await dataStore.getSongByCloudinaryPublicId(r.public_id);
      const existing = existingByAssetId || existingByPublicId;

      parsedTracks.push({
        asset_id: r.asset_id || r.public_id,
        public_id: r.public_id,
        filename: r.public_id.split('/').pop() || r.public_id,
        title,
        artist_name: artist,
        album_name: album,
        duration: Math.round(r.duration || 0),
        format: r.format || 'mp3',
        bytes: r.bytes || 0,
        secure_url: r.secure_url,
        created_at: r.created_at,
        isAlreadyImported: Boolean(existing),
        existingSongId: existing?.id,
      });
    }

    return res.json({
      success: true,
      count: parsedTracks.length,
      next_cursor: result.next_cursor || null,
      total_count: result.total_count,
      assets: parsedTracks,
    });
  } catch (error: any) {
    console.error('Error fetching Cloudinary audio assets:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve Cloudinary audio assets',
    });
  }
}

/**
 * POST /api/cloudinary/import
 * Imports specified or fetched Cloudinary audio assets into Supabase songs table.
 * Supports small-batch testing (limit parameter) or full batch import.
 * Detects and skips duplicates using asset_id and public_id.
 * Associates with playlist (e.g. AISHU) if requested.
 */
export async function importCloudinaryAudioAssets(req: Request, res: Response) {
  try {
    if (!ENV.hasCloudinary) {
      const missing = ENV.getMissingCredentials().cloudinary;
      return res.status(400).json({
        success: false,
        error: 'Cloudinary credentials missing in server/.env',
        missingCredentials: missing,
      });
    }

    const {
      assets, // Optional specific array of assets to import
      prefix, // Optional prefix to query directly
      limit, // Optional batch limit for testing (e.g. 5 or 10 tracks)
      collectionName = 'AISHU', // Target collection name
      defaultCoverUrl = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80',
    } = req.body;

    let tracksToProcess: ParsedCloudinaryTrack[] = [];

    // Case 1: Client explicitly sent a list of vetted assets
    if (Array.isArray(assets) && assets.length > 0) {
      tracksToProcess = assets;
      if (limit && limit > 0) {
        tracksToProcess = tracksToProcess.slice(0, limit);
      }
    } else {
      // Case 2: Fetch directly from Cloudinary Admin API
      const maxToFetch = limit && limit > 0 ? Math.min(limit, 100) : 100;
      const apiResult = await cloudinary.api.resources({
        resource_type: 'video',
        type: 'upload',
        prefix: prefix || undefined,
        max_results: maxToFetch,
        context: true,
        tags: true,
      });

      const resources = apiResult.resources || [];
      for (const r of resources) {
        const { title, artist, album } = parseTrackMetadata(r.public_id, r.context);
        const existingByAssetId = r.asset_id ? await dataStore.getSongByCloudinaryAssetId(r.asset_id) : null;
        const existingByPublicId = await dataStore.getSongByCloudinaryPublicId(r.public_id);
        const existing = existingByAssetId || existingByPublicId;

        tracksToProcess.push({
          asset_id: r.asset_id || r.public_id,
          public_id: r.public_id,
          filename: r.public_id.split('/').pop() || r.public_id,
          title,
          artist_name: artist,
          album_name: album,
          duration: Math.round(r.duration || 0),
          format: r.format || 'mp3',
          bytes: r.bytes || 0,
          secure_url: r.secure_url,
          created_at: r.created_at,
          isAlreadyImported: Boolean(existing),
          existingSongId: existing?.id,
        });
      }

      if (limit && limit > 0) {
        tracksToProcess = tracksToProcess.slice(0, limit);
      }
    }

    // Ensure target playlist exists (e.g. AISHU)
    let targetPlaylist = null;
    if (collectionName) {
      targetPlaylist = await dataStore.getPlaylistByTitle(collectionName);
      if (!targetPlaylist) {
        targetPlaylist = await dataStore.createPlaylist({
          title: collectionName,
          description: `Imported Cloudinary Hi-Fi Audio Collection (${collectionName})`,
          isPublic: true,
          coverUrl: defaultCoverUrl,
          userId: 'default-admin-01',
        });
      }
    }

    const importedSongs: Song[] = [];
    const skippedTracks: { asset_id: string; title: string; reason: string }[] = [];
    const failedTracks: { asset_id: string; title: string; error: string }[] = [];

    for (const track of tracksToProcess) {
      try {
        // 1. Check duplicate by asset_id and public_id
        const existingByAsset = track.asset_id ? await dataStore.getSongByCloudinaryAssetId(track.asset_id) : null;
        const existingByPublic = await dataStore.getSongByCloudinaryPublicId(track.public_id);
        const existingSong = existingByAsset || existingByPublic;

        if (existingSong) {
          skippedTracks.push({
            asset_id: track.asset_id,
            title: track.title,
            reason: `Already imported with Song ID: ${existingSong.id}`,
          });
          // Ensure it's in target collection if requested
          if (targetPlaylist) {
            await dataStore.addSongToPlaylist(targetPlaylist.id, existingSong.id);
          }
          continue;
        }

        // 2. Insert into Supabase songs table
        const newSong = await dataStore.createSong({
          title: track.title,
          artist_name: track.artist_name || 'Various Artists',
          album_name: track.album_name || collectionName || 'Cloudinary Stream',
          genre: 'Soundtrack',
          duration: track.duration > 0 ? track.duration : 180,
          release_year: new Date().getFullYear(),
          cover_url: defaultCoverUrl,
          audio_url: track.secure_url, // Direct unmodified Cloudinary HTTPS playback stream
          cloudinary_public_id: track.public_id,
          cloudinary_asset_id: track.asset_id,
          cloudinary_format: track.format,
          file_size: track.bytes,
          storage_key: track.public_id,
          is_featured: false,
          is_trending: false,
        });

        // 3. Associate with target playlist
        if (targetPlaylist && newSong) {
          await dataStore.addSongToPlaylist(targetPlaylist.id, newSong.id);
        }

        importedSongs.push(newSong);
      } catch (err: any) {
        console.error(`Failed to import track ${track.title}:`, err);
        failedTracks.push({
          asset_id: track.asset_id,
          title: track.title,
          error: err.message || 'Database insertion error',
        });
      }
    }

    // Refresh playlist details
    const updatedCollection = targetPlaylist ? await dataStore.getPlaylistById(targetPlaylist.id) : null;

    return res.json({
      success: true,
      summary: {
        totalProcessed: tracksToProcess.length,
        importedCount: importedSongs.length,
        skippedCount: skippedTracks.length,
        failedCount: failedTracks.length,
        collectionName,
        collection: updatedCollection,
      },
      importedSongs,
      skippedTracks,
      failedTracks,
    });
  } catch (error: any) {
    console.error('Error during Cloudinary import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Import operation failed',
    });
  }
}
