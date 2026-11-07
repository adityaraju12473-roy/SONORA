import { Request, Response } from 'express';
import { dataStore } from '../data/dataStore';

export const getArtists = async (_req: Request, res: Response) => {
  try {
    const artists = await dataStore.getArtists();
    return res.status(200).json(artists);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch artists' });
  }
};

export const getArtistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const artist = await dataStore.getArtistById(id);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });
    return res.status(200).json(artist);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch artist' });
  }
};

export const createArtist = async (req: Request, res: Response) => {
  try {
    const { name, avatar_url } = req.body;
    if (!name || !avatar_url) {
      return res.status(400).json({ error: 'Artist name and avatar URL are required' });
    }
    const artist = await dataStore.createArtist(req.body);
    return res.status(201).json(artist);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create artist' });
  }
};

export const updateArtist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateArtist(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Artist not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update artist' });
  }
};

export const deleteArtist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dataStore.deleteArtist(id);
    if (!success) return res.status(404).json({ error: 'Artist not found' });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete artist' });
  }
};
