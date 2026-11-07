import React, { useState, useEffect } from 'react';
import {
  Library,
  Heart,
  Plus,
  Play,
  Pause,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  Sparkles,
  Disc3,
  User,
  ListMusic,
  Clock,
  Shuffle,
  Music2,
  Link2,
} from 'lucide-react';
import { Song, Album, Artist, NavView } from '../types';
import { api } from '../services/api';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useAuth } from '../context/AuthContext';
import { PlaylistCover } from '../components/PlaylistCover';
import { useSongArtwork } from '../hooks/useSongArtwork';
import { deriveAlbumsAndArtistsFromSongs } from '../utils/catalogueHelpers';
import { isSongArtworkVerified } from '../utils/artworkResolver';

interface LibraryViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

type LibraryTab = 'all' | 'tracks' | 'playlists' | 'albums' | 'artists' | 'favourites';
type SortOption = 'recent' | 'title' | 'artist' | 'duration';
type ViewMode = 'grid' | 'table';

/**
 * Individual Song Grid Card for Library
 */
const LibrarySongCard: React.FC<{
  song: Song;
  playlist: Song[];
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: () => void;
  isFav: boolean;
  onToggleFav: () => void;
}> = ({ song, isPlaying, isCurrent, onPlay, isFav, onToggleFav }) => {
  const artwork = useSongArtwork(song);
  const isVerified = isSongArtworkVerified(song);

  return (
    <div
      onClick={onPlay}
      className={`group relative p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex flex-col justify-between active:scale-[0.98] ${
        isCurrent
          ? 'bg-[#202024] border-white/20 shadow-lg'
          : 'bg-[#161618] hover:bg-[#1e1e22] border-white/[0.06] hover:border-white/15'
      }`}
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 border border-white/5 mb-2.5 shrink-0">
        <img
          src={artwork}
          alt={song.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {!isVerified && (
          <div
            className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-400 backdrop-blur-sm"
            title="Artwork pending manual review"
          >
            Review
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
            {isCurrent && isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current translate-x-0.5" />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="text-xs sm:text-sm font-semibold text-white truncate leading-tight group-hover:text-zinc-200">
          {song.title}
        </div>
        <div className="text-[10px] sm:text-xs text-[#8e8e93] truncate leading-tight font-normal">
          {song.artist_name}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.04] text-[10px] text-[#8e8e93]">
        <span>{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className="p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              isFav ? 'text-red-500 fill-red-500' : 'text-[#8e8e93] hover:text-white'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export const LibraryView: React.FC<LibraryViewProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { playlists, openCreatePlaylist, openImportPlaylist } = usePlaylistModal();
  const { currentSong, isPlaying, playSong } = useAudioPlayer();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [songsData, albumsData, artistsData] = await Promise.all([
          api.getSongs().catch(() => []),
          api.getAlbums().catch(() => []),
          api.getArtists().catch(() => []),
        ]);

        setSongs(songsData);

        // If albums or artists are empty in DB, dynamically derive them from the 910 songs!
        if (songsData.length > 0 && (albumsData.length === 0 || artistsData.length === 0)) {
          const { albums: derivedAlbums, artists: derivedArtists } =
            deriveAlbumsAndArtistsFromSongs(songsData);
          setAlbums(albumsData.length > 0 ? albumsData : derivedAlbums);
          setArtists(artistsData.length > 0 ? artistsData : derivedArtists);
        } else {
          setAlbums(albumsData);
          setArtists(artistsData);
        }
      } catch (e) {
        console.error('Failed to load library data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const q = searchQuery.toLowerCase().trim();

  // Filter items
  const filteredPlaylists = playlists.filter(
    (p) => !q || p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
  );

  const filteredAlbums = albums.filter(
    (a) => !q || a.title.toLowerCase().includes(q) || a.artist_name.toLowerCase().includes(q)
  );

  const filteredArtists = artists.filter(
    (ar) => !q || ar.name.toLowerCase().includes(q) || (ar.genre && ar.genre.toLowerCase().includes(q))
  );

  let filteredSongs = songs.filter(
    (s) =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.artist_name.toLowerCase().includes(q) ||
      (s.album_name && s.album_name.toLowerCase().includes(q)) ||
      (s.genre && s.genre.toLowerCase().includes(q))
  );

  // If favourites tab is active, filter to only liked songs
  if (activeTab === 'favourites') {
    filteredSongs = filteredSongs.filter((s) => isFavorite(s.id));
  }

  // Sort songs
  if (sortBy === 'title') {
    filteredSongs.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'artist') {
    filteredSongs.sort((a, b) => a.artist_name.localeCompare(b.artist_name));
  } else if (sortBy === 'duration') {
    filteredSongs.sort((a, b) => b.duration - a.duration);
  } else {
    filteredSongs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return (
    <div className="min-h-full w-full bg-[#000000] text-white">
      {/* Spacious, Responsive Container for 1920px, 1366px, 768px and 390px */}
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-44 space-y-7">
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Library
            </h1>
            <p className="text-xs sm:text-sm text-[#8e8e93] font-normal mt-1">
              {songs.length} verified tracks, {albums.length} albums, and {artists.length} artists in your collection.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={openImportPlaylist}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#161618] hover:bg-[#202024] border border-white/10 hover:border-emerald-500/40 text-white text-xs font-semibold transition-transform active:scale-95 shadow-md group"
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform stroke-[2.5]" />
              <span>Import Playlist</span>
            </button>

            <button
              onClick={openCreatePlaylist}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-transform active:scale-95 shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Playlist</span>
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.08] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            {[
              { id: 'all', label: `All Items (${songs.length})` },
              { id: 'tracks', label: `Songs (${songs.length})` },
              { id: 'albums', label: `Albums (${albums.length})` },
              { id: 'artists', label: `Artists (${artists.length})` },
              { id: 'playlists', label: `Playlists (${playlists.length})` },
              { id: 'favourites', label: `Favourites (${favorites.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as LibraryTab)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-[#161618] hover:bg-[#202024] text-[#8e8e93] hover:text-white border border-white/[0.06]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Sort & View Mode Switcher */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search Input */}
            <div className="relative w-44 sm:w-56 hidden md:block">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161618] border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8e8e93] focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#161618] border border-white/10 rounded-full px-3 py-1 text-xs text-[#8e8e93]">
              <ArrowUpDown className="w-3 h-3 text-[#8e8e93]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="recent" className="bg-[#161618]">Recent</option>
                <option value="title" className="bg-[#161618]">Title (A-Z)</option>
                <option value="artist" className="bg-[#161618]">Artist</option>
                <option value="duration" className="bg-[#161618]">Duration</option>
              </select>
            </div>

            {/* Grid / List View Toggle */}
            <div className="flex items-center bg-[#161618] border border-white/10 rounded-full p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-black' : 'text-[#8e8e93] hover:text-white'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-full transition-colors ${
                  viewMode === 'table' ? 'bg-white text-black' : 'text-[#8e8e93] hover:text-white'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="aspect-square bg-white/5 rounded-2xl" />
            ))}
          </div>
        ) : viewMode === 'table' ? (
          /* ============================================================
             TABLE / LIST VIEW
             ============================================================ */
          <div className="bg-[#161618] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1c1c1e] text-[#8e8e93] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-center">#</th>
                    <th className="p-3">Title & Artist</th>
                    <th className="p-3 hidden sm:table-cell">Album</th>
                    <th className="p-3 hidden md:table-cell">Genre</th>
                    <th className="p-3 hidden lg:table-cell">Year</th>
                    <th className="p-3 text-right pr-4">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredSongs.map((song, idx) => {
                    const isCurrent = currentSong?.id === song.id;
                    const isFav = isFavorite(song.id);
                    return (
                      <tr
                        key={song.id}
                        onClick={() => playSong(song, filteredSongs)}
                        className={`hover:bg-white/[0.04] transition-colors cursor-pointer group ${
                          isCurrent ? 'bg-white/[0.06]' : ''
                        }`}
                      >
                        <td className="p-3 pl-4 text-center text-[#8e8e93] font-mono group-hover:text-white">
                          {isCurrent && isPlaying ? (
                            <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping" />
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="p-3 flex items-center gap-3 min-w-[180px]">
                          <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/5 shadow-sm">
                            <img
                              src={song.cover_url}
                              alt={song.title}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="truncate">
                            <div className="font-semibold text-white truncate group-hover:text-zinc-200 flex items-center gap-1.5">
                              <span className="truncate">{song.title}</span>
                              {!isSongArtworkVerified(song) && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[8px] font-bold text-amber-400 shrink-0">
                                  Review
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#8e8e93] truncate">
                              {song.artist_name}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-[#8e8e93] truncate max-w-xs hidden sm:table-cell">
                          {song.album_name || song.title}
                        </td>
                        <td className="p-3 text-[#8e8e93] hidden md:table-cell">
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-zinc-300">
                            {song.genre}
                          </span>
                        </td>
                        <td className="p-3 text-[#8e8e93] font-mono hidden lg:table-cell">
                          {song.release_year || '—'}
                        </td>
                        <td className="p-3 text-right pr-4 font-mono text-[#8e8e93]">
                          {formatDuration(song.duration)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ============================================================
             RESPONSIVE GRID VIEW (Using available desktop viewport)
             ============================================================ */
          <div className="space-y-8">
            {/* 1. PLAYLISTS (shown in 'all' and 'playlists' tabs) */}
            {(activeTab === 'all' || activeTab === 'playlists') && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Playlists
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {/* Liked Songs Special Card */}
                  <div
                    onClick={() => setActiveTab('favourites')}
                    className="group p-4 rounded-2xl bg-[#1c1c1e] hover:bg-[#242428] border border-white/10 cursor-pointer transition-all flex flex-col justify-between aspect-square select-none shadow-md active:scale-95"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-md">
                      <Heart className="w-5 h-5 fill-current" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-sm text-white">Liked Songs</h4>
                      <p className="text-[11px] text-[#8e8e93]">
                        {favorites.length} saved tracks
                      </p>
                    </div>
                  </div>

                  {/* Playlists */}
                  {filteredPlaylists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => onNavigate('playlist-detail', { id: pl.id })}
                      className="group p-3 rounded-2xl bg-[#161618] hover:bg-[#202024] border border-white/[0.06] hover:border-white/15 cursor-pointer transition-all select-none flex flex-col justify-between active:scale-95"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 shadow-md bg-zinc-900 shrink-0">
                        <PlaylistCover
                          songs={pl.songs}
                          fallbackUrl={pl.cover_url}
                          title={pl.title}
                          className="group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-semibold text-xs sm:text-sm text-white truncate">
                          {pl.title}
                        </h4>
                        <p className="text-[10px] text-[#8e8e93] truncate">
                          {pl.song_count || pl.songs?.length || 0} tracks
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 2. ALBUMS (shown in 'all' and 'albums' tabs) */}
            {(activeTab === 'all' || activeTab === 'albums') && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Albums & EPs ({filteredAlbums.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {filteredAlbums.slice(0, activeTab === 'albums' ? undefined : 12).map((album) => (
                    <div
                      key={album.id}
                      onClick={() => {
                        if (album.songs && album.songs.length > 0) {
                          playSong(album.songs[0], album.songs);
                        } else {
                          onNavigate('album-detail', { id: album.id });
                        }
                      }}
                      className="group p-3 rounded-2xl bg-[#161618] hover:bg-[#202024] border border-white/[0.06] hover:border-white/15 cursor-pointer transition-all select-none flex flex-col justify-between active:scale-95"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 shadow-md bg-zinc-900 shrink-0">
                        <img
                          src={album.cover_url}
                          alt={album.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-current translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-semibold text-xs sm:text-sm text-white truncate">
                          {album.title}
                        </h4>
                        <p className="text-[10px] text-[#8e8e93] truncate">
                          {album.artist_name} {album.release_year ? `• ${album.release_year}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. ARTISTS (shown in 'all' and 'artists' tabs) */}
            {(activeTab === 'all' || activeTab === 'artists') && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Artists ({filteredArtists.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {filteredArtists.slice(0, activeTab === 'artists' ? undefined : 12).map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => onNavigate('artist-detail', { id: artist.id })}
                      className="group p-4 rounded-2xl bg-[#161618] hover:bg-[#202024] border border-white/[0.06] hover:border-white/15 text-center cursor-pointer transition-all select-none flex flex-col items-center active:scale-95"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden mb-2.5 shadow-md border border-white/10 bg-zinc-900 shrink-0">
                        <img
                          src={artist.avatar_url}
                          alt={artist.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <h4 className="font-semibold text-xs sm:text-sm text-white truncate w-full px-1">
                        {artist.name}
                      </h4>
                      <p className="text-[10px] text-[#8e8e93] truncate mt-0.5">
                        {artist.songs?.length || 1} tracks
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. ALL 910 SONGS IN GRID (shown in 'all', 'tracks', and 'favourites' tabs) */}
            {(activeTab === 'all' || activeTab === 'tracks' || activeTab === 'favourites') && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {activeTab === 'favourites' ? 'Liked Songs' : 'Songs'} ({filteredSongs.length})
                  </h3>
                  {activeTab === 'all' && (
                    <button
                      onClick={() => setActiveTab('tracks')}
                      className="text-xs text-[#8e8e93] hover:text-white transition-colors"
                    >
                      View all {songs.length} tracks &rarr;
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {filteredSongs.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const isFav = isFavorite(song.id);
                    return (
                      <LibrarySongCard
                        key={song.id}
                        song={song}
                        playlist={filteredSongs}
                        isPlaying={isPlaying}
                        isCurrent={isCurrent}
                        onPlay={() => playSong(song, filteredSongs)}
                        isFav={isFav}
                        onToggleFav={() => toggleFavorite(song)}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
