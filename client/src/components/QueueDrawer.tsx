import React from 'react';
import { X, Trash2, Play, Music2, ArrowUp, ArrowDown } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const {
    currentSong,
    queue,
    queueIndex,
    playSong,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = useAudioPlayer();

  if (!isOpen) return null;

  const nextUp = queue.slice(queueIndex + 1);

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-[#161618]/98 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col shadow-2xl animate-slide-up select-none">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Music2 className="w-5 h-5 text-white" />
          <h2 className="font-bold text-base text-white tracking-tight">Play Queue</h2>
          <span className="text-xs text-[#8e8e93] bg-white/10 px-2 py-0.5 rounded-full font-mono">
            {queue.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {queue.length > 1 && (
            <button
              onClick={clearQueue}
              className="px-2.5 py-1 text-xs text-[#8e8e93] hover:text-rose-400 rounded-full hover:bg-white/5 transition-colors flex items-center gap-1"
              title="Clear queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-[#8e8e93] hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Now Playing Section */}
        {currentSong && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-2">
              Now Playing
            </div>
            <div className="p-3 bg-white/10 border border-white/15 rounded-2xl flex items-center gap-3">
              <img
                src={currentSong.cover_url}
                alt={currentSong.title}
                className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md border border-white/10"
              />
              <div className="truncate flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{currentSong.title}</div>
                <div className="text-xs text-[#8e8e93] truncate">{currentSong.artist_name}</div>
              </div>
              <div className="flex items-end gap-0.5 h-3.5 px-2">
                <span className="w-0.5 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-0.5 h-3.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.25s' }} />
                <span className="w-0.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              </div>
            </div>
          </div>
        )}

        {/* Next Up Section */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#8e8e93] mb-2">
            <span>Next Up ({nextUp.length})</span>
          </div>

          {nextUp.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8e8e93] bg-[#202024]/50 border border-white/5 rounded-2xl p-4">
              No upcoming tracks. Queue will continue with shuffle or catalogue tracks.
            </div>
          ) : (
            <div className="space-y-1.5">
              {nextUp.map((song, i) => {
                const actualIndex = queueIndex + 1 + i;
                return (
                  <div
                    key={`${song.id}-${actualIndex}`}
                    className="group flex items-center justify-between p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all"
                  >
                    <div
                      onClick={() => playSong(song, queue)}
                      className="flex items-center gap-2.5 truncate cursor-pointer flex-1 min-w-0"
                    >
                      <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                        <img
                          src={song.cover_url}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-3.5 h-3.5 text-white fill-current" />
                        </div>
                      </div>
                      <div className="truncate min-w-0 pr-1">
                        <div className="text-xs font-medium text-white truncate group-hover:text-zinc-200 transition-colors">
                          {song.title}
                        </div>
                        <div className="text-[11px] text-[#8e8e93] truncate">
                          {song.artist_name}
                        </div>
                      </div>
                    </div>

                    {/* Reorder and Remove Controls */}
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {/* Move Up */}
                      <button
                        disabled={i === 0}
                        onClick={() => reorderQueue(actualIndex, actualIndex - 1)}
                        className="p-1 rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Move Down */}
                      <button
                        disabled={i === nextUp.length - 1}
                        onClick={() => reorderQueue(actualIndex, actualIndex + 1)}
                        className="p-1 rounded-md text-[#8e8e93] hover:text-white hover:bg-white/10 disabled:opacity-20 transition-colors"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => removeFromQueue(actualIndex)}
                        className="p-1 rounded-md text-[#8e8e93] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
