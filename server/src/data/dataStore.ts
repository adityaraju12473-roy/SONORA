import { Song, Artist, Album, Playlist, Profile, ListeningHistory } from '../types';
import { initialSongs, initialArtists, initialAlbums, initialPlaylists, defaultAdminUser } from './seedData';
import { supabaseAdminClient } from '../config/supabase';
import { ENV } from '../config/env';

/**
 * DataStore manages music catalogue and user data,
 * bridging Supabase PostgreSQL when credentials exist,
 * and seamless in-memory state during local testing.
 */
class DataStore {
  private songs: Song[] = [...initialSongs];
  private artists: Artist[] = [...initialArtists];
  private albums: Album[] = [...initialAlbums];
  private playlists: Playlist[] = [...initialPlaylists];
  private favorites: Map<string, Set<string>> = new Map(); // userId -> Set<songId>
  private history: ListeningHistory[] = [];
  private users: Profile[] = [defaultAdminUser];

  constructor() {
    // Initialize admin favorites with a couple songs
    this.favorites.set(defaultAdminUser.id, new Set(['song-1', 'song-4', 'song-2']));
    // Initialize sample listening history
    this.history = [
      { id: 'h-1', user_id: defaultAdminUser.id, song_id: 'song-1', played_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), song: this.songs[0] },
      { id: 'h-2', user_id: defaultAdminUser.id, song_id: 'song-4', played_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), song: this.songs[3] },
      { id: 'h-3', user_id: defaultAdminUser.id, song_id: 'song-2', played_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), song: this.songs[1] },
    ];
  }

  // ==========================================
  // SONGS
  // ==========================================
  async getSongs(params: {
    genre?: string;
    artistId?: string;
    albumId?: string;
    search?: string;
    featured?: boolean;
    trending?: boolean;
    sort?: 'recent' | 'plays' | 'title';
  }): Promise<Song[]> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      let query = supabaseAdminClient.from('songs').select('*');
      if (params.genre) query = query.ilike('genre', `%${params.genre}%`);
      if (params.artistId) query = query.eq('artist_id', params.artistId);
      if (params.albumId) query = query.eq('album_id', params.albumId);
      if (params.featured !== undefined) query = query.eq('is_featured', params.featured);
      if (params.trending !== undefined) query = query.eq('is_trending', params.trending);
      if (params.search) {
        query = query.or(`title.ilike.%${params.search}%,artist_name.ilike.%${params.search}%,genre.ilike.%${params.search}%`);
      }
      if (params.sort === 'plays') query = query.order('plays_count', { ascending: false });
      else if (params.sort === 'title') query = query.order('title', { ascending: true });
      else query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (!error && data) return data as Song[];
    }

    let result = [...this.songs];
    if (params.genre) {
      result = result.filter(s => s.genre.toLowerCase().includes(params.genre!.toLowerCase()));
    }
    if (params.artistId) {
      result = result.filter(s => s.artist_id === params.artistId);
    }
    if (params.albumId) {
      result = result.filter(s => s.album_id === params.albumId);
    }
    if (params.featured !== undefined) {
      result = result.filter(s => s.is_featured === params.featured);
    }
    if (params.trending !== undefined) {
      result = result.filter(s => s.is_trending === params.trending);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(q) || 
        s.artist_name.toLowerCase().includes(q) || 
        s.genre.toLowerCase().includes(q)
      );
    }

    if (params.sort === 'plays') {
      result.sort((a, b) => b.plays_count - a.plays_count);
    } else if (params.sort === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }

  async getSongById(id: string): Promise<Song | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('songs').select('*').eq('id', id).single();
      if (!error && data) return data as Song;
    }
    return this.songs.find(s => s.id === id) || null;
  }

  async getSongByHash(hash: string): Promise<Song | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('songs').select('*').eq('file_hash', hash).maybeSingle();
      if (!error && data) return data as Song;
    }
    return this.songs.find(s => s.file_hash === hash) || null;
  }

  async getSongByCloudinaryAssetId(assetId: string): Promise<Song | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('songs').select('*').eq('cloudinary_asset_id', assetId).maybeSingle();
      if (!error && data) return data as Song;
    }
    return this.songs.find(s => s.cloudinary_asset_id === assetId) || null;
  }

  async getSongByCloudinaryPublicId(publicId: string): Promise<Song | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('songs').select('*').eq('cloudinary_public_id', publicId).maybeSingle();
      if (!error && data) return data as Song;
    }
    return this.songs.find(s => s.cloudinary_public_id === publicId) || null;
  }

  async getPlaylistByTitle(title: string): Promise<Playlist | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        const { data, error } = await supabaseAdminClient
          .from('playlists')
          .select('*, playlist_songs(position, songs(*))')
          .ilike('title', title)
          .maybeSingle();

        if (!error && data) {
          const songs = (data.playlist_songs || [])
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((ps: any) => ps.songs)
            .filter(Boolean);

          return {
            ...data,
            songs,
            song_count: songs.length,
            total_duration: songs.reduce((acc: number, s: any) => acc + (s.duration || 0), 0),
          } as Playlist;
        }
      } catch (e) {
        console.warn('Supabase getPlaylistByTitle exception:', e);
      }
    }
    return this.playlists.find(p => p.title.toLowerCase() === title.toLowerCase()) || null;
  }

  async createSong(songData: Omit<Song, 'id' | 'created_at' | 'plays_count'>): Promise<Song> {
    const newSong: Song = {
      ...songData,
      id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      plays_count: 0,
      created_at: new Date().toISOString(),
    };

    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        // Strip custom string id so PostgreSQL uuid_generate_v4() generates a valid UUID
        const { id, ...supabaseSongData } = newSong;
        const { data, error } = await supabaseAdminClient.from('songs').insert([supabaseSongData]).select().single();
        if (!error && data) {
          this.songs.unshift(data as Song);
          return data as Song;
        } else if (error) {
          console.warn('Supabase createSong error, falling back to local memory store:', error.message);
        }
      } catch (e) {
        console.warn('Supabase createSong exception:', e);
      }
    }

    this.songs.unshift(newSong);
    return newSong;
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('songs').update(updates).eq('id', id).select().single();
      if (!error && data) return data as Song;
    }

    const index = this.songs.findIndex(s => s.id === id);
    if (index === -1) return null;
    this.songs[index] = { ...this.songs[index], ...updates };
    return this.songs[index];
  }

  async deleteSong(id: string): Promise<boolean> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { error } = await supabaseAdminClient.from('songs').delete().eq('id', id);
      if (!error) return true;
    }

    const initialLength = this.songs.length;
    this.songs = this.songs.filter(s => s.id !== id);
    // Also remove from playlists
    this.playlists.forEach(pl => {
      if (pl.songs) {
        pl.songs = pl.songs.filter(s => s.id !== id);
        pl.song_count = pl.songs.length;
      }
    });
    return this.songs.length < initialLength;
  }

  async incrementPlayCount(id: string): Promise<void> {
    const song = await this.getSongById(id);
    if (!song) return;

    if (ENV.hasSupabase && supabaseAdminClient) {
      await supabaseAdminClient
        .from('songs')
        .update({ plays_count: (song.plays_count || 0) + 1 })
        .eq('id', id);
    } else {
      song.plays_count = (song.plays_count || 0) + 1;
    }
  }

  // ==========================================
  // ARTISTS
  // ==========================================
  async getArtists(): Promise<Artist[]> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('artists').select('*').order('monthly_listeners', { ascending: false });
      if (!error && data && data.length > 0) return data as Artist[];
    }
    const allSongs = await this.getSongs({});
    if (allSongs.length > 0) {
      const artistMap = new Map<string, Artist>();
      allSongs.forEach(song => {
        const rawArtist = (song.artist_name || '').trim();
        const artistName = rawArtist && rawArtist !== 'Unknown Artist' && rawArtist !== 'Cloud Stream' ? rawArtist : 'Featured Artist';
        const key = artistName.toLowerCase();
        if (!artistMap.has(key)) {
          const initial = (artistName.trim().charAt(0) || 'A').toUpperCase();
          const avatarSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" rx="200" fill="#18181b"/><circle cx="200" cy="160" r="56" fill="rgba(255,255,255,0.08)"/><path d="M120 320 C120 250, 160 230, 200 230 C240 230, 280 250, 280 320 Z" fill="rgba(255,255,255,0.08)"/><text x="200" y="172" font-family="sans-serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle">${initial}</text></svg>`
          )}`;

          artistMap.set(key, {
            id: song.artist_id || `art-${encodeURIComponent(artistName)}`,
            name: artistName,
            avatar_url: avatarSvg,
            genre: song.genre,
            bio: `Featured artist on SONORA with tracks in ${song.genre || 'Electronic'}.`,
            monthly_listeners: (song.plays_count || 1) * 120 + 350,
            is_verified: true,
            created_at: song.created_at || new Date().toISOString(),
          });
        }
      });
      return Array.from(artistMap.values());
    }
    return [...this.artists];
  }

  async getArtistById(id: string): Promise<(Artist & { songs: Song[]; albums: Album[] }) | null> {
    const artists = await this.getArtists();
    const artist = artists.find(a => a.id === id || a.name.toLowerCase() === id.toLowerCase());
    if (!artist) return null;
    const allSongs = await this.getSongs({});
    const songs = allSongs.filter(s => s.artist_id === id || s.artist_name.toLowerCase() === artist.name.toLowerCase());
    const allAlbums = await this.getAlbums();
    const albums = allAlbums.filter(a => a.artist_id === id || a.artist_name.toLowerCase() === artist.name.toLowerCase());
    return { ...artist, songs, albums };
  }

  async createArtist(data: Omit<Artist, 'id' | 'created_at'>): Promise<Artist> {
    const newArtist: Artist = {
      ...data,
      id: `art-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data: created, error } = await supabaseAdminClient.from('artists').insert([newArtist]).select().single();
      if (!error && created) return created as Artist;
    }
    this.artists.push(newArtist);
    return newArtist;
  }

  async updateArtist(id: string, updates: Partial<Artist>): Promise<Artist | null> {
    const index = this.artists.findIndex(a => a.id === id);
    if (index === -1) return null;
    this.artists[index] = { ...this.artists[index], ...updates };
    return this.artists[index];
  }

  async deleteArtist(id: string): Promise<boolean> {
    const initial = this.artists.length;
    this.artists = this.artists.filter(a => a.id !== id);
    return this.artists.length < initial;
  }

  // ==========================================
  // ALBUMS
  // ==========================================
  async getAlbums(): Promise<Album[]> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data, error } = await supabaseAdminClient.from('albums').select('*').order('release_year', { ascending: false });
      if (!error && data && data.length > 0) return data as Album[];
    }
    const allSongs = await this.getSongs({});
    if (allSongs.length > 0) {
      const albumMap = new Map<string, Album>();
      allSongs.forEach(song => {
        const albumTitle = song.album_name && song.album_name !== 'Cloudinary Stream' ? song.album_name : song.title;
        const key = `${albumTitle.toLowerCase().trim()}:::${song.artist_name.toLowerCase().trim()}`;
        if (!albumMap.has(key)) {
          albumMap.set(key, {
            id: song.album_id || `alb-${encodeURIComponent(albumTitle)}`,
            title: albumTitle,
            artist_id: song.artist_id,
            artist_name: song.artist_name,
            cover_url: song.cover_url,
            release_year: song.release_year || 2025,
            genre: song.genre,
            total_tracks: 1,
            created_at: song.created_at || new Date().toISOString(),
          });
        } else {
          albumMap.get(key)!.total_tracks = (albumMap.get(key)!.total_tracks || 1) + 1;
        }
      });
      return Array.from(albumMap.values());
    }
    return [...this.albums];
  }

  async getAlbumById(id: string): Promise<(Album & { songs: Song[] }) | null> {
    const albums = await this.getAlbums();
    const album = albums.find(a => a.id === id || a.title.toLowerCase() === id.toLowerCase());
    if (!album) return null;
    const allSongs = await this.getSongs({});
    const songs = allSongs.filter(s => s.album_id === id || (s.album_name && s.album_name.toLowerCase() === album.title.toLowerCase()) || s.title.toLowerCase() === album.title.toLowerCase());
    return { ...album, songs };
  }

  async createAlbum(data: Omit<Album, 'id' | 'created_at' | 'total_tracks'>): Promise<Album> {
    const newAlbum: Album = {
      ...data,
      id: `alb-${Date.now()}`,
      total_tracks: 0,
      created_at: new Date().toISOString(),
    };
    if (ENV.hasSupabase && supabaseAdminClient) {
      const { data: created, error } = await supabaseAdminClient.from('albums').insert([newAlbum]).select().single();
      if (!error && created) return created as Album;
    }
    this.albums.push(newAlbum);
    return newAlbum;
  }

  async updateAlbum(id: string, updates: Partial<Album>): Promise<Album | null> {
    const index = this.albums.findIndex(a => a.id === id);
    if (index === -1) return null;
    this.albums[index] = { ...this.albums[index], ...updates };
    return this.albums[index];
  }

  async deleteAlbum(id: string): Promise<boolean> {
    const initial = this.albums.length;
    this.albums = this.albums.filter(a => a.id !== id);
    return this.albums.length < initial;
  }

  // ==========================================
  // PLAYLISTS
  // ==========================================
  async getPlaylists(userId?: string): Promise<Playlist[]> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      let query = supabaseAdminClient.from('playlists').select('*, playlist_songs(position, songs(*))');
      if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
      } else {
        query = query.eq('is_public', true);
      }
      const { data, error } = await query;
      if (!error && data) {
        return data.map((pl: any) => {
          const songs = (pl.playlist_songs || [])
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((ps: any) => ps.songs)
            .filter(Boolean);
          return {
            ...pl,
            songs,
            song_count: songs.length,
            total_duration: songs.reduce((acc: number, s: any) => acc + (s.duration || 0), 0),
          };
        }) as Playlist[];
      }
    }

    if (userId) {
      return this.playlists.filter(p => p.is_public || p.user_id === userId);
    }
    return this.playlists;
  }

  async getPlaylistById(id: string): Promise<Playlist | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        const { data, error } = await supabaseAdminClient
          .from('playlists')
          .select('*, playlist_songs(position, songs(*))')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          const songs = (data.playlist_songs || [])
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((ps: any) => ps.songs)
            .filter(Boolean);

          return {
            ...data,
            songs,
            song_count: songs.length,
            total_duration: songs.reduce((acc: number, s: any) => acc + (s.duration || 0), 0),
          };
        }
      } catch (e) {
        console.warn('Supabase getPlaylistById exception:', e);
      }
    }
    const pl = this.playlists.find(p => p.id === id);
    if (!pl) return null;
    return pl;
  }

  async createPlaylist(data: { userId?: string; title: string; description?: string; coverUrl?: string; isPublic?: boolean }): Promise<Playlist> {
    const validUuid = data.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId) ? data.userId : null;
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: validUuid || 'usr-admin',
      title: data.title,
      description: data.description || '',
      cover_url: data.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
      is_public: data.isPublic ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      songs: [],
      song_count: 0,
      total_duration: 0,
    };

    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        const { data: created, error } = await supabaseAdminClient
          .from('playlists')
          .insert([{
            title: data.title,
            description: data.description || '',
            cover_url: newPlaylist.cover_url,
            is_public: data.isPublic ?? true,
            user_id: validUuid,
          }])
          .select()
          .single();

        if (!error && created) {
          const resPlaylist = { ...created, songs: [], song_count: 0, total_duration: 0 };
          this.playlists.unshift(resPlaylist);
          return resPlaylist;
        } else if (error) {
          console.warn('Supabase createPlaylist error, fallback to memory:', error.message);
        }
      } catch (e) {
        console.warn('Supabase createPlaylist exception:', e);
      }
    }

    this.playlists.unshift(newPlaylist);
    return newPlaylist;
  }

  async addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<Playlist | null> {
    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        const rows = songIds.map((songId, index) => ({
          playlist_id: playlistId,
          song_id: songId,
          position: index,
        }));
        await supabaseAdminClient
          .from('playlist_songs')
          .upsert(rows, { onConflict: 'playlist_id,song_id' });

        return this.getPlaylistById(playlistId);
      } catch (e) {
        console.warn('Supabase addSongsToPlaylist exception:', e);
      }
    }

    const pl = this.playlists.find(p => p.id === playlistId);
    if (pl) {
      if (!pl.songs) pl.songs = [];
      for (const songId of songIds) {
        const song = await this.getSongById(songId);
        if (song && !pl.songs.some(s => s.id === songId)) {
          pl.songs.push(song);
        }
      }
      pl.song_count = pl.songs.length;
      pl.total_duration = pl.songs.reduce((acc, s) => acc + s.duration, 0);
      pl.updated_at = new Date().toISOString();
      return pl;
    }
    return null;
  }

  async updatePlaylist(id: string, updates: Partial<Playlist>): Promise<Playlist | null> {
    const pl = this.playlists.find(p => p.id === id);
    if (!pl) return null;
    Object.assign(pl, updates, { updated_at: new Date().toISOString() });
    return pl;
  }

  async deletePlaylist(id: string): Promise<boolean> {
    const initial = this.playlists.length;
    this.playlists = this.playlists.filter(p => p.id !== id);
    return this.playlists.length < initial;
  }

  async addSongToPlaylist(playlistId: string, songId: string): Promise<Playlist | null> {
    const pl = this.playlists.find(p => p.id === playlistId);
    const song = await this.getSongById(songId);

    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        const { data: currentItems } = await supabaseAdminClient
          .from('playlist_songs')
          .select('position')
          .eq('playlist_id', playlistId)
          .order('position', { ascending: false })
          .limit(1);

        const nextPosition = currentItems && currentItems.length > 0 ? (currentItems[0].position || 0) + 1 : 0;

        await supabaseAdminClient
          .from('playlist_songs')
          .upsert({
            playlist_id: playlistId,
            song_id: songId,
            position: nextPosition,
          }, { onConflict: 'playlist_id,song_id' });

        return this.getPlaylistById(playlistId);
      } catch (e) {
        console.warn('Supabase addSongToPlaylist exception:', e);
      }
    }

    if (pl && song) {
      if (!pl.songs) pl.songs = [];
      if (!pl.songs.some(s => s.id === songId)) {
        pl.songs.push(song);
        pl.song_count = pl.songs.length;
        pl.total_duration = pl.songs.reduce((acc, s) => acc + s.duration, 0);
        pl.updated_at = new Date().toISOString();
      }
      return pl;
    }
    return pl || null;
  }

  async removeSongFromPlaylist(playlistId: string, songId: string): Promise<Playlist | null> {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl || !pl.songs) return null;

    pl.songs = pl.songs.filter(s => s.id !== songId);
    pl.song_count = pl.songs.length;
    pl.total_duration = pl.songs.reduce((acc, s) => acc + s.duration, 0);
    pl.updated_at = new Date().toISOString();
    return pl;
  }

  async reorderPlaylistSongs(playlistId: string, songIds: string[]): Promise<Playlist | null> {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl || !pl.songs) return null;

    const songMap = new Map(pl.songs.map(s => [s.id, s]));
    const reordered: Song[] = [];
    for (const sid of songIds) {
      const s = songMap.get(sid);
      if (s) reordered.push(s);
    }
    pl.songs = reordered;
    pl.updated_at = new Date().toISOString();
    return pl;
  }

  // ==========================================
  // FAVOURITES
  // ==========================================
  async getFavorites(userId: string): Promise<Song[]> {
    const songIds = this.favorites.get(userId) || new Set();
    return this.songs.filter(s => songIds.has(s.id));
  }

  async toggleFavorite(userId: string, songId: string): Promise<{ isFavorited: boolean }> {
    let set = this.favorites.get(userId);
    if (!set) {
      set = new Set();
      this.favorites.set(userId, set);
    }

    if (set.has(songId)) {
      set.delete(songId);
      return { isFavorited: false };
    } else {
      set.add(songId);
      return { isFavorited: true };
    }
  }

  async isFavorite(userId: string, songId: string): Promise<boolean> {
    const set = this.favorites.get(userId);
    return set ? set.has(songId) : false;
  }

  // ==========================================
  // LISTENING HISTORY & RECOMMENDATIONS
  // ==========================================
  async recordHistory(userId: string, songId: string): Promise<void> {
    const song = this.songs.find(s => s.id === songId);
    if (!song) return;

    this.history.unshift({
      id: `h-${Date.now()}`,
      user_id: userId,
      song_id: songId,
      played_at: new Date().toISOString(),
      song,
    });
    // Keep max 100 history items per user
    if (this.history.length > 200) {
      this.history = this.history.slice(0, 100);
    }

    await this.incrementPlayCount(songId);
  }

  async getHistory(userId: string, limit = 20): Promise<ListeningHistory[]> {
    return this.history.filter(h => h.user_id === userId).slice(0, limit);
  }

  async getRecommendations(userId: string, limit = 6): Promise<Song[]> {
    const userHistory = this.history.filter(h => h.user_id === userId);
    const favoriteSet = this.favorites.get(userId) || new Set();

    // Collect preferred genres
    const genreCounts: Record<string, number> = {};
    for (const h of userHistory) {
      if (h.song?.genre) {
        genreCounts[h.song.genre] = (genreCounts[h.song.genre] || 0) + 1;
      }
    }

    // Sort songs by genre match, popularity, excluding recently played
    const playedSongIds = new Set(userHistory.map(h => h.song_id));
    const recommendations = [...this.songs]
      .filter(s => !playedSongIds.has(s.id) || favoriteSet.has(s.id))
      .sort((a, b) => {
        const scoreA = (genreCounts[a.genre] || 0) * 10 + (a.is_trending ? 5 : 0) + (a.plays_count / 1000);
        const scoreB = (genreCounts[b.genre] || 0) * 10 + (b.is_trending ? 5 : 0) + (b.plays_count / 1000);
        return scoreB - scoreA;
      });

    return recommendations.slice(0, limit);
  }

  // ==========================================
  // STATS FOR ADMIN
  // ==========================================
  async getAdminStats() {
    let totalSongs = this.songs.length;
    let totalArtists = this.artists.length;
    let totalAlbums = this.albums.length;
    let totalPlaylists = this.playlists.length;
    let totalStreams = this.songs.reduce((acc, s) => acc + (s.plays_count || 0), 0);
    let totalDurationSeconds = this.songs.reduce((acc, s) => acc + (s.duration || 0), 0);

    if (ENV.hasSupabase && supabaseAdminClient) {
      try {
        const [songsCountRes, artistsCountRes, albumsCountRes, playlistsCountRes] = await Promise.all([
          supabaseAdminClient.from('songs').select('*', { count: 'exact', head: true }),
          supabaseAdminClient.from('artists').select('*', { count: 'exact', head: true }),
          supabaseAdminClient.from('albums').select('*', { count: 'exact', head: true }),
          supabaseAdminClient.from('playlists').select('*', { count: 'exact', head: true }),
        ]);

        if (songsCountRes.count !== null && songsCountRes.count !== undefined) {
          totalSongs = songsCountRes.count;
        }
        if (artistsCountRes.count !== null && artistsCountRes.count !== undefined) {
          totalArtists = artistsCountRes.count;
        }
        if (albumsCountRes.count !== null && albumsCountRes.count !== undefined) {
          totalAlbums = albumsCountRes.count;
        }
        if (playlistsCountRes.count !== null && playlistsCountRes.count !== undefined) {
          totalPlaylists = playlistsCountRes.count;
        }
      } catch (e) {
        console.warn('Failed to query Supabase stats counts:', e);
      }
    }

    const genreDistribution: Record<string, number> = {};
    for (const s of this.songs) {
      genreDistribution[s.genre] = (genreDistribution[s.genre] || 0) + 1;
    }

    return {
      totalSongs,
      totalArtists,
      totalAlbums,
      totalPlaylists,
      totalStreams,
      totalDurationSeconds,
      genreDistribution,
      cloudinaryConfigured: ENV.hasCloudinary,
      supabaseConfigured: ENV.hasSupabase,
      r2Configured: ENV.hasR2,
      missingCredentials: ENV.getMissingCredentials(),
    };
  }
}

export const dataStore = new DataStore();
