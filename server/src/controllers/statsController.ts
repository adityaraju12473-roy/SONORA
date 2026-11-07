import { Request, Response } from 'express';
import { dataStore } from '../data/dataStore';

export const getStats = async (_req: Request, res: Response) => {
  try {
    const stats = await dataStore.getAdminStats();
    return res.status(200).json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch admin stats' });
  }
};
