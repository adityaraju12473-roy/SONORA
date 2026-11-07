import React from 'react';
import { Play, Pause, Heart } from 'lucide-react';
import { Song, NavView } from '../types';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { useSongArtwork } from '../hooks/useSongArtwork';

interface SongCardProps {
  song: Song;
  contextQueue?: Song[];
  onNavigate?: (view: NavView, payload?: any) => void;
  fixedWidth?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  contextQueue,
  onNavigate,
  fixedWidth = false,
}) => {
  const { currentSong, isPlaying, playSong, togglePlayPause } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const resolvedCover = useSongArtwork(song);

  const isCurrent = currentSong?.id === song.id;
  const isFav = isFavorite(song.id);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlayPause();
    } else {
      // Pass song with resolved cover into player context so player & modal show it
      const songWithCover: Song = {
        ...song,
        cover_url: resolvedCover || song.cover_url,
      };
      playSong(songWithCover, contextQueue);
    }
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`group relative p-4 rounded-2xl bg-[#090914]/90 hover:bg-[#101024] border transition-all duration-300 flex flex-col justify-between shrink-0 select-none cursor-pointer hover:-translate-y-1.5 ${
        isCurrent
          ? 'border-cyan-400/60 shadow-[0_0_25px_rgba(0,240,255,0.25)] bg-[#121226]'
          : 'border-white/[0.08] hover:border-cyan-400/50 hover:shadow-[0_20px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(0,240,255,0.15)]'
      } ${fixedWidth ? 'w-[200px] sm:w-[220px]' : 'w-full'}`}
    >
      {/* 1:1 Aspect Ratio Artwork Container with Holographic Rim */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3.5 shadow-xl bg-zinc-950 shrink-0 border border-white/10 group-hover:border-cyan-400/40 transition-colors">
        <img
          src={resolvedCover}
          alt={song.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
        />

        {/* Ambient Holographic Gradient on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Live Audio Equalizer Badge when Active */}
        {isCurrent && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-cyan-400/50 flex items-center gap-1.5 shadow-lg z-10">
            <div className="flex items-end gap-0.5 h-3">
              <span className="cyber-eq-bar" />
              <span className="cyber-eq-bar" />
              <span className="cyber-eq-bar" />
            </div>
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-300">
              {isPlaying ? 'STREAMING' : 'PAUSED'}
            </span>
          </div>
        )}

        {/* Floating Neon Cyber Play Button Overlay */}
        <button
          onClick={handlePlayClick}
          className={`absolute bottom-3 right-3 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-10 ${
            isCurrent
              ? 'bg-gradient-to-r from-cyan-400 to-brand-neon text-black opacity-100 scale-100 shadow-[0_0_20px_rgba(0,240,255,0.6)] ring-2 ring-cyan-300/60'
              : 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 text-black opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 scale-95 group-hover:scale-100 shadow-[0_0_20px_rgba(0,240,255,0.5)]'
          }`}
          aria-label={isCurrent && isPlaying ? 'Pause' : 'Play'}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Favorite Heart Top Right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(song);
          }}
          className={`absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 transition-all z-10 ${
            isFav
              ? 'opacity-100 text-rose-500 border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
              : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white hover:border-white/30'
          }`}
          aria-label={isFav ? 'Unlike' : 'Like'}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Song Details with Crisp Cyberpunk Typography */}
      <div className="min-w-0 w-full space-y-1.5">
        <h4
          className={`font-bold text-sm sm:text-base leading-snug truncate transition-colors font-display ${
            isCurrent
              ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]'
              : 'text-white group-hover:text-cyan-300'
          }`}
          title={song.title}
        >
          {song.title}
        </h4>

        <div className="flex items-center justify-between text-xs text-zinc-400 gap-2">
          <span
            onClick={(e) => {
              if (song.artist_id && onNavigate) {
                e.stopPropagation();
                onNavigate('artist-detail', { id: song.artist_id });
              }
            }}
            className="truncate hover:text-white font-medium text-xs text-zinc-300 transition-colors cursor-pointer"
            title={song.artist_name}
          >
            {song.artist_name}
          </span>

          <span className="text-[10px] uppercase font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-md shrink-0">
            {song.genre || 'HIFI'}
          </span>
        </div>
      </div>
    </div>
  );
};
