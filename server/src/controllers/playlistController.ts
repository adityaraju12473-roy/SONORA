import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { dataStore } from '../data/dataStore';
import { processPlaylistImport } from '../services/playlistImporterService';

export const getPlaylists = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const playlists = await dataStore.getPlaylists(userId);
    return res.status(200).json(playlists);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch playlists' });
  }
};

export const getPlaylistById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const playlist = await dataStore.getPlaylistById(id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    return res.status(200).json(playlist);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch playlist' });
  }
};

export const createPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'usr-admin';
    const { title, description, coverUrl, isPublic } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const newPlaylist = await dataStore.createPlaylist({
      userId,
      title,
      description,
      coverUrl,
      isPublic,
    });
    return res.status(201).json(newPlaylist);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create playlist' });
  }
};

export const updatePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updatePlaylist(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Playlist not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update playlist' });
  }
};

export const deletePlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dataStore.deletePlaylist(id);
    if (!success) return res.status(404).json({ error: 'Playlist not found' });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete playlist' });
  }
};

export const addSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'Song ID is required' });

    const updated = await dataStore.addSongToPlaylist(id, songId);
    if (!updated) return res.status(404).json({ error: 'Playlist or song not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add song to playlist' });
  }
};

export const removeSong = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, songId } = req.params;
    const updated = await dataStore.removeSongFromPlaylist(id, songId);
    if (!updated) return res.status(404).json({ error: 'Playlist or song not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to remove song from playlist' });
  }
};

export const reorderSongs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { songIds } = req.body;
    if (!Array.isArray(songIds)) {
      return res.status(400).json({ error: 'songIds array is required' });
    }
    const updated = await dataStore.reorderPlaylistSongs(id, songIds);
    if (!updated) return res.status(404).json({ error: 'Playlist not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to reorder playlist' });
  }
};

/**
 * Fetch and preview external playlist metadata and catalogue matches
 */
export const fetchImportPlaylistMetadata = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, spotifyClientId, spotifyClientSecret, youtubeApiKey } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Playlist URL is required.' });
    }

    const preview = await processPlaylistImport(url, {
      spotifyClientId,
      spotifyClientSecret,
      youtubeApiKey,
    });

    return res.status(200).json(preview);
  } catch (error: any) {
    console.error('Playlist import fetch error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to fetch playlist metadata.' });
  }
};

/**
 * Create a new SONORA playlist with matched tracks in their original order
 */
export const createImportedPlaylist = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { title, description, coverUrl, songIds, isPublic } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Playlist title is required.' });
    }

    if (!Array.isArray(songIds) || songIds.length === 0) {
      return res.status(400).json({ error: 'At least one matched song ID is required to import.' });
    }

    // 1. Create playlist record
    const newPlaylist = await dataStore.createPlaylist({
      userId,
      title,
      description: description || 'Imported via SONORA Playlist Importer',
      coverUrl,
      isPublic: isPublic ?? true,
    });

    // 2. Add songs in their exact original order
    const populated = await dataStore.addSongsToPlaylist(newPlaylist.id, songIds);

    return res.status(201).json({
      success: true,
      playlist: populated || newPlaylist,
      totalImported: songIds.length,
      message: `Successfully created playlist "${title}" with ${songIds.length} tracks.`,
    });
  } catch (error: any) {
    console.error('Playlist import create error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to create imported playlist.' });
  }
};
