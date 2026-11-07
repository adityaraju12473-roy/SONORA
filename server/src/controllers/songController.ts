import { Request, Response } from 'express';
import { dataStore } from '../data/dataStore';
import { z } from 'zod';

const songCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  artist_name: z.string().min(1, 'Artist name is required'),
  artist_id: z.string().optional().nullable(),
  album_id: z.string().optional().nullable(),
  album_name: z.string().optional().nullable(),
  genre: z.string().min(1, 'Genre is required'),
  duration: z.number().nonnegative(),
  release_year: z.number().int().optional(),
  cover_url: z.string().url('Invalid cover URL'),
  audio_url: z.string().url('Invalid audio stream URL'),
  cloudinary_public_id: z.string().optional(),
  cloudinary_format: z.string().optional(),
  is_featured: z.boolean().optional().default(false),
  is_trending: z.boolean().optional().default(false),
});

export const getSongs = async (req: Request, res: Response) => {
  try {
    const { genre, artistId, albumId, search, featured, trending, sort } = req.query;
    const songs = await dataStore.getSongs({
      genre: genre as string,
      artistId: artistId as string,
      albumId: albumId as string,
      search: search as string,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      trending: trending === 'true' ? true : trending === 'false' ? false : undefined,
      sort: sort as 'recent' | 'plays' | 'title',
    });
    return res.status(200).json(songs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch songs' });
  }
};

export const getSongById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const song = await dataStore.getSongById(id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    return res.status(200).json(song);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch song' });
  }
};

export const createSong = async (req: Request, res: Response) => {
  try {
    const parseResult = songCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const newSong = await dataStore.createSong(parseResult.data as any);
    return res.status(201).json(newSong);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create song' });
  }
};

export const updateSong = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateSong(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Song not found' });
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update song' });
  }
};

export const deleteSong = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dataStore.deleteSong(id);
    if (!success) return res.status(404).json({ error: 'Song not found' });
    return res.status(200).json({ success: true, message: 'Song deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete song' });
  }
};

export const recordPlay = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await dataStore.incrementPlayCount(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to record play' });
  }
};
