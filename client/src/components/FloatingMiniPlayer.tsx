import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Play,
  Pause,
  Plus,
  Radio,
  ListMusic,
  Maximize2,
  Loader2,
  Cast,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useSongArtwork } from '../hooks/useSongArtwork';
import { usePlaylistModal } from '../context/PlaylistModalContext';

interface FloatingMiniPlayerProps {
  onToggleQueue?: () => void;
}

export const FloatingMiniPlayer: React.FC<FloatingMiniPlayerProps> = ({ onToggleQueue }) => {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    togglePlayPause,
    setIsExpandedPlayer,
    queue,
  } = useAudioPlayer();

  const { openAddToPlaylist } = usePlaylistModal();
  const resolvedCover = useSongArtwork(currentSong);
  const shouldReduceMotion = useReducedMotion();

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Native touch gesture tracking for upward swipe
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
    const velocityY = deltaY / (deltaTime || 1);

    // Upward swipe to expand: deltaY < -35px or velocity < -0.25px/ms
    if (deltaY < -35 || velocityY < -0.25) {
      setIsExpandedPlayer(true);
    }
    touchStartRef.current = null;
  };

  if (!currentSong) return null;

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.3, bottom: 0.05 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -30 || info.velocity.y < -150) {
          setIsExpandedPlayer(true);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      initial={shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.15 }
          : { type: 'spring', damping: 25, stiffness: 280 }
      }
      onClick={() => setIsExpandedPlayer(true)}
      className="fixed bottom-[74px] sm:bottom-[80px] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm sm:max-w-md select-none cursor-pointer"
      title="Tap or swipe up to expand Now Playing"
    >
      <div className="relative overflow-hidden flex items-center justify-between gap-3 px-3.5 py-2 rounded-full bg-[#161618]/94 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.9)] hover:border-white/20 transition-all group">
        {/* Subtle Playback Progress Indicator Bar */}
        <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-white/10 rounded-full overflow-hidden pointer-events-none">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Left: Circular Album Thumbnail & Song Info */}
        <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
          <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/20 bg-zinc-900">
            <img
              src={resolvedCover}
              alt={currentSong.title}
              className={`w-full h-full object-cover transition-transform duration-500 ${
                isPlaying ? 'scale-105' : 'scale-100'
              }`}
            />
          </div>

          <div className="truncate min-w-0 space-y-0.5">
            <div className="text-xs sm:text-[13px] font-semibold text-white truncate leading-tight group-hover:text-zinc-200">
              {currentSong.title}
            </div>
            <div className="text-[10px] text-[#8e8e93] truncate leading-tight font-normal">
              {currentSong.artist_name}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Add to Playlist / Plus Button */}
          <button
            onClick={() => openAddToPlaylist(currentSong)}
            className="p-1.5 rounded-full text-[#8e8e93] hover:text-white hover:bg-white/10 transition-colors"
            title="Add to playlist"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Queue Drawer Button */}
          {onToggleQueue && (
            <button
              onClick={onToggleQueue}
              className="p-1.5 rounded-full text-[#8e8e93] hover:text-white hover:bg-white/10 transition-colors relative"
              title="View queue"
            >
              <ListMusic className="w-4 h-4" />
              {queue.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-white text-black text-[8px] font-black flex items-center justify-center">
                  {queue.length}
                </span>
              )}
            </button>
          )}

          {/* Circular Play / Pause Button (White Pill) */}
          <button
            onClick={togglePlayPause}
            className="w-7 h-7 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center shadow-md active:scale-90 transition-all shrink-0 ml-1"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isBuffering ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
            ) : isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

