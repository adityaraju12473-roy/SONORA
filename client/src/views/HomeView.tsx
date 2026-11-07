import React, { useEffect, useState, useRef } from 'react';
import {
  Play,
  Pause,
  Sparkles,
  Flame,
  Disc3,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Plus,
  ListMusic,
  Music2,
  Zap,
  Activity,
  Layers,
  Volume2,
} from 'lucide-react';
import { Song, Album, Artist, Playlist, NavView, ListeningHistoryItem } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { SongCard } from '../components/SongCard';
import { useSongArtwork } from '../hooks/useSongArtwork';
import { getImmediateSongArtwork } from '../utils/artworkResolver';

interface HomeViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

/**
 * Sub-component for individual Recent Transmission card
 * with dedicated artwork resolution hook
 */
const RecentTransmissionCard: React.FC<{
  song: Song;
  playlist: Song[];
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: () => void;
}> = ({ song, playlist, isPlaying, isCurrent, onPlay }) => {
  const artwork = useSongArtwork(song);

  return (
    <div
      onClick={onPlay}
      className={`group flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 select-none cursor-pointer hover:-translate-y-1 ${
        isCurrent
          ? 'bg-[#121228] border-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,0.2)]'
          : 'bg-[#090914]/90 hover:bg-[#121226] border-white/[0.08] hover:border-cyan-400/40 hover:shadow-xl hover:shadow-black/70'
      }`}
    >
      <div className="flex items-center gap-3.5 truncate min-w-0 pr-2">
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-950 shadow-md border border-white/10 group-hover:border-cyan-400/40 transition-colors">
          <img
            src={artwork}
            alt={song.title}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
          />
        </div>
        <div className="truncate min-w-0 space-y-0.5">
          <span className="font-bold text-sm text-white truncate block group-hover:text-cyan-300 transition-colors font-display">
            {song.title}
          </span>
          <span className="text-xs text-zinc-400 truncate block font-sans">
            {song.artist_name}
          </span>
        </div>
      </div>

      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
          isCurrent && isPlaying
            ? 'bg-gradient-to-r from-cyan-400 to-brand-neon text-black shadow-[0_0_15px_rgba(0,240,255,0.6)] opacity-100'
            : 'bg-white/10 text-white opacity-0 group-hover:opacity-100 group-hover:scale-105'
        }`}
      >
        {isCurrent && isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current translate-x-0.5" />
        )}
      </div>
    </div>
  );
};

/**
 * Sub-component for individual Recently Added Song Row
 * with dedicated artwork resolution hook
 */
const RecentSongRow: React.FC<{
  song: Song;
  index: number;
  playlist: Song[];
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  isFav: boolean;
  formatDuration: (s: number) => string;
}> = ({
  song,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onToggleFavorite,
  isFav,
  formatDuration,
}) => {
  const artwork = useSongArtwork(song);

  return (
    <div
      onClick={onPlay}
      className={`group flex items-center justify-between p-3.5 sm:p-4 transition-colors cursor-pointer select-none ${
        isCurrent ? 'bg-cyan-950/30 text-cyan-300' : 'hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <span className="w-7 text-center text-xs font-mono font-bold text-zinc-500 group-hover:text-cyan-400">
          {isCurrent && isPlaying ? (
            <div className="flex items-end justify-center gap-0.5 h-3">
              <span className="cyber-eq-bar" />
              <span className="cyber-eq-bar" />
              <span className="cyber-eq-bar" />
            </div>
          ) : (
            `#${index + 1}`
          )}
        </span>
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-950 shadow-md border border-white/10 group-hover:border-cyan-400/40 transition-colors">
          <img
            src={artwork}
            alt={song.title}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
          />
        </div>
        <div className="truncate min-w-0 pr-4 space-y-0.5">
          <div
            className={`font-bold text-sm sm:text-base truncate transition-colors font-display ${
              isCurrent ? 'text-cyan-300' : 'text-white group-hover:text-cyan-300'
            }`}
          >
            {song.title}
          </div>
          <div className="text-xs text-zinc-400 truncate">
            {song.artist_name} • <span className="text-zinc-500">{song.album_name || 'Cloud Stream'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 text-xs text-zinc-400">
        <span className="hidden sm:inline px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-cyan-950/50 border border-cyan-500/30 text-cyan-300 uppercase">
          {song.genre || 'HIFI'}
        </span>
        <span className="font-mono text-zinc-400 text-xs sm:text-sm">
          {formatDuration(song.duration)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          title={isFav ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`w-4 h-4 ${
              isFav ? 'fill-current text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'text-zinc-500 hover:text-white'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const { user, isAuthenticated } = useAuth();
  const { playSong, addToQueue, currentSong, isPlaying, togglePlayPause } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [historyItems, setHistoryItems] = useState<ListeningHistoryItem[]>([]);
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenreFilter, setActiveGenreFilter] = useState<string>('all');

  // Horizontal scroll container refs
  const trendingRef = useRef<HTMLDivElement | null>(null);
  const albumsRef = useRef<HTMLDivElement | null>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement | null>, distance: number) => {
    if (ref.current) {
      ref.current.scrollBy({ left: distance, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [songsData, albumsData, artistsData, playlistsData, historyData, recsData] =
          await Promise.all([
            api.getSongs().catch(() => []),
            api.getAlbums().catch(() => []),
            api.getArtists().catch(() => []),
            api.getPlaylists().catch(() => []),
            api.getListeningHistory().catch(() => []),
            api.getRecommendations().catch(() => []),
          ]);
        setSongs(songsData);
        setAlbums(albumsData);
        setArtists(artistsData);
        setPlaylists(playlistsData);
        setHistoryItems(historyData);
        setRecommendations(recsData);
      } catch (err) {
        console.error('Failed to load home data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const featuredSong = songs.find((s) => s.is_featured) || songs[0];
  const featuredArtwork = useSongArtwork(featuredSong);
  const aishuPlaylist = playlists.find((p) => p.title.toLowerCase() === 'aishu');

  const filteredSongs =
    activeGenreFilter === 'all'
      ? songs
      : songs.filter((s) => s.genre?.toLowerCase().includes(activeGenreFilter.toLowerCase()));

  const trendingSongs =
    filteredSongs.filter((s) => s.is_trending).length > 0
      ? filteredSongs.filter((s) => s.is_trending)
      : filteredSongs.slice(0, 10);

  const recentlyAddedSongs = [...filteredSongs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const recentlyPlayedList: Song[] =
    historyItems.length > 0
      ? historyItems.map((h) => h.song).filter((s): s is Song => Boolean(s)).slice(0, 6)
      : songs.slice(0, 6);

  const isFeaturedPlaying = currentSong?.id === featuredSong?.id && isPlaying;

  if (loading) {
    return (
      <div className="p-6 md:p-12 space-y-10 animate-pulse">
        <div className="h-8 w-80 bg-white/5 rounded-full" />
        <div className="h-12 w-64 bg-white/5 rounded-2xl" />
        <div className="h-96 bg-white/5 rounded-3xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 md:px-12 py-8 space-y-12 sm:space-y-16 w-full pb-36 relative select-none">
      {/* Background Holographic Atmosphere */}
      <div className="absolute top-0 right-1/4 w-[550px] h-[400px] ambient-glow-cyan pointer-events-none -z-10" />
      <div className="absolute top-48 left-10 w-[500px] h-[450px] ambient-glow-pink pointer-events-none -z-10" />

      {/* 1. FUTURISTIC HUD TELEMETRY & GREETING */}
      <div className="space-y-5">
        {/* Telemetry Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-5 rounded-2xl bg-[#090914]/90 border border-white/[0.08] backdrop-blur-xl text-xs font-mono tracking-wider shadow-lg">
          <div className="flex items-center gap-3.5">
            <span className="flex items-center gap-2 text-cyan-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              </span>
              SONORA AUDIO CORE v2.0
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 hidden sm:inline">
              CDN ENGINE: <span className="text-white font-semibold">CLOUDINARY PIPELINE</span>
            </span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-zinc-400">
              CATALOGUE: <span className="text-cyan-300 font-bold">{songs.length} TRACKS</span>
            </span>
          </div>

          <div className="flex items-center gap-3.5 text-zinc-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              LOSSLESS STREAM VERIFIED
            </span>
            <span className="text-zinc-600 hidden md:inline">•</span>
            <span className="hidden md:inline font-mono text-[11px] text-zinc-400">
              48kHz / 24-BIT HI-RES
            </span>
          </div>
        </div>

        {/* Greeting & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pt-2">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest mb-1.5 font-bold">
              <Zap className="w-4 h-4 text-cyan-400 fill-current" />
              <span>Neural Audio Interface</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-display">
              {getGreeting()}
              {user && (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-pink-500 font-black ml-2.5">
                  , {user.full_name.split(' ')[0]}
                </span>
              )}
            </h1>
          </div>

          {songs.length > 0 && (
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  const randomIdx = Math.floor(Math.random() * songs.length);
                  const song = songs[randomIdx];
                  const resolved = getImmediateSongArtwork(song);
                  playSong({ ...song, cover_url: resolved }, songs);
                }}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-white font-mono font-bold text-xs sm:text-sm shadow-xl shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95"
              >
                <Shuffle className="w-4 h-4" />
                <span>CYBER SHUFFLE ({songs.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Holographic Vibe / Genre Filters */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Frequencies' },
            { id: 'Soundtrack', label: 'Cinematic' },
            { id: 'Synthwave', label: 'Synthwave' },
            { id: 'Neo-Soul', label: 'Neo-Soul' },
            { id: 'Acoustic', label: 'Acoustic' },
            { id: 'Electronic', label: 'Electronic' },
          ].map((filter) => {
            const isActive = activeGenreFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setActiveGenreFilter(filter.id)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-400 to-brand-neon text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] font-black'
                    : 'bg-[#0e0e1a]/90 text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08]'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CINEMATIC HOLOGRAPHIC FEATURED SOUNDSCAPE HERO */}
      {featuredSong && (
        <section className="relative overflow-hidden rounded-3xl border-2 border-cyan-500/40 bg-gradient-to-br from-[#120f26] via-[#0b0a18] to-[#05050e] p-6 sm:p-10 md:p-12 shadow-[0_25px_60px_rgba(0,0,0,0.95)] group">
          {/* Subtle Cyber Scanline Overlay */}
          <div className="absolute inset-0 cyber-scanlines opacity-25 z-0" />

          {/* Ambient Holographic Glow */}
          <div
            className="absolute -right-20 -top-20 w-[550px] h-[550px] opacity-30 filter blur-3xl rounded-full pointer-events-none transition-all duration-1000 z-0"
            style={{
              backgroundImage: `radial-gradient(circle, rgba(0, 240, 255, 0.7) 0%, rgba(255, 0, 127, 0.35) 50%, transparent 80%)`,
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 lg:gap-14 justify-between">
            {/* Left: Metadata & High-Tech HUD Details */}
            <div className="flex-1 space-y-5 text-center lg:text-left min-w-0">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-widest shadow-md">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>MASTER SPOTLIGHT // LOSSLESS DIRECT</span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
              </div>

              <div className="space-y-2.5">
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.08] font-display drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                  {featuredSong.title}
                </h2>
                <p className="text-base sm:text-lg text-zinc-300 font-medium">
                  By{' '}
                  <span
                    onClick={() => {
                      if (featuredSong.artist_id) {
                        onNavigate('artist-detail', { id: featuredSong.artist_id });
                      }
                    }}
                    className="font-bold text-cyan-300 hover:text-cyan-200 cursor-pointer underline-offset-4 hover:underline transition-colors"
                  >
                    {featuredSong.artist_name}
                  </span>{' '}
                  • <span className="text-zinc-400">{featuredSong.album_name || 'Original Cloud Stream'}</span> •{' '}
                  <span className="text-zinc-400">{featuredSong.release_year || '2024'}</span>
                </p>
              </div>

              {/* Spec Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1 text-xs text-zinc-400 font-mono">
                <span className="px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-400/40 text-cyan-300 font-bold tracking-wider shadow-sm">
                  24-BIT / 96 kHz LOSSLESS
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-zinc-200 font-semibold">
                  {featuredSong.genre || 'Soundscape'}
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 font-mono">
                  {formatDuration(featuredSong.duration)}
                </span>
              </div>

              {/* Controls */}
              <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <button
                  onClick={() => {
                    if (isFeaturedPlaying) {
                      togglePlayPause();
                    } else {
                      playSong({ ...featuredSong, cover_url: featuredArtwork }, songs);
                    }
                  }}
                  className="flex items-center gap-3 px-8 sm:px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 text-black font-mono font-black text-xs sm:text-sm shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:shadow-[0_0_40px_rgba(0,240,255,0.75)] transition-all hover:scale-105 active:scale-95"
                >
                  {isFeaturedPlaying ? (
                    <>
                      <Pause className="w-5 h-5 fill-current" />
                      <span>PAUSE AUDIO STREAM</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current translate-x-0.5" />
                      <span>PLAY MASTER TRACK</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => addToQueue({ ...featuredSong, cover_url: featuredArtwork })}
                  className="flex items-center gap-2 px-5 py-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-mono font-bold text-xs sm:text-sm border border-white/10 hover:border-cyan-400/40 transition-all hover:scale-105"
                  title="Add to queue"
                >
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>QUEUE</span>
                </button>

                <button
                  onClick={() => toggleFavorite(featuredSong)}
                  className={`p-4 rounded-2xl border transition-all hover:scale-105 ${
                    isFavorite(featuredSong.id)
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-zinc-400 hover:text-white'
                  }`}
                  title={isFavorite(featuredSong.id) ? 'Favorited' : 'Add to Favorites'}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite(featuredSong.id) ? 'fill-current text-rose-500' : ''
                    }`}
                  />
                </button>

                {featuredSong.album_id && (
                  <button
                    onClick={() => onNavigate('album-detail', { id: featuredSong.album_id })}
                    className="px-6 py-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white font-mono text-xs sm:text-sm border border-white/10 transition-colors"
                  >
                    ALBUM SPEC
                  </button>
                )}
              </div>
            </div>

            {/* Right: Enlarged Cinematic Holographic Vinyl & Illuminated Artwork */}
            <div className="relative shrink-0 flex items-center justify-center w-72 h-72 sm:w-84 sm:h-84 md:w-96 md:h-96 lg:w-[400px] lg:h-[400px]">
              {/* Rotating Holographic Disc */}
              <div
                className={`absolute w-64 h-64 sm:w-76 sm:h-76 md:w-84 md:h-84 lg:w-[360px] lg:h-[360px] rounded-full bg-[#06060e] border-4 border-[#16162a] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex items-center justify-center transition-all duration-700 ${
                  isFeaturedPlaying
                    ? 'translate-x-16 sm:translate-x-20 md:translate-x-24 rotate-180 animate-spin-slow ring-2 ring-cyan-400/50 shadow-[0_0_30px_rgba(0,240,255,0.3)]'
                    : 'translate-x-8 sm:translate-x-12 group-hover:translate-x-16'
                }`}
              >
                {/* Holographic Grooves */}
                <div className="w-56 h-56 sm:w-68 sm:h-68 md:w-76 md:h-76 lg:w-[310px] lg:h-[310px] rounded-full border border-cyan-500/15 flex items-center justify-center">
                  <div className="w-44 h-44 sm:w-52 sm:h-52 md:w-60 md:h-60 lg:w-[240px] lg:h-[240px] rounded-full border border-pink-500/15 flex items-center justify-center">
                    <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full border border-cyan-400/30 bg-gradient-to-tr from-cyan-950/60 via-purple-950/40 to-pink-950/50 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#080812] border-2 border-white/40 shadow-[0_0_10px_#00f0ff]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Album Cover Sleeve with Glowing Border */}
              <div
                onClick={() => {
                  if (isFeaturedPlaying) togglePlayPause();
                  else playSong({ ...featuredSong, cover_url: featuredArtwork }, songs);
                }}
                className="relative z-10 w-64 h-64 sm:w-76 sm:h-76 md:w-84 md:h-84 lg:w-[360px] lg:h-[360px] rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] bg-zinc-950 border-2 border-white/20 cursor-pointer group-hover:scale-105 group-hover:border-cyan-400/60 transition-all duration-300 ring-1 ring-cyan-400/20"
              >
                <img
                  src={featuredArtwork}
                  alt={featuredSong.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-xs">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-400 to-brand-neon text-black flex items-center justify-center shadow-[0_0_25px_rgba(0,240,255,0.7)] hover:scale-110 transition-transform">
                    {isFeaturedPlaying ? (
                      <Pause className="w-8 h-8 fill-current" />
                    ) : (
                      <Play className="w-8 h-8 fill-current translate-x-0.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. AISHU COLLECTION FLAGSHIP ARCHIVE SHOWCASE */}
      <section className="relative overflow-hidden rounded-3xl border border-pink-500/40 bg-gradient-to-r from-[#170e28] via-[#1b1033] to-[#100b1e] p-6 sm:p-10 shadow-2xl group">
        <div className="absolute -left-10 top-0 w-72 h-72 ambient-glow-pink opacity-35 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
          <div className="flex items-center gap-5 sm:gap-7 min-w-0">
            <div
              onClick={() => onNavigate('playlist-detail', { id: aishuPlaylist?.id || 'pl-aishu' })}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shrink-0 shadow-2xl border-2 border-pink-500/50 cursor-pointer group-hover:scale-105 transition-transform"
            >
              <img
                src={
                  aishuPlaylist?.cover_url ||
                  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80'
                }
                alt="AISHU"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-purple-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-10 h-10 text-white fill-current" />
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-[10px] font-mono font-bold text-pink-300 uppercase tracking-widest shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>FLAGSHIP ARCHIVE // AISHU</span>
              </div>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight font-display">
                AISHU Collection
              </h3>
              <p className="text-sm sm:text-base text-zinc-300 max-w-xl line-clamp-2 leading-relaxed">
                Personal collection of 261 downloaded songs ingested and preserved with original audio fidelity, full ID3 metadata, and unbroken HTTP range seeking.
              </p>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-pink-300/90 font-mono pt-1">
                <span className="font-bold">{aishuPlaylist?.songs?.length || 261} TRACKS</span>
                <span>•</span>
                <span>ORIGINAL MASTER AUDIO</span>
                <span>•</span>
                <span className="text-cyan-400 font-bold">CLOUDINARY CDN</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                if (aishuPlaylist?.songs && aishuPlaylist.songs.length > 0) {
                  playSong(aishuPlaylist.songs[0], aishuPlaylist.songs);
                } else {
                  onNavigate('playlist-detail', { id: aishuPlaylist?.id || 'pl-aishu' });
                }
              }}
              className="flex-1 md:flex-initial flex items-center justify-center gap-3 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-mono font-bold text-xs sm:text-sm shadow-xl shadow-pink-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current translate-x-0.5" />
              <span>PLAY AISHU STREAM</span>
            </button>

            <button
              onClick={() =>
                onNavigate('playlist-detail', { id: aishuPlaylist?.id || 'pl-aishu' })
              }
              className="px-6 py-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-mono font-bold text-xs sm:text-sm border border-white/10 transition-colors"
            >
              EXPLORE ARCHIVE
            </button>
          </div>
        </div>
      </section>

      {/* 4. RECENT TRANSMISSIONS (Recently Played) */}
      {recentlyPlayedList.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shadow-md">
                <Clock className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                  Recent Transmissions
                </h3>
                <p className="text-sm text-zinc-300 font-medium hidden sm:block">
                  Jump back into your recent holographic music sessions
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('history')}
              className="text-xs sm:text-sm font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              FULL LOG →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {recentlyPlayedList.map((song) => {
              const isItemPlaying = currentSong?.id === song.id && isPlaying;
              const isCurrent = currentSong?.id === song.id;
              return (
                <RecentTransmissionCard
                  key={song.id}
                  song={song}
                  playlist={recentlyPlayedList}
                  isPlaying={isItemPlaying}
                  isCurrent={isCurrent}
                  onPlay={() => {
                    const artwork = getImmediateSongArtwork(song);
                    playSong({ ...song, cover_url: artwork }, recentlyPlayedList);
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* 5. NEURAL MIXES (Atmospheric Frequencies) */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/15 border border-pink-400/30 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                Neural Soundscape Mixes
              </h3>
              <p className="text-sm text-zinc-300 font-medium hidden sm:block">
                Atmospheric frequencies tuned to your creative rhythm
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {[
            {
              title: 'Cyberpunk & Synthwave',
              desc: 'High-octane modular electronics, driving basslines, and neon arpeggios.',
              color: 'from-cyan-900/40 via-purple-950/40 to-[#090914]',
              borderColor: 'border-cyan-500/40',
              img: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=600&q=80',
              genre: 'Synthwave',
            },
            {
              title: 'Neo-Soul & Midnight',
              desc: 'Silky vocal textures, warm Rhodes chords, and hypnotic downtempo beats.',
              color: 'from-pink-900/40 via-purple-950/40 to-[#090914]',
              borderColor: 'border-pink-500/40',
              img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
              genre: 'Neo-Soul',
            },
            {
              title: 'Acoustic Sanctuary',
              desc: 'Intimate acoustic strings, organic warmth, and resonant harmonies.',
              color: 'from-amber-900/40 via-yellow-950/40 to-[#090914]',
              borderColor: 'border-amber-500/40',
              img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
              genre: 'Acoustic',
            },
            {
              title: 'Deep Immersion',
              desc: 'Four-on-the-floor hypnotic minimal electronic frequencies.',
              color: 'from-emerald-900/40 via-teal-950/40 to-[#090914]',
              borderColor: 'border-emerald-500/40',
              img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
              genre: 'Electronic',
            },
          ].map((mix, idx) => (
            <div
              key={idx}
              onClick={() => {
                const matching = songs.filter(
                  (s) =>
                    s.genre.toLowerCase().includes(mix.genre.toLowerCase()) ||
                    s.title.toLowerCase().includes(mix.genre.toLowerCase())
                );
                if (matching.length > 0) {
                  const song = matching[0];
                  const artwork = getImmediateSongArtwork(song);
                  playSong({ ...song, cover_url: artwork }, matching);
                } else if (songs.length > 0) {
                  const song = songs[0];
                  const artwork = getImmediateSongArtwork(song);
                  playSong({ ...song, cover_url: artwork }, songs);
                }
              }}
              className={`group p-5 rounded-3xl bg-gradient-to-br ${mix.color} border ${mix.borderColor} hover:border-white/30 cursor-pointer transition-all duration-300 flex flex-col justify-between select-none min-h-[180px] shadow-xl hover:shadow-[0_16px_36px_rgba(0,0,0,0.8)] hover:-translate-y-1.5`}
            >
              <div className="flex items-start justify-between">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl border border-white/10 shrink-0">
                  <img src={mix.img} alt={mix.title} className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500" />
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-[0_0_20px_rgba(255,255,255,0.6)] transition-all group-hover:scale-110">
                  <Play className="w-5 h-5 fill-current translate-x-0.5" />
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <h4 className="font-extrabold text-base text-white group-hover:text-cyan-300 transition-colors font-display">
                  {mix.title}
                </h4>
                <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                  {mix.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. NEON VELOCITY (Trending Across Sonora) */}
      {trendingSongs.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center shadow-md">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                  Trending Streams
                </h3>
                <p className="text-sm text-zinc-300 font-medium hidden sm:block">
                  Most active frequencies across your cloud catalogue
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollContainer(trendingRef, -380)}
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all hover:scale-105"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollContainer(trendingRef, 380)}
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all hover:scale-105"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={trendingRef}
            className="flex gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none scroll-smooth w-full"
          >
            {trendingSongs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                contextQueue={trendingSongs}
                onNavigate={onNavigate}
                fixedWidth={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. INCOMING AUDIO TELEMETRY (Recently Added Cloud Tracks) */}
      {recentlyAddedSongs.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shadow-md">
                <Music2 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                  Recently Linked Tracks
                </h3>
                <p className="text-sm text-zinc-300 font-medium hidden sm:block">
                  Fresh audio assets from your 910 Cloudinary cloud catalogue
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('library')}
              className="text-xs sm:text-sm font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              EXPLORE ALL 910 IN LIBRARY →
            </button>
          </div>

          <div className="bg-[#090914]/90 border border-white/[0.08] rounded-3xl overflow-hidden divide-y divide-white/[0.04] shadow-2xl backdrop-blur-xl">
            {recentlyAddedSongs.map((song, idx) => {
              const isItemPlaying = currentSong?.id === song.id && isPlaying;
              return (
                <RecentSongRow
                  key={song.id}
                  song={song}
                  index={idx}
                  playlist={recentlyAddedSongs}
                  isCurrent={currentSong?.id === song.id}
                  isPlaying={isItemPlaying}
                  onPlay={() => {
                    const artwork = getImmediateSongArtwork(song);
                    playSong({ ...song, cover_url: artwork }, recentlyAddedSongs);
                  }}
                  onToggleFavorite={() => toggleFavorite(song)}
                  isFav={isFavorite(song.id)}
                  formatDuration={formatDuration}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* 8. MASTER ALBUMS CAROUSEL (If available) */}
      {albums.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-400/30 flex items-center justify-center shadow-md">
                <Disc3 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display">
                  Featured Master Albums
                </h3>
                <p className="text-sm text-zinc-300 font-medium hidden sm:block">
                  High-fidelity master recordings
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollContainer(albumsRef, -380)}
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all hover:scale-105"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollContainer(albumsRef, 380)}
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all hover:scale-105"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={albumsRef}
            className="flex gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none scroll-smooth w-full"
          >
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => onNavigate('album-detail', { id: album.id })}
                className="group w-48 sm:w-56 shrink-0 p-4 rounded-2xl bg-[#090914]/90 hover:bg-[#121226] border border-white/[0.08] hover:border-cyan-400/40 cursor-pointer transition-all duration-300 select-none flex flex-col justify-between shadow-xl hover:-translate-y-1.5"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3.5 shadow-xl bg-zinc-950 shrink-0 border border-white/10">
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-cyan-400 to-brand-neon text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.6)] group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>
                <div className="min-w-0 w-full space-y-1">
                  <h4 className="font-bold text-sm sm:text-base text-white truncate group-hover:text-cyan-300 transition-colors font-display">
                    {album.title}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate font-mono">
                    {album.artist_name} • {album.release_year}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
