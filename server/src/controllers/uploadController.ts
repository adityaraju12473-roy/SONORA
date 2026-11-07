import { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateCloudinarySignature, uploadStreamToCloudinary } from '../config/cloudinary';
import { uploadToR2 } from '../config/r2';
import { ENV } from '../config/env';
import { dataStore } from '../data/dataStore';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// Persistent local upload directories
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const ARTWORK_DIR = path.join(UPLOADS_DIR, 'artwork');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}
if (!fs.existsSync(ARTWORK_DIR)) {
  fs.mkdirSync(ARTWORK_DIR, { recursive: true });
}

// Multer memory storage (up to 100MB per audio file)
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

/**
 * Returns the exact configuration status of Supabase, Cloudflare R2, and Cloudinary.
 * Never exposes secret credentials to the client.
 */
export const getStorageStatus = async (_req: Request, res: Response) => {
  let mode = 'Local High-Fidelity Audio Storage (Intact SHA-256)';
  if (ENV.hasR2) {
    mode = 'Cloudflare R2 Bucket';
  } else if (ENV.hasCloudinary) {
    mode = 'Cloudinary Audio & Artwork CDN';
  }

  return res.status(200).json({
    supabaseConfigured: ENV.hasSupabase,
    r2Configured: ENV.hasR2,
    cloudinaryConfigured: ENV.hasCloudinary,
    missingCredentials: ENV.getMissingCredentials(),
    storageMode: mode,
  });
};

export const getUploadSignature = async (req: Request, res: Response) => {
  try {
    const { folder = 'sonora/audio', resourceType = 'video' } = req.query;
    
    if (!ENV.hasCloudinary) {
      return res.status(200).json({
        mock: true,
        message: 'Cloudinary not configured in environment. Using direct upload simulation.',
      });
    }

    const signatureData = generateCloudinarySignature(folder as string, resourceType as string);
    return res.status(200).json(signatureData);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to generate upload signature' });
  }
};

/**
 * Handles single file upload from the Curator Studio form
 */
export const handleServerUpload = async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const audioFile = files?.audio ? files.audio[0] : null;
    const coverFile = files?.cover ? files.cover[0] : null;

    let audioUrl = '';
    let audioKey = '';
    let coverUrl = '';
    let coverKey = '';
    let fileHash = '';

    if (audioFile) {
      fileHash = crypto.createHash('sha256').update(audioFile.buffer).digest('hex');

      if (ENV.hasR2) {
        // Upload original MP3 directly to Cloudflare R2 without conversion
        const key = `audio/${fileHash}.mp3`;
        const r2Res = await uploadToR2(audioFile.buffer, key, audioFile.mimetype || 'audio/mpeg', {
          originalName: audioFile.originalname,
          fileHash,
        });
        audioUrl = r2Res.url;
        audioKey = r2Res.key;
      } else {
        // Local high-fidelity storage: preserve original audio bytes exactly
        const filename = `${fileHash}.mp3`;
        const localPath = path.join(AUDIO_DIR, filename);
        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, audioFile.buffer);
        }
        audioUrl = `/api/storage/audio/${filename}`;
        audioKey = `local://${filename}`;
      }
    }

    if (coverFile) {
      const coverHash = crypto.createHash('sha256').update(coverFile.buffer).digest('hex');
      const ext = path.extname(coverFile.originalname) || '.jpg';
      
      if (ENV.hasR2) {
        const key = `artwork/${coverHash}${ext}`;
        const r2Res = await uploadToR2(coverFile.buffer, key, coverFile.mimetype || 'image/jpeg');
        coverUrl = r2Res.url;
        coverKey = r2Res.key;
      } else if (ENV.hasCloudinary) {
        const coverRes = await uploadStreamToCloudinary(coverFile.buffer, {
          folder: 'sonora/artwork',
          resource_type: 'image',
        });
        coverUrl = coverRes.secure_url;
        coverKey = coverRes.public_id;
      } else {
        const filename = `${coverHash}${ext}`;
        const localPath = path.join(ARTWORK_DIR, filename);
        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, coverFile.buffer);
        }
        coverUrl = `/api/storage/artwork/${filename}`;
        coverKey = `local://${filename}`;
      }
    }

    return res.status(200).json({
      success: true,
      storage: ENV.hasR2 ? 'r2' : 'local',
      audio: {
        url: audioUrl,
        publicId: audioKey,
        originalname: audioFile?.originalname,
        fileHash,
      },
      cover: {
        url: coverUrl,
        publicId: coverKey,
        originalname: coverFile?.originalname,
      },
      missingCredentials: ENV.getMissingCredentials(),
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message || 'File upload failed' });
  }
};

/**
 * Handles individual track ingestion within a bulk import batch,
 * performing SHA-256 duplicate verification and automatic collection addition.
 */
export const handleBulkImportTrack = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const audioFile = files?.audio ? files.audio[0] : null;
    const coverFile = files?.cover ? files.cover[0] : null;

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // 1. Calculate SHA-256 hash of the original audio file
    const calculatedHash = crypto.createHash('sha256').update(audioFile.buffer).digest('hex');
    const clientHash = req.body.file_hash as string;

    // Verify hash integrity if provided by client
    if (clientHash && clientHash.toLowerCase() !== calculatedHash.toLowerCase()) {
      return res.status(400).json({ error: 'Checksum mismatch: SHA-256 verification failed' });
    }

    const fileHash = calculatedHash;

    // 2. Duplicate Detection: Check if song with this SHA-256 already exists in database
    const existingSong = await dataStore.getSongByHash(fileHash);
    const collectionName = (req.body.collection_name || 'AISHU').trim();

    if (existingSong) {
      // If collection name is specified, make sure existing song is in the collection
      let playlist = await dataStore.getPlaylistByTitle(collectionName);
      if (!playlist) {
        playlist = await dataStore.createPlaylist({
          userId: req.user?.id || 'admin',
          title: collectionName,
          description: `Imported collection: ${collectionName}`,
          coverUrl: existingSong.cover_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
          isPublic: true,
        });
      }
      await dataStore.addSongToPlaylist(playlist.id, existingSong.id);

      return res.status(200).json({
        success: true,
        skipped: true,
        duplicate: true,
        message: `Duplicate detected: Song "${existingSong.title}" with matching SHA-256 is already imported.`,
        song: existingSong,
        collection: playlist,
      });
    }

    // 3. Save original MP3 file without any conversion or modification
    let audioUrl = '';
    let storageKey = '';
    let storageType: 'r2' | 'cloudinary' | 'local' = 'local';

    if (ENV.hasR2) {
      storageType = 'r2';
      storageKey = `audio/${fileHash}.mp3`;
      const r2Res = await uploadToR2(audioFile.buffer, storageKey, audioFile.mimetype || 'audio/mpeg', {
        originalName: audioFile.originalname,
        fileHash,
      });
      audioUrl = r2Res.url;
    } else if (ENV.hasCloudinary) {
      storageType = 'cloudinary';
      storageKey = `sonora/audio/${fileHash}`;
      const cldRes = await uploadStreamToCloudinary(audioFile.buffer, {
        folder: 'sonora/audio',
        public_id: fileHash,
        resource_type: 'video', // Cloudinary video resource type enables audio streaming & HTTP range requests
      });
      audioUrl = cldRes.secure_url;
      storageKey = cldRes.public_id;
    } else {
      storageType = 'local';
      const filename = `${fileHash}.mp3`;
      const localPath = path.join(AUDIO_DIR, filename);
      if (!fs.existsSync(localPath)) {
        fs.writeFileSync(localPath, audioFile.buffer);
      }
      audioUrl = `/api/storage/audio/${filename}`;
      storageKey = `local://${filename}`;
    }

    // 4. Handle Artwork
    let coverUrl = req.body.cover_url || '';
    if (coverFile) {
      const coverHash = crypto.createHash('sha256').update(coverFile.buffer).digest('hex');
      const ext = path.extname(coverFile.originalname) || '.jpg';
      if (ENV.hasR2) {
        const key = `artwork/${coverHash}${ext}`;
        const r2Res = await uploadToR2(coverFile.buffer, key, coverFile.mimetype || 'image/jpeg');
        coverUrl = r2Res.url;
      } else if (ENV.hasCloudinary) {
        const coverRes = await uploadStreamToCloudinary(coverFile.buffer, {
          folder: 'sonora/artwork',
          public_id: coverHash,
          resource_type: 'image',
        });
        coverUrl = coverRes.secure_url;
      } else {
        const filename = `${coverHash}${ext}`;
        const localPath = path.join(ARTWORK_DIR, filename);
        if (!fs.existsSync(localPath)) {
          fs.writeFileSync(localPath, coverFile.buffer);
        }
        coverUrl = `/api/storage/artwork/${filename}`;
      }
    } else if (!coverUrl) {
      coverUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';
    }

    // 5. Create song record in DataStore / Supabase
    const title = (req.body.title || audioFile.originalname.replace(/\.[^/.]+$/, '')).trim();
    const artistName = (req.body.artist_name || 'AISHU Collection').trim();
    const albumName = req.body.album_name ? req.body.album_name.trim() : null;
    const duration = parseInt(req.body.duration, 10) || 180;
    const genre = req.body.genre || 'Soundtrack';
    const releaseYear = parseInt(req.body.release_year, 10) || new Date().getFullYear();

    const newSong = await dataStore.createSong({
      title,
      artist_name: artistName,
      artist_id: null,
      album_name: albumName,
      album_id: null,
      genre,
      duration,
      release_year: releaseYear,
      cover_url: coverUrl,
      audio_url: audioUrl,
      storage_key: storageKey,
      file_hash: fileHash,
      file_size: audioFile.size,
      cloudinary_public_id: storageKey,
      cloudinary_format: 'mp3',
      is_featured: false,
      is_trending: false,
    });

    // 6. Ensure Collection / Playlist exists and add track to it
    let playlist = await dataStore.getPlaylistByTitle(collectionName);
    if (!playlist) {
      playlist = await dataStore.createPlaylist({
        userId: req.user?.id || 'admin',
        title: collectionName,
        description: `Official music collection: ${collectionName}`,
        coverUrl: coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
        isPublic: true,
      });
    }

    const updatedPlaylist = await dataStore.addSongToPlaylist(playlist.id, newSong.id);

    return res.status(201).json({
      success: true,
      skipped: false,
      storage: storageType,
      song: newSong,
      collection: updatedPlaylist || playlist,
    });
  } catch (error: any) {
    console.error('Bulk Import Track Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to import track' });
  }
};

/**
 * High-performance audio streaming with HTTP Range support (`206 Partial Content`).
 * Guarantees smooth seeking, fast scrubbing, and unbroken playback.
 */
export const streamAudioFile = (req: Request, res: Response) => {
  const { filename } = req.params;
  // Sanitize filename to prevent directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(AUDIO_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
};

/**
 * Serves artwork images with cache control
 */
export const serveArtworkFile = (req: Request, res: Response) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(ARTWORK_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Artwork file not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
};
