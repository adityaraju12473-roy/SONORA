import { Request, Response } from 'express';
import { dataStore } from '../data/dataStore';

export const getAlbums = async (_req: Request, res: Response) => {
  try {
    const albums = await dataStore.getAlbums();
    return res.status(200).json(albums);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch albums' });
  }
};

export const getAlbumById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const album = await dataStore.getAlbumById(id);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    return res.status(200).json(album);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch album' });
  }
};

export const createAlbum = async (req: Request, res: Response) => {
  try {
    const { title, artist_name, cover_url, release_year, genre } = req.body;
    if (!title || !artist_name || !cover_url) {
      return res.status(400).json({ error: 'Title, artist name, and cover URL are required' });
    }
    const album = await dataStore.createAlbum(req.body);
    return res.status(201).json(album);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create album' });
  }
};

export const updateAlbum = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateAlbum(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Album not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update album' });
  }
};

export const deleteAlbum = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dataStore.deleteAlbum(id);
    if (!success) return res.status(404).json({ error: 'Album not found' });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete album' });
  }
};
