import { Song, Album, Artist, Playlist, Profile, ListeningHistoryItem } from '../types';
import { supabase } from '../config/supabase';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private async getAuthToken(): Promise<string | null> {
    const localToken = localStorage.getItem('sonora_token');
    if (localToken) return localToken;

    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          localStorage.setItem('sonora_token', data.session.access_token);
          return data.session.access_token;
        }
      } catch (e) {
        // fallback
      }
    }
    return null;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = await this.getHeaders();
    const headers = {
      ...defaultHeaders,
      ...(options.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.error) errorMessage = errorJson.error;
      } catch (e) {
        // keep standard status
      }
      throw new Error(errorMessage);
    }

    return res.json();
  }

  // ==========================================
  // SONGS
  // ==========================================
  async getSongs(params?: {
    genre?: string;
    artistId?: string;
    albumId?: string;
    search?: string;
    featured?: boolean;
    trending?: boolean;
    sort?: 'recent' | 'plays' | 'title';
  }): Promise<Song[]> {
    const searchParams = new URLSearchParams();
    if (params?.genre) searchParams.set('genre', params.genre);
    if (params?.artistId) searchParams.set('artistId', params.artistId);
    if (params?.albumId) searchParams.set('albumId', params.albumId);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.featured !== undefined) searchParams.set('featured', String(params.featured));
    if (params?.trending !== undefined) searchParams.set('trending', String(params.trending));
    if (params?.sort) searchParams.set('sort', params.sort);

    const query = searchParams.toString();
    return this.request<Song[]>(`/songs${query ? `?${query}` : ''}`);
  }

  async getSongById(id: string): Promise<Song> {
    return this.request<Song>(`/songs/${id}`);
  }

  async createSong(songData: Partial<Song>): Promise<Song> {
    return this.request<Song>('/songs', {
      method: 'POST',
      body: JSON.stringify(songData),
    });
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    return this.request<Song>(`/songs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSong(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/songs/${id}`, {
      method: 'DELETE',
    });
  }

  async recordPlay(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/songs/${id}/play`, {
      method: 'POST',
    });
  }

  // ==========================================
  // ALBUMS
  // ==========================================
  async getAlbums(): Promise<Album[]> {
    return this.request<Album[]>('/albums');
  }

  async getAlbumById(id: string): Promise<Album & { songs: Song[] }> {
    return this.request<Album & { songs: Song[] }>(`/albums/${id}`);
  }

  async createAlbum(data: Partial<Album>): Promise<Album> {
    return this.request<Album>('/albums', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAlbum(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/albums/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // ARTISTS
  // ==========================================
  async getArtists(): Promise<Artist[]> {
    return this.request<Artist[]>('/artists');
  }

  async getArtistById(id: string): Promise<Artist & { songs: Song[]; albums: Album[] }> {
    return this.request<Artist & { songs: Song[]; albums: Album[] }>(`/artists/${id}`);
  }

  async createArtist(data: Partial<Artist>): Promise<Artist> {
    return this.request<Artist>('/artists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteArtist(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/artists/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // PLAYLISTS
  // ==========================================
  async getPlaylists(): Promise<Playlist[]> {
    return this.request<Playlist[]>('/playlists');
  }

  async getPlaylistById(id: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`);
  }

  async createPlaylist(data: { title: string; description?: string; coverUrl?: string; isPublic?: boolean }): Promise<Playlist> {
    return this.request<Playlist>('/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePlaylist(id: string, updates: Partial<Playlist>): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deletePlaylist(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/playlists/${id}`, {
      method: 'DELETE',
    });
  }

  async addSongToPlaylist(playlistId: string, songId: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${playlistId}/songs`, {
      method: 'POST',
      body: JSON.stringify({ songId }),
    });
  }

  async removeSongFromPlaylist(playlistId: string, songId: string): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE',
    });
  }

  async reorderPlaylist(playlistId: string, songIds: string[]): Promise<Playlist> {
    return this.request<Playlist>(`/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ songIds }),
    });
  }

  // ==========================================
  // PLAYLIST IMPORT (SPOTIFY & YOUTUBE MUSIC)
  // ==========================================
  async importPlaylistFetch(data: {
    url: string;
    spotifyClientId?: string;
    spotifyClientSecret?: string;
    youtubeApiKey?: string;
  }): Promise<{
    source: 'spotify' | 'youtube';
    playlistId: string;
    title: string;
    description?: string;
    coverUrl?: string;
    totalTracks: number;
    matchedCount: number;
    unmatchedCount: number;
    tracks: Array<{
      position: number;
      originalTitle: string;
      originalArtist: string;
      originalAlbum?: string;
      duration?: number;
      isMatched: boolean;
      matchConfidence: number;
      matchConfidenceLevel: 'HIGH' | 'MEDIUM' | 'UNMATCHED';
      matchReason?: string;
      matchedSong?: Song;
    }>;
  }> {
    return this.request('/playlists/import/fetch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async importPlaylistCreate(data: {
    title: string;
    description?: string;
    coverUrl?: string;
    songIds: string[];
    isPublic?: boolean;
  }): Promise<{
    success: boolean;
    playlist: Playlist;
    totalImported: number;
    message: string;
  }> {
    return this.request('/playlists/import/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // FAVOURITES & LISTENING HISTORY
  // ==========================================
  async getFavorites(): Promise<Song[]> {
    return this.request<Song[]>('/users/favorites');
  }

  async toggleFavorite(songId: string): Promise<{ isFavorited: boolean }> {
    return this.request<{ isFavorited: boolean }>('/users/favorites', {
      method: 'POST',
      body: JSON.stringify({ songId }),
    });
  }

  async getListeningHistory(): Promise<ListeningHistoryItem[]> {
    return this.request<ListeningHistoryItem[]>('/users/history');
  }

  async recordHistory(songId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/users/history', {
      method: 'POST',
      body: JSON.stringify({ songId }),
    });
  }

  async getRecommendations(): Promise<Song[]> {
    return this.request<Song[]>('/users/recommendations');
  }

  // ==========================================
  // CLOUDINARY, R2 & SERVER UPLOADS
  // ==========================================
  async getStorageStatus(): Promise<{
    supabaseConfigured: boolean;
    r2Configured: boolean;
    cloudinaryConfigured: boolean;
    missingCredentials: { supabase: string[]; r2: string[]; cloudinary: string[] };
    storageMode: string;
  }> {
    return this.request<any>('/upload/storage-status');
  }

  async getUploadSignature(folder?: string, resourceType?: string) {
    const searchParams = new URLSearchParams();
    if (folder) searchParams.set('folder', folder);
    if (resourceType) searchParams.set('resourceType', resourceType);
    return this.request<any>(`/upload/signature?${searchParams.toString()}`);
  }

  async uploadFiles(formData: FormData): Promise<{
    success: boolean;
    storage?: 'r2' | 'cloudinary' | 'local';
    audio: { url: string; publicId: string; originalname?: string; fileHash?: string };
    cover: { url: string; publicId: string; originalname?: string };
    missingCredentials?: { supabase: string[]; r2: string[]; cloudinary: string[] };
  }> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/upload/file`, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!res.ok) {
      let err = 'Upload failed';
      try {
        const errJson = await res.json();
        if (errJson.error) err = errJson.error;
      } catch (e) {
        // ignore
      }
      throw new Error(err);
    }
    return res.json();
  }

  async uploadBulkTrack(formData: FormData): Promise<{
    success: boolean;
    skipped: boolean;
    duplicate?: boolean;
    message?: string;
    storage?: 'r2' | 'cloudinary' | 'local';
    song: Song;
    collection: Playlist;
  }> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/upload/bulk-batch`, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!res.ok) {
      let err = 'Track import failed';
      try {
        const errJson = await res.json();
        if (errJson.error) err = errJson.error;
      } catch (e) {
        // ignore
      }
      throw new Error(err);
    }
    return res.json();
  }

  // ==========================================
  // CLOUDINARY AUDIO ASSETS & SYNC
  // ==========================================
  async getCloudinaryAudioAssets(params?: { prefix?: string; max_results?: number; next_cursor?: string }): Promise<{
    success: boolean;
    count: number;
    next_cursor: string | null;
    total_count?: number;
    assets: Array<{
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
    }>;
    error?: string;
    missingCredentials?: { cloudinary?: string[] };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.prefix) searchParams.set('prefix', params.prefix);
    if (params?.max_results) searchParams.set('max_results', String(params.max_results));
    if (params?.next_cursor) searchParams.set('next_cursor', params.next_cursor);
    const qs = searchParams.toString();
    return this.request<any>(`/cloudinary/assets${qs ? `?${qs}` : ''}`);
  }

  async importCloudinaryAudioAssets(payload: {
    assets?: any[];
    prefix?: string;
    limit?: number;
    collectionName?: string;
    defaultCoverUrl?: string;
  }): Promise<{
    success: boolean;
    summary: {
      totalProcessed: number;
      importedCount: number;
      skippedCount: number;
      failedCount: number;
      collectionName: string;
      collection?: Playlist;
    };
    importedSongs: Song[];
    skippedTracks: Array<{ asset_id: string; title: string; reason: string }>;
    failedTracks: Array<{ asset_id: string; title: string; error: string }>;
    error?: string;
  }> {
    return this.request<any>('/cloudinary/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ==========================================
  // STATS
  // ==========================================
  async getAdminStats(): Promise<any> {
    return this.request<any>('/admin/stats');
  }
}

export const api = new ApiService();
