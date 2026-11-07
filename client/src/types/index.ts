export interface Song {
  id: string;
  title: string;
  artist_id?: string | null;
  artist_name: string;
  album_id?: string | null;
  album_name?: string | null;
  genre: string;
  duration: number; // in seconds
  release_year?: number;
  cover_url: string;
  audio_url: string;
  cloudinary_public_id?: string;
  cloudinary_asset_id?: string;
  cloudinary_format?: string;
  storage_key?: string;
  file_hash?: string;
  file_size?: number;
  lyrics?: string;
  plays_count: number;
  is_featured: boolean;
  is_trending: boolean;
  created_at: string;
}

export interface Artist {
  id: string;
  name: string;
  bio?: string;
  avatar_url: string;
  header_url?: string;
  genre?: string;
  monthly_listeners: number;
  is_verified: boolean;
  created_at: string;
  songs?: Song[];
  albums?: Album[];
}

export interface Album {
  id: string;
  title: string;
  artist_id?: string | null;
  artist_name: string;
  cover_url: string;
  release_year: number;
  genre?: string;
  total_tracks: number;
  created_at: string;
  songs?: Song[];
}

export interface Playlist {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  cover_url?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  songs?: Song[];
  song_count?: number;
  total_duration?: number;
}

export interface Profile {
  id: string;
  email?: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  role: 'admin' | 'user';
  created_at?: string;
}

export interface ListeningHistoryItem {
  id: string;
  user_id: string;
  song_id: string;
  played_at: string;
  song?: Song;
}

export type RepeatMode = 'off' | 'all' | 'one';

export type NavView =
  | 'home'
  | 'explore'
  | 'search'
  | 'library'
  | 'playlists'
  | 'playlist-detail'
  | 'albums'
  | 'album-detail'
  | 'artists'
  | 'artist-detail'
  | 'favourites'
  | 'history'
  | 'admin';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
