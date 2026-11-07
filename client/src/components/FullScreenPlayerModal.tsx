import React, { useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Volume2,
  Volume1,
  VolumeX,
  ListPlus,
  ListMusic,
  Loader2,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  Copy,
  CornerDownRight,
  Music2,
  Check,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import { useToast } from '../context/ToastContext';
import { useSongArtwork } from '../hooks/useSongArtwork';

export const FullScreenPlayerModal: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    queue,
    queueIndex,
    togglePlayPause,
    seek,
    playNext,
    playPrevious,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    isExpandedPlayer,
    setIsExpandedPlayer,
    playSong,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    playNextInQueue,
    addToQueue,
  } = useAudioPlayer();

  const { isFavorite, toggleFavorite } = useFavorites();
  const { openAddToPlaylist } = usePlaylistModal();
  const { showToast } = useToast();

  const [showQueue, setShowQueue] = useState(false);
  const [showRemainingTime, setShowRemainingTime] = useState(true);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const resolvedCover = useSongArtwork(currentSong);
  const shouldReduceMotion = useReducedMotion();

  // Native touch gesture tracking for downward collapse
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocityY = deltaY / (deltaTime || 1);

    // Downward swipe: deltaY > 60px or velocity > 0.25px/ms
    if (deltaY > 60 || velocityY > 0.25) {
      setIsExpandedPlayer(false);
    }
    touchStartRef.current = null;
  };

  const isFav = currentSong ? isFavorite(currentSong.id) : false;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleCopyTrackInfo = () => {
    if (!currentSong) return;
    const text = `${currentSong.title} — ${currentSong.artist_name}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast('Track info copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showToast('Could not copy to clipboard', 'info');
    });
  };

  const nextUp = queue.slice(queueIndex + 1);

  return (
    <AnimatePresence>
      {isExpandedPlayer && currentSong && (
        <motion.div
          key="sonora-fullscreen-player-modal"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.05, bottom: 0.6 }}
          initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          animate={shouldReduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%' }}
          transition={
            shouldReduceMotion
              ? { duration: 0.15 }
              : { type: 'spring', damping: 28, stiffness: 260, mass: 0.8 }
          }
          onDragEnd={(_, info) => {
            if (info.offset.y > 75 || info.velocity.y > 200) {
              setIsExpandedPlayer(false);
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none bg-[#000000] text-white p-4 sm:p-8 touch-pan-x"
        >
          {/* Subtle Ambient Vignette from Cover Art */}
          <div
            className="absolute inset-0 opacity-25 filter blur-3xl scale-125 pointer-events-none transition-all duration-1000"
            style={{
              backgroundImage: `url(${resolvedCover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-[#000000]/85 to-[#000000] pointer-events-none" />

          {/* ============================================================
              DESKTOP LAYOUT (>= 1024px): FLOATING GLASS PANEL (1100-1250px)
              ============================================================ */}
          <div className="hidden lg:flex flex-col relative z-10 w-full max-w-[1120px] xl:max-w-[1220px] h-[640px] my-auto mx-auto rounded-[36px] bg-[#141416]/92 backdrop-blur-3xl border border-white/10 shadow-[0_32px_100px_rgba(0,0,0,0.95)] overflow-hidden">
            {/* Desktop Panel Header */}
            <div className="px-8 py-5 border-b border-white/[0.08] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider">
                  NOW PLAYING
                </span>
                <span className="text-white/20">•</span>
                <span className="text-xs font-semibold text-white/90 truncate max-w-sm">
                  {currentSong.album_name || 'SONORA Master Collection'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    showQueue
                      ? 'bg-white text-black shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-[#8e8e93] hover:text-white border border-white/10'
                  }`}
                  title={showQueue ? 'Return to player controls' : 'View play queue'}
                >
                  <ListMusic className="w-4 h-4" />
                  <span>Queue ({queue.length})</span>
                </button>

                <button
                  onClick={() => setIsMoreOptionsOpen(true)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#8e8e93] hover:text-white border border-white/10 transition-colors"
                  title="Track options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsExpandedPlayer(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#8e8e93] hover:text-white border border-white/10 transition-colors ml-1"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Desktop Panel Body: Two Columns */}
            <div className="grid grid-cols-12 gap-8 xl:gap-12 px-8 xl:px-10 py-6 flex-1 min-h-0 h-[calc(640px-73px)] items-center">
              {/* Left Column: Large Album Artwork (approx 45% width) */}
              <div className="col-span-5 flex items-center justify-center h-full min-h-0">
                <div className="relative aspect-square w-full max-w-[380px] xl:max-w-[420px] max-h-[420px] rounded-3xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.9)] border border-white/10 bg-black group shrink-0">
                  <img
                    src={resolvedCover}
                    alt={currentSong.title}
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      isPlaying ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-5">
                    <span className="text-xs text-white/90 font-medium truncate drop-shadow">
                      {currentSong.album_name || currentSong.title}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Controls or Queue View (approx 55% width) */}
              <div className="col-span-7 flex flex-col justify-center h-full min-h-0 max-w-xl">
                {showQueue ? (
                  /* Desktop Embedded Queue View */
                  <div className="h-full max-h-[500px] flex flex-col bg-[#1a1a1e]/80 border border-white/10 rounded-3xl p-6 backdrop-blur-xl min-h-0">
                    <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">Play Queue</h3>
                        <p className="text-xs text-[#8e8e93]">
                          {nextUp.length} upcoming tracks • Tap to play
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {queue.length > 1 && (
                          <button
                            onClick={clearQueue}
                            className="flex items-center gap-1 px-3 py-1 text-xs text-[#8e8e93] hover:text-rose-400 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Clear</span>
                          </button>
                        )}
                        <button
                          onClick={() => setShowQueue(false)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        >
                          Back to Controls
                        </button>
                      </div>
                    </div>

                    <div className="overflow-y-auto flex-1 divide-y divide-white/[0.04] mt-2 pr-1 space-y-1">
                      {/* Current Playing Row */}
                      <div className="p-2.5 bg-white/10 rounded-2xl flex items-center gap-3 my-1 border border-white/15">
                        <img
                          src={resolvedCover}
                          alt={currentSong.title}
                          className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                        />
                        <div className="truncate flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate leading-tight">
                            {currentSong.title}
                          </div>
                          <div className="text-[11px] text-[#8e8e93] truncate">
                            {currentSong.artist_name}
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-white/80 px-2 py-0.5 rounded-full bg-white/10 font-bold">
                          PLAYING
                        </span>
                      </div>

                      {nextUp.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[#8e8e93]">
                          No upcoming tracks in queue. Add more from the library.
                        </div>
                      ) : (
                        nextUp.map((track, i) => {
                          const actualIndex = queueIndex + 1 + i;
                          return (
                            <div
                              key={`${track.id}-${actualIndex}`}
                              className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
                            >
                              <div
                                onClick={() => playSong(track, queue)}
                                className="flex items-center gap-3 truncate cursor-pointer flex-1 min-w-0"
                              >
                                <img
                                  src={track.cover_url}
                                  alt={track.title}
                                  className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/10"
                                />
                                <div className="truncate min-w-0 pr-2">
                                  <div className="text-xs font-semibold text-white truncate group-hover:text-zinc-200">
                                    {track.title}
                                  </div>
                                  <div className="text-[11px] text-[#8e8e93] truncate">
                                    {track.artist_name}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-mono text-[#8e8e93] mr-1">
                                  {formatTime(track.duration)}
                                </span>
                                <button
                                  disabled={i === 0}
                                  onClick={() => reorderQueue(actualIndex, actualIndex - 1)}
                                  className="p-1 rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 disabled:opacity-20"
                                  title="Move up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  disabled={i === nextUp.length - 1}
                                  onClick={() => reorderQueue(actualIndex, actualIndex + 1)}
                                  className="p-1 rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 disabled:opacity-20"
                                  title="Move down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => removeFromQueue(actualIndex)}
                                  className="p-1 rounded-md text-[#8e8e93] hover:text-rose-400 hover:bg-rose-500/10"
                                  title="Remove from queue"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  /* Desktop Controls Deck: Tight, balanced, elegant layout */
                  <div className="space-y-6 xl:space-y-7">
                    {/* Subtle Tag / Quality Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold tracking-wider uppercase text-[#8e8e93]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
                      <span>{currentSong.genre || 'Master Audio'}</span>
                      {currentSong.release_year ? (
                        <>
                          <span>•</span>
                          <span>{currentSong.release_year}</span>
                        </>
                      ) : null}
                    </div>

                    {/* Title & Artist Row with Heart & Options */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="truncate space-y-1 flex-1 min-w-0 pr-2">
                        <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight truncate">
                          {currentSong.title}
                        </h1>
                        <p className="text-base xl:text-lg text-[#8e8e93] font-medium hover:text-white transition-colors cursor-pointer truncate">
                          {currentSong.artist_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pt-1">
                        <button
                          onClick={() => toggleFavorite(currentSong)}
                          className="p-2.5 rounded-full hover:bg-white/10 transition-transform active:scale-95"
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart
                            className={`w-7 h-7 transition-all ${
                              isFav ? 'text-red-500 fill-red-500' : 'text-[#8e8e93] hover:text-white'
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => setIsMoreOptionsOpen(true)}
                          className="p-2.5 rounded-full hover:bg-white/10 text-[#8e8e93] hover:text-white transition-colors"
                          title="More options"
                        >
                          <MoreHorizontal className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    {/* Seekbar and Timestamps */}
                    <div className="space-y-2">
                      <div className="relative flex items-center group cursor-pointer py-1">
                        <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-100"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={duration || 100}
                          step={0.1}
                          value={currentTime}
                          onChange={(e) => seek(parseFloat(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Seek position"
                        />
                      </div>

                      <div className="flex justify-between text-xs font-mono text-[#8e8e93] select-none">
                        <span>{formatTime(currentTime)}</span>
                        <span
                          onClick={() => setShowRemainingTime(!showRemainingTime)}
                          className="cursor-pointer hover:text-white transition-colors"
                          title="Click to toggle remaining time / total duration"
                        >
                          {showRemainingTime
                            ? `-${formatTime(Math.max(0, duration - currentTime))}`
                            : formatTime(duration)}
                        </span>
                      </div>
                    </div>

                    {/* Transport Controls Row */}
                    <div className="flex items-center justify-between max-w-md mx-auto w-full pt-1">
                      <button
                        onClick={toggleShuffle}
                        className={`p-2.5 transition-colors relative ${
                          shuffle ? 'text-white' : 'text-[#8e8e93] hover:text-white'
                        }`}
                        title={shuffle ? 'Shuffle ON' : 'Shuffle OFF'}
                      >
                        <Shuffle className="w-5 h-5" />
                        {shuffle && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                        )}
                      </button>

                      <button
                        onClick={playPrevious}
                        className="p-2.5 text-white active:scale-90 transition-transform"
                        title="Previous track"
                      >
                        <SkipBack className="w-7 h-7 fill-current" />
                      </button>

                      {/* Solid White Circular Play / Pause Button */}
                      <button
                        onClick={togglePlayPause}
                        className="w-16 h-16 rounded-full bg-white text-black hover:bg-zinc-200 active:scale-95 flex items-center justify-center shadow-2xl transition-all"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isBuffering ? (
                          <Loader2 className="w-7 h-7 animate-spin text-black" />
                        ) : isPlaying ? (
                          <Pause className="w-7 h-7 fill-current" />
                        ) : (
                          <Play className="w-7 h-7 fill-current translate-x-0.5" />
                        )}
                      </button>

                      <button
                        onClick={playNext}
                        className="p-2.5 text-white active:scale-90 transition-transform"
                        title="Next track"
                      >
                        <SkipForward className="w-7 h-7 fill-current" />
                      </button>

                      <button
                        onClick={cycleRepeat}
                        className={`p-2.5 transition-colors relative ${
                          repeat !== 'off' ? 'text-white' : 'text-[#8e8e93] hover:text-white'
                        }`}
                        title={`Repeat: ${repeat}`}
                      >
                        {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                        {repeat !== 'off' && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                        )}
                      </button>
                    </div>

                    {/* Volume Slider Row */}
                    <div className="flex items-center gap-3.5 max-w-sm mx-auto w-full pt-1">
                      <button
                        onClick={toggleMute}
                        className="text-[#8e8e93] hover:text-white transition-colors shrink-0"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : volume < 0.5 ? (
                          <Volume1 className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      <div className="relative flex-1 flex items-center group cursor-pointer py-1">
                        <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full"
                            style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                          />
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={isMuted ? 0 : volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="Volume"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============================================================
              MOBILE LAYOUT (< 1024px): IMMERSIVE VERTICAL PROPORTIONS
              ============================================================ */}
          <div className="flex lg:hidden flex-col justify-between h-full w-full relative z-10 p-4 sm:p-6 pb-6 touch-pan-x select-none">
            {/* Top Bar with Drag Pill Handle */}
            <div className="w-full flex flex-col items-center shrink-0">
              <div
                onClick={() => setIsExpandedPlayer(false)}
                className="w-10 h-1.5 rounded-full bg-white/25 hover:bg-white/50 transition-colors cursor-grab active:cursor-grabbing mb-3"
                title="Swipe down to collapse"
              />

              <div className="w-full flex items-center justify-between gap-4 max-w-md mx-auto">
                <button
                  onClick={() => setIsExpandedPlayer(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                  title="Collapse"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>

                <div className="text-center truncate min-w-0">
                  <div className="text-[10px] font-semibold text-[#8e8e93] tracking-wider uppercase">
                    {showQueue ? 'PLAY QUEUE' : 'PLAYING FROM CATALOGUE'}
                  </div>
                  <div className="text-xs font-bold text-white truncate max-w-[190px] mx-auto">
                    {showQueue ? `${queue.length} Tracks in Queue` : currentSong.album_name || 'SONORA Master Collection'}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowQueue(!showQueue)}
                    className={`p-2 rounded-full transition-colors ${
                      showQueue ? 'bg-white text-black shadow-md' : 'text-[#8e8e93] hover:text-white hover:bg-white/10'
                    }`}
                    title={showQueue ? 'Show album artwork' : 'Show queue'}
                  >
                    <ListMusic className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsMoreOptionsOpen(true)}
                    className="p-2 rounded-full text-[#8e8e93] hover:text-white hover:bg-white/10 transition-colors"
                    title="More track options"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Center Stage: Artwork or Queue */}
            <div className="flex-1 flex flex-col items-center justify-center my-auto max-w-md mx-auto w-full min-h-0 py-2 sm:py-4">
              {showQueue ? (
                /* Mobile Queue Overlay */
                <div className="w-full h-full max-h-[420px] bg-[#161618]/92 border border-white/10 rounded-3xl p-4 backdrop-blur-2xl flex flex-col overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Up Next ({nextUp.length})
                    </span>

                    <div className="flex items-center gap-2">
                      {queue.length > 1 && (
                        <button
                          onClick={clearQueue}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-[#8e8e93] hover:text-rose-400 bg-white/5 rounded-full"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowQueue(false)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-white/10 rounded-full"
                      >
                        Done
                      </button>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 divide-y divide-white/[0.04] pr-1 mt-2 space-y-1">
                    {/* Current Track */}
                    <div className="p-2 bg-white/10 rounded-xl flex items-center gap-2.5 mb-2 border border-white/15">
                      <img
                        src={resolvedCover}
                        alt={currentSong.title}
                        className="w-9 h-9 rounded-lg object-cover shrink-0"
                      />
                      <div className="truncate flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{currentSong.title}</div>
                        <div className="text-[10px] text-[#8e8e93] truncate">{currentSong.artist_name}</div>
                      </div>
                      <span className="text-[9px] font-mono text-white/90 px-1.5 py-0.5 rounded bg-white/10">
                        NOW
                      </span>
                    </div>

                    {nextUp.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#8e8e93]">
                        No upcoming tracks.
                      </div>
                    ) : (
                      nextUp.map((track, i) => {
                        const actualIndex = queueIndex + 1 + i;
                        return (
                          <div
                            key={`${track.id}-${actualIndex}`}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06]"
                          >
                            <div
                              onClick={() => playSong(track, queue)}
                              className="flex items-center gap-2.5 truncate cursor-pointer flex-1 min-w-0"
                            >
                              <img
                                src={track.cover_url}
                                alt={track.title}
                                className="w-8 h-8 rounded-lg object-cover shrink-0"
                              />
                              <div className="truncate min-w-0 pr-1">
                                <div className="text-xs font-medium text-white truncate">
                                  {track.title}
                                </div>
                                <div className="text-[10px] text-[#8e8e93] truncate">
                                  {track.artist_name}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                disabled={i === 0}
                                onClick={() => reorderQueue(actualIndex, actualIndex - 1)}
                                className="p-1 text-[#8e8e93] disabled:opacity-20"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                disabled={i === nextUp.length - 1}
                                onClick={() => reorderQueue(actualIndex, actualIndex + 1)}
                                className="p-1 text-[#8e8e93] disabled:opacity-20"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removeFromQueue(actualIndex)}
                                className="p-1 text-[#8e8e93] hover:text-rose-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Mobile Large Album Artwork */
                <div className="relative aspect-square w-64 h-64 sm:w-76 sm:h-76 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] border border-white/10 bg-[#161618] shrink-0">
                  <img
                    src={resolvedCover}
                    alt={currentSong.title}
                    className={`w-full h-full object-cover transition-transform duration-700 ${
                      isPlaying ? 'scale-105' : 'scale-100'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Mobile Bottom Deck: Title, Seekbar, Transport, Volume */}
            <div className="max-w-md mx-auto w-full space-y-3.5 shrink-0">
              {/* Title & Artist with Favourite Heart */}
              <div className="flex items-center justify-between gap-3">
                <div className="truncate space-y-0.5 flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate leading-tight">
                    {currentSong.title}
                  </h1>
                  <p className="text-sm font-medium text-[#8e8e93] truncate">
                    {currentSong.artist_name}
                  </p>
                </div>

                <button
                  onClick={() => toggleFavorite(currentSong)}
                  className="p-2 rounded-full hover:bg-white/10 transition-transform active:scale-95 shrink-0"
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart
                    className={`w-6 h-6 transition-all ${
                      isFav ? 'text-red-500 fill-red-500' : 'text-[#8e8e93] hover:text-white'
                    }`}
                  />
                </button>
              </div>

              {/* Seekbar and Timestamps */}
              <div className="space-y-1.5">
                <div className="relative flex items-center group cursor-pointer py-1">
                  <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                <div className="flex justify-between text-[11px] font-mono text-[#8e8e93] select-none">
                  <span>{formatTime(currentTime)}</span>
                  <span
                    onClick={() => setShowRemainingTime(!showRemainingTime)}
                    className="cursor-pointer hover:text-white"
                  >
                    {showRemainingTime
                      ? `-${formatTime(Math.max(0, duration - currentTime))}`
                      : formatTime(duration)}
                  </span>
                </div>
              </div>

              {/* Transport Controls Row */}
              <div className="flex items-center justify-between max-w-xs mx-auto w-full pt-1">
                <button
                  onClick={toggleShuffle}
                  className={`p-2 transition-colors relative ${
                    shuffle ? 'text-white' : 'text-[#8e8e93]'
                  }`}
                  title={shuffle ? 'Shuffle ON' : 'Shuffle OFF'}
                >
                  <Shuffle className="w-4 h-4" />
                  {shuffle && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                  )}
                </button>

                <button
                  onClick={playPrevious}
                  className="p-2 text-white active:scale-90 transition-transform"
                  title="Previous track"
                >
                  <SkipBack className="w-6 h-6 fill-current" />
                </button>

                {/* Solid White Circular Play / Pause Button */}
                <button
                  onClick={togglePlayPause}
                  className="w-14 h-14 rounded-full bg-white text-black hover:bg-zinc-200 active:scale-95 flex items-center justify-center shadow-xl transition-all"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isBuffering ? (
                    <Loader2 className="w-6 h-6 animate-spin text-black" />
                  ) : isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={playNext}
                  className="p-2 text-white active:scale-90 transition-transform"
                  title="Next track"
                >
                  <SkipForward className="w-6 h-6 fill-current" />
                </button>

                <button
                  onClick={cycleRepeat}
                  className={`p-2 transition-colors relative ${
                    repeat !== 'off' ? 'text-white' : 'text-[#8e8e93]'
                  }`}
                  title={`Repeat: ${repeat}`}
                >
                  {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                  {repeat !== 'off' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                  )}
                </button>
              </div>

              {/* Volume Slider Row */}
              <div className="flex items-center gap-3 max-w-xs mx-auto pt-1">
                <button
                  onClick={toggleMute}
                  className="text-[#8e8e93] hover:text-white transition-colors shrink-0"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <div className="relative flex-1 flex items-center group cursor-pointer py-1">
                  <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full"
                      style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* More Options Modal / Action Sheet */}
          {isMoreOptionsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
              onClick={() => setIsMoreOptionsOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl bg-[#161618] border border-white/10 p-5 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3 truncate min-w-0 pr-2">
                    <img
                      src={resolvedCover}
                      alt={currentSong.title}
                      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                    />
                    <div className="truncate text-xs">
                      <div className="font-bold text-white truncate">{currentSong.title}</div>
                      <div className="text-[#8e8e93] truncate">{currentSong.artist_name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMoreOptionsOpen(false)}
                    className="p-1 rounded-full text-[#8e8e93] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      openAddToPlaylist(currentSong);
                      setIsMoreOptionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors"
                  >
                    <ListPlus className="w-4 h-4 text-[#8e8e93]" />
                    <span>Add to Playlist</span>
                  </button>

                  <button
                    onClick={() => {
                      playNextInQueue(currentSong);
                      setIsMoreOptionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors"
                  >
                    <CornerDownRight className="w-4 h-4 text-[#8e8e93]" />
                    <span>Play Next in Queue</span>
                  </button>

                  <button
                    onClick={() => {
                      addToQueue(currentSong);
                      setIsMoreOptionsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors"
                  >
                    <ListMusic className="w-4 h-4 text-[#8e8e93]" />
                    <span>Add to End of Queue</span>
                  </button>

                  <button
                    onClick={handleCopyTrackInfo}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-white/5 text-xs text-white transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#8e8e93]" />}
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Track Info'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
