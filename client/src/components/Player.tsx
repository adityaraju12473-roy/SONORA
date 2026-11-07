import React, { useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  Heart,
  ListMusic,
  ChevronUp,
  Loader2,
  Gauge,
  Radio,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { useSongArtwork } from '../hooks/useSongArtwork';
import { NavView } from '../types';

interface PlayerProps {
  onNavigate: (view: NavView, payload?: any) => void;
  onToggleQueue: () => void;
  isQueueOpen: boolean;
}

export const Player: React.FC<PlayerProps> = ({
  onNavigate,
  onToggleQueue,
  isQueueOpen,
}) => {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    shuffle,
    repeat,
    queue,
    togglePlayPause,
    seek,
    playNext,
    playPrevious,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleShuffle,
    cycleRepeat,
    setIsExpandedPlayer,
  } = useAudioPlayer();

  const { isFavorite, toggleFavorite } = useFavorites();
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const resolvedCover = useSongArtwork(currentSong);
  const shouldReduceMotion = useReducedMotion();

  // Touch swipe detection for upward gestures on Android & touch screens
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !currentSong) return;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocityY = deltaY / (deltaTime || 1); // px per ms

    // Swiped up: deltaY is negative (< -40px) or high upward velocity (velocityY < -0.25)
    if (deltaY < -40 || velocityY < -0.25) {
      setIsExpandedPlayer(true);
    }
    touchStartRef.current = null;
  };

  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isFav = currentSong ? isFavorite(currentSong.id) : false;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.footer
      drag={currentSong ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.35, bottom: 0.05 }}
      onDragEnd={(_, info) => {
        if (!currentSong) return;
        // Upward drag threshold: -35px or velocity < -180px/s
        if (info.offset.y < -35 || info.velocity.y < -180) {
          setIsExpandedPlayer(true);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      initial={false}
      transition={
        shouldReduceMotion
          ? { duration: 0.15 }
          : { type: 'spring', damping: 26, stiffness: 280 }
      }
      className="h-[84px] shrink-0 bg-[#070b09]/95 backdrop-blur-3xl border-t border-white/[0.08] px-3 sm:px-6 md:px-8 flex flex-col justify-center z-40 relative select-none shadow-[0_-12px_40px_rgba(0,0,0,0.85)] group/player touch-pan-x"
    >
      {/* Top Hairline Ambient Glow in Soft Green */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#1ed760]/50 to-transparent pointer-events-none" />

      {/* Interactive Drag Handle Pill for Mobile & Desktop */}
      {currentSong && (
        <div
          onClick={() => setIsExpandedPlayer(true)}
          className="w-full flex justify-center -mt-1 mb-1 cursor-grab active:cursor-grabbing py-1"
          title="Swipe or click to expand Now Playing"
        >
          <div className="w-10 h-1 rounded-full bg-white/20 group-hover/player:bg-[#1ed760] transition-colors" />
        </div>
      )}

      <div className="flex items-center justify-between w-full">
        {/* 1. LEFT: CURRENT SONG INFO & TELEMETRY (26% width) */}
        <div className="flex items-center gap-3 w-1/4 min-w-[160px] max-w-[280px]">
          {currentSong ? (
            <>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpandedPlayer(true);
                }}
                className="relative group cursor-pointer shrink-0 w-12 h-12 sm:w-13 sm:h-13 rounded-xl overflow-hidden shadow-xl border border-white/10 group-hover:border-[#1ed760]/60 bg-zinc-950 transition-all duration-300"
                title="Expand Now Playing"
              >
                <img
                  src={resolvedCover}
                  alt={currentSong.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                  <ChevronUp className="w-4 h-4 text-[#1ed760] drop-shadow-[0_0_8px_#1ed760]" />
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpandedPlayer(true);
                }}
                className="truncate flex-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <div
                    onClick={(e) => {
                      if (currentSong.album_id) {
                        e.stopPropagation();
                        onNavigate('album-detail', { id: currentSong.album_id });
                      }
                    }}
                    className="text-xs sm:text-sm font-display font-bold text-white truncate hover:text-[#1ed760] transition-colors"
                    title={currentSong.title}
                  >
                    {currentSong.title}
                  </div>
                  {/* Mini animated equalizer */}
                  {isPlaying && (
                    <div className="flex items-end gap-0.5 h-3 shrink-0 pb-0.5">
                      <span className="w-0.5 h-2 bg-[#1ed760] rounded-full animate-bounce shadow-[0_0_6px_#1ed760]" style={{ animationDelay: '0.1s' }} />
                      <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce shadow-[0_0_6px_#10b981]" style={{ animationDelay: '0.25s' }} />
                      <span className="w-0.5 h-1.5 bg-teal-300 rounded-full animate-bounce shadow-[0_0_6px_#2dd4bf]" style={{ animationDelay: '0.15s' }} />
                    </div>
                  )}
                </div>
                <div
                  onClick={(e) => {
                    if (currentSong.artist_id) {
                      e.stopPropagation();
                      onNavigate('artist-detail', { id: currentSong.artist_id });
                    }
                  }}
                  className="text-[11px] font-mono text-zinc-400 truncate hover:text-[#1ed760] transition-colors mt-0.5"
                  title={currentSong.artist_name}
                >
                  {currentSong.artist_name}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  currentSong && toggleFavorite(currentSong);
                }}
                className="p-1.5 rounded-xl hover:bg-white/[0.08] transition-colors shrink-0 ml-1"
                aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    isFav
                      ? 'text-[#1ed760] fill-[#1ed760] drop-shadow-[0_0_10px_rgba(30,215,96,0.7)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 text-zinc-500 text-xs">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-zinc-600" />
              </div>
              <div className="space-y-0.5">
                <div className="font-mono text-[10px] text-zinc-400 font-semibold tracking-wider">
                  SONORA CORE READY
                </div>
                <div className="text-[9px] text-zinc-600 font-mono">
                  Select a track to stream
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. CENTER: PLAYBACK CONTROLS & TIMELINE (48% width) */}
        <div className="flex flex-col items-center flex-1 max-w-xl px-2 sm:px-6">
          {/* Transport Buttons Row */}
          <div className="flex items-center gap-4 sm:gap-6 mb-1">
            {/* Shuffle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleShuffle();
              }}
              className={`p-1.5 rounded-xl hover:bg-white/[0.06] transition-all relative ${
                shuffle
                  ? 'text-[#1ed760] drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={shuffle ? 'Shuffle is ON' : 'Shuffle is OFF'}
            >
              <Shuffle className="w-4 h-4" />
              {shuffle && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full shadow-[0_0_6px_#1ed760]" />
              )}
            </button>

            {/* Previous Track */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playPrevious();
              }}
              disabled={!currentSong}
              className="p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 transition-transform active:scale-90"
              title="Previous track"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>

            {/* Soft Green Accent Circular Play / Pause Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              disabled={!currentSong && queue.length === 0}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-[0_0_18px_rgba(30,215,96,0.5)] hover:shadow-[0_0_26px_rgba(30,215,96,0.8)] hover:scale-105 active:scale-95 transition-all duration-200 shrink-0"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playNext();
              }}
              disabled={!currentSong}
              className="p-1.5 text-zinc-300 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300 transition-transform active:scale-90"
              title="Next track"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>

            {/* Repeat Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                cycleRepeat();
              }}
              className={`p-1.5 rounded-xl hover:bg-white/[0.06] transition-all relative ${
                repeat !== 'off'
                  ? 'text-[#1ed760] drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title={`Repeat mode: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              {repeat !== 'off' && (
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full shadow-[0_0_6px_#1ed760]" />
              )}
            </button>
          </div>

          {/* Seekbar and Timestamps with Soft Green Glow */}
          <div className="w-full flex items-center gap-2.5 text-[11px] text-zinc-400 font-mono group">
            <span className="w-9 text-right shrink-0">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center" onClick={(e) => e.stopPropagation()}>
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 group-hover:h-1.5 bg-gradient-to-r from-[#1db954] to-[#1ed760] rounded-full pointer-events-none transition-all shadow-[0_0_8px_rgba(30,215,96,0.6)]"
                style={{ width: `${progressPercent}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="w-full h-1 group-hover:h-1.5 relative z-10 cursor-pointer"
              />
            </div>
            <span className="w-9 text-left shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* 3. RIGHT: SPEED, VOLUME, QUEUE & EXPAND (26% width) */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 w-1/4 min-w-[160px]">
          {/* Playback Speed selector */}
          <div className="relative hidden md:block" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
              className="flex items-center gap-1 text-[11px] font-mono font-semibold text-zinc-400 hover:text-[#1ed760] px-2 py-1 rounded-xl hover:bg-white/[0.06] transition-all"
              title="Playback speed"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{playbackRate}x</span>
            </button>

            {speedMenuOpen && (
              <div
                className="absolute bottom-full mb-2 right-0 bg-[#0a0f0c]/98 border border-white/10 rounded-2xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50 flex flex-col gap-0.5 min-w-[110px]"
                onMouseLeave={() => setSpeedMenuOpen(false)}
              >
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setPlaybackRate(rate);
                      setSpeedMenuOpen(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-mono rounded-xl text-left transition-colors ${
                      playbackRate === rate
                        ? 'bg-[#1ed760]/20 text-[#1ed760] font-bold border border-[#1ed760]/30'
                        : 'text-zinc-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {rate}x {rate === 1 && '(Normal)'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Volume Controls */}
          <div className="hidden sm:flex items-center gap-2 group w-22 md:w-26" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={toggleMute}
              className="text-zinc-400 hover:text-[#1ed760] transition-colors shrink-0"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div className="relative flex-1 flex items-center">
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 group-hover:h-1.5 bg-gradient-to-r from-[#1db954] to-[#1ed760] rounded-full pointer-events-none transition-all shadow-[0_0_6px_rgba(30,215,96,0.4)]"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 group-hover:h-1.5 cursor-pointer"
              />
            </div>
          </div>

          {/* Queue Drawer Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleQueue();
            }}
            className={`p-2 rounded-xl border transition-all relative ${
              isQueueOpen
                ? 'bg-[#1ed760]/20 text-[#1ed760] border-[#1ed760]/40 shadow-[0_0_12px_rgba(30,215,96,0.25)]'
                : 'text-zinc-400 hover:text-white bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06]'
            }`}
            title="Play queue"
          >
            <ListMusic className="w-4 h-4" />
            {queue.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1ed760] text-black text-[9px] font-mono font-black flex items-center justify-center shadow-[0_0_8px_#1ed760]">
                {queue.length}
              </span>
            )}
          </button>

          {/* Fullscreen Expand / Swipe Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpandedPlayer(true);
            }}
            className="p-2 text-zinc-400 hover:text-[#1ed760] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl transition-all hover:border-[#1ed760]/40"
            title="Expand to Now Playing (or swipe up)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.footer>
  );
};
