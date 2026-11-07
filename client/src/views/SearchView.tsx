import React, { useState, useEffect } from 'react';
import { Search, Music2, User, Disc3, ListMusic, X, Play, Heart } from 'lucide-react';
import { Song, Album, Artist, Playlist, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { useSongArtwork } from '../hooks/useSongArtwork';
import { PlaylistCover } from '../components/PlaylistCover';
import { deriveAlbumsAndArtistsFromSongs } from '../utils/catalogueHelpers';

interface SearchViewProps {
  initialQuery?: string;
  onNavigate: (view: NavView, payload?: any) => void;
}

type SearchTab = 'all' | 'songs' | 'artists' | 'albums' | 'playlists';

/**
 * Individual Search Song Card with artwork hook
 */
const SearchSongCard: React.FC<{
  song: Song;
  playlist: Song[];
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: () => void;
  isFav: boolean;
  onToggleFav: () => void;
}> = ({ song, isPlaying, isCurrent, onPlay, isFav, onToggleFav }) => {
  const artwork = useSongArtwork(song);

  return (
    <div
      onClick={onPlay}
      className={`group relative p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex flex-col justify-between active:scale-[0.98] ${
        isCurrent
          ? 'bg-[#202024] border-white/20 shadow-md'
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
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 fill-current translate-x-0.5" />
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

export const SearchView: React.FC<SearchViewProps> = ({ initialQuery = '', onNavigate }) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('sonora_recent_searches');
    return saved ? JSON.parse(saved) : ['Arijit Singh', 'Sonu Nigam', 'Electronic', 'Lossless'];
  });
  const [loading, setLoading] = useState(false);

  const { currentSong, isPlaying, playSong } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const performSearch = async () => {
      setLoading(true);
      try {
        const [allSongs, allAlbums, allArtists, allPlaylists] = await Promise.all([
          api.getSongs(query.trim() ? { search: query.trim() } : undefined).catch(() => []),
          api.getAlbums().catch(() => []),
          api.getArtists().catch(() => []),
          api.getPlaylists().catch(() => []),
        ]);

        // Enrich albums and artists if database tables are unpopulated
        let effectiveAlbums = allAlbums;
        let effectiveArtists = allArtists;
        if (allSongs.length > 0 && (allAlbums.length === 0 || allArtists.length === 0)) {
          const { albums: derivedAlbums, artists: derivedArtists } =
            deriveAlbumsAndArtistsFromSongs(allSongs);
          effectiveAlbums = allAlbums.length > 0 ? allAlbums : derivedAlbums;
          effectiveArtists = allArtists.length > 0 ? allArtists : derivedArtists;
        }

        const q = query.toLowerCase().trim();
        if (q) {
          setSongs(allSongs);
          setAlbums(
            effectiveAlbums.filter(
              (a) =>
                a.title.toLowerCase().includes(q) ||
                a.artist_name.toLowerCase().includes(q) ||
                (a.genre && a.genre.toLowerCase().includes(q))
            )
          );
          setArtists(
            effectiveArtists.filter(
              (art) =>
                art.name.toLowerCase().includes(q) ||
                (art.genre && art.genre.toLowerCase().includes(q))
            )
          );
          setPlaylists(allPlaylists.filter((p) => p.title.toLowerCase().includes(q)));
        } else {
          setSongs(allSongs);
          setAlbums(effectiveAlbums);
          setArtists(effectiveArtists);
          setPlaylists(allPlaylists);
        }
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectRecent = (term: string) => {
    setQuery(term);
  };

  const removeRecent = (term: string) => {
    const updated = recentSearches.filter((t) => t !== term);
    setRecentSearches(updated);
    localStorage.setItem('sonora_recent_searches', JSON.stringify(updated));
  };

  const tabs: { id: SearchTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All Results' },
    { id: 'songs', label: `Songs (${songs.length})` },
    { id: 'artists', label: `Artists (${artists.length})` },
    { id: 'albums', label: `Albums (${albums.length})` },
    { id: 'playlists', label: `Playlists (${playlists.length})` },
  ];

  return (
    <div className="min-h-full w-full bg-[#000000] text-white">
      {/* Responsive Container for 1920px, 1366px, 768px and 390px */}
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-44 space-y-7">
        
        {/* Search Header & Input */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Search
          </h1>

          <div className="relative w-full max-w-2xl">
            <Search className="w-4 h-4 text-[#8e8e93] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by track, artist, album, genre..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#161618] border border-white/10 focus:border-white/30 rounded-full pl-11 pr-11 py-3 text-sm text-white placeholder-[#8e8e93] focus:outline-none shadow-lg transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Recent Searches Chips */}
        {recentSearches.length > 0 && !query && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">
              Recent Searches
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <div
                  key={term}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#161618] hover:bg-[#202024] border border-white/[0.06] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <span onClick={() => handleSelectRecent(term)}>{term}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecent(term);
                    }}
                    className="text-[#8e8e93] hover:text-white ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-white/[0.08]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

        {/* Search Results */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="aspect-square bg-white/5 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* 1. SONGS */}
            {(activeTab === 'all' || activeTab === 'songs') && songs.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Songs ({songs.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {songs.slice(0, activeTab === 'songs' ? undefined : 16).map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const isFav = isFavorite(song.id);
                    return (
                      <SearchSongCard
                        key={song.id}
                        song={song}
                        playlist={songs}
                        isPlaying={isPlaying}
                        isCurrent={isCurrent}
                        onPlay={() => playSong(song, songs)}
                        isFav={isFav}
                        onToggleFav={() => toggleFavorite(song)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. ARTISTS */}
            {(activeTab === 'all' || activeTab === 'artists') && artists.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Artists ({artists.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {artists.slice(0, activeTab === 'artists' ? undefined : 12).map((artist) => (
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

            {/* 3. ALBUMS */}
            {(activeTab === 'all' || activeTab === 'albums') && albums.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Albums ({albums.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {albums.slice(0, activeTab === 'albums' ? undefined : 12).map((album) => (
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

            {/* 4. PLAYLISTS */}
            {(activeTab === 'all' || activeTab === 'playlists') && playlists.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Playlists ({playlists.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
                  {playlists.map((pl) => (
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
          </div>
        )}
      </div>
    </div>
  );
};
