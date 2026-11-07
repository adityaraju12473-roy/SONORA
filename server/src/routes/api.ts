import { Router } from 'express';
import {
  getSongs,
  getSongById,
  createSong,
  updateSong,
  deleteSong,
  recordPlay,
} from '../controllers/songController';
import {
  getAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
} from '../controllers/albumController';
import {
  getArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
} from '../controllers/artistController';
import {
  getPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addSong,
  removeSong,
  reorderSongs,
  fetchImportPlaylistMetadata,
  createImportedPlaylist,
} from '../controllers/playlistController';
import {
  getFavorites,
  toggleFavorite,
  getListeningHistory,
  recordListeningHistory,
  getRecommendations,
  getCurrentUserProfile,
} from '../controllers/userController';
import {
  getUploadSignature,
  handleServerUpload,
  handleBulkImportTrack,
  getStorageStatus,
  streamAudioFile,
  serveArtworkFile,
  uploadMiddleware,
} from '../controllers/uploadController';
import {
  getCloudinaryAudioAssets,
  importCloudinaryAudioAssets,
} from '../controllers/cloudinarySyncController';
import { getStats } from '../controllers/statsController';
import { authMiddleware, requireAdmin, optionalAuth } from '../middleware/authMiddleware';

const router = Router();

// ==========================================
// SONGS
// ==========================================
router.get('/songs', getSongs);
router.get('/songs/:id', getSongById);
router.post('/songs', authMiddleware, requireAdmin, createSong);
router.put('/songs/:id', authMiddleware, requireAdmin, updateSong);
router.delete('/songs/:id', authMiddleware, requireAdmin, deleteSong);
router.post('/songs/:id/play', recordPlay);

// ==========================================
// ALBUMS
// ==========================================
router.get('/albums', getAlbums);
router.get('/albums/:id', getAlbumById);
router.post('/albums', authMiddleware, requireAdmin, createAlbum);
router.put('/albums/:id', authMiddleware, requireAdmin, updateAlbum);
router.delete('/albums/:id', authMiddleware, requireAdmin, deleteAlbum);

// ==========================================
// ARTISTS
// ==========================================
router.get('/artists', getArtists);
router.get('/artists/:id', getArtistById);
router.post('/artists', authMiddleware, requireAdmin, createArtist);
router.put('/artists/:id', authMiddleware, requireAdmin, updateArtist);
router.delete('/artists/:id', authMiddleware, requireAdmin, deleteArtist);

// ==========================================
// PLAYLISTS
// ==========================================
router.get('/playlists', getPlaylists);
router.get('/playlists/:id', getPlaylistById);
router.post('/playlists', optionalAuth, createPlaylist);
router.put('/playlists/:id', authMiddleware, updatePlaylist);
router.delete('/playlists/:id', authMiddleware, deletePlaylist);
router.post('/playlists/:id/songs', authMiddleware, addSong);
router.delete('/playlists/:id/songs/:songId', authMiddleware, removeSong);
router.put('/playlists/:id/reorder', authMiddleware, reorderSongs);

// Playlist Import (Spotify & YouTube Music)
router.post('/playlists/import/fetch', optionalAuth, fetchImportPlaylistMetadata);
router.post('/playlists/import/create', optionalAuth, createImportedPlaylist);

// ==========================================
// USER SPECIFIC (FAVORITES, HISTORY, RECS)
// ==========================================
router.get('/users/me', authMiddleware, getCurrentUserProfile);
router.get('/users/favorites', authMiddleware, getFavorites);
router.post('/users/favorites', authMiddleware, toggleFavorite);
router.get('/users/history', authMiddleware, getListeningHistory);
router.post('/users/history', authMiddleware, recordListeningHistory);
router.get('/users/recommendations', authMiddleware, getRecommendations);

// ==========================================
// STORAGE & BULK IMPORT
// ==========================================
router.get('/upload/storage-status', authMiddleware, getStorageStatus);
router.get('/upload/signature', authMiddleware, requireAdmin, getUploadSignature);
router.post(
  '/upload/file',
  authMiddleware,
  requireAdmin,
  uploadMiddleware.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  handleServerUpload
);
router.post(
  '/upload/bulk-batch',
  authMiddleware,
  requireAdmin,
  uploadMiddleware.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  handleBulkImportTrack
);

// High-Fidelity Audio & Artwork Streaming Endpoints
router.get('/storage/audio/:filename', streamAudioFile);
router.get('/storage/artwork/:filename', serveArtworkFile);

// ==========================================
// CLOUDINARY AUDIO ASSET SYNC & IMPORT
// ==========================================
router.get('/cloudinary/assets', authMiddleware, requireAdmin, getCloudinaryAudioAssets);
router.post('/cloudinary/import', authMiddleware, requireAdmin, importCloudinaryAudioAssets);

// ==========================================
// ADMIN DASHBOARD
// ==========================================
router.get('/admin/stats', authMiddleware, requireAdmin, getStats);

export default router;
