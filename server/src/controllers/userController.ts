import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { dataStore } from '../data/dataStore';

export const getFavorites = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'usr-admin';
    const favorites = await dataStore.getFavorites(userId);
    return res.status(200).json(favorites);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch favorites' });
  }
};

export const toggleFavorite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'usr-admin';
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'Song ID is required' });

    const result = await dataStore.toggleFavorite(userId, songId);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to toggle favorite' });
  }
};

export const getListeningHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'usr-admin';
    const history = await dataStore.getHistory(userId);
    return res.status(200).json(history);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch history' });
  }
};

export const recordListeningHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'usr-admin';
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ error: 'Song ID is required' });

    await dataStore.recordHistory(userId, songId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to record history' });
  }
};

export const getRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'usr-admin';
    const recommendations = await dataStore.getRecommendations(userId);
    return res.status(200).json(recommendations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch recommendations' });
  }
};

export const getCurrentUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
    user: req.user,
  });
};
