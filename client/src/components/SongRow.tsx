import React, { useState } from 'react';
import { Play, Heart, MoreHorizontal, ListPlus, CornerDownRight } from 'lucide-react';
import { Song, NavView } from '../types';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import { useSongArtwork } from '../hooks/useSongArtwork';

interface SongRowProps {
  song: Song;
  index: number;
  contextQueue?: Song[];
  onNavigate?: (view: NavView, payload?: any) => void;
  showCover?: boolean;
  showAlbum?: boolean;
  onRemove?: () => void;
}

export const SongRow: React.FC<SongRowProps> = ({
  song,
  index,
  contextQueue,
  onNavigate,
  showCover = true,
  showAlbum = true,
  onRemove,
}) => {
  const { currentSong, isPlaying, playSong, togglePlayPause, addToQueue, playNextInQueue } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { openAddToPlaylist } = usePlaylistModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const resolvedCover = useSongArtwork(song);

  const isCurrent = currentSong?.id === song.id;
  const isFav = isFavorite(song.id);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePlayClick = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playSong({ ...song, cover_url: resolvedCover || song.cover_url }, contextQueue);
    }
  };

  return (
    <div
      className={`group flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all duration-150 border select-none ${
        isCurrent
          ? 'bg-white/10 border-white/20 text-white shadow-sm'
          : 'hover:bg-white/[0.04] border-transparent text-zinc-300'
      }`}
    >
      {/* Left: Index / Play Button + Artwork + Title & Artist */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
        {/* Index or Play icon */}
        <div className="w-6 flex items-center justify-center shrink-0">
          <button
            onClick={handlePlayClick}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 group-hover:text-white"
          >
            {isCurrent && isPlaying ? (
              <div className="flex items-end gap-0.5 h-3.5">
                <span className="w-0.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-0.5 h-3.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.25s' }} />
                <span className="w-0.5 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              </div>
            ) : (
              <>
                <span className={`text-xs font-mono font-medium group-hover:hidden ${isCurrent ? 'text-white font-bold' : 'text-[#8e8e93]'}`}>
                  {index + 1}
                </span>
                <Play className="w-3.5 h-3.5 fill-current hidden group-hover:block text-white" />
              </>
            )}
          </button>
        </div>

        {/* Artwork */}
        {showCover && (
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-sm bg-[#161618] border border-white/10">
            <img
              src={resolvedCover}
              alt={song.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        )}

        {/* Title and Artist */}
        <div className="truncate flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              onClick={handlePlayClick}
              className={`text-xs sm:text-sm font-semibold truncate cursor-pointer transition-colors ${
                isCurrent ? 'text-white font-bold' : 'text-white group-hover:text-zinc-200'
              }`}
            >
              {song.title}
            </span>
            {song.audio_url?.includes('cloudinary.com') && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-white/10 text-[#8e8e93] border border-white/10 shrink-0">
                Cloud
              </span>
            )}
          </div>
          <div
            onClick={() => {
              if (song.artist_id && onNavigate) {
                onNavigate('artist-detail', { id: song.artist_id });
              }
            }}
            className="text-[11px] sm:text-xs text-[#8e8e93] truncate hover:text-white transition-colors cursor-pointer"
          >
            {song.artist_name}
          </div>
        </div>
      </div>

      {/* Middle: Album */}
      {showAlbum && (
        <div
          onClick={() => {
            if (song.album_id && onNavigate) {
              onNavigate('album-detail', { id: song.album_id });
            }
          }}
          className="hidden md:block w-1/4 text-xs text-zinc-400 hover:text-white truncate cursor-pointer pr-4"
        >
          {song.album_name || 'Single'}
        </div>
      )}

      {/* Plays count badge */}
      <div className="hidden lg:block w-20 text-xs text-zinc-500 font-mono text-right pr-4">
        {song.plays_count.toLocaleString()}
      </div>

      {/* Right: Heart + Duration + More Menu */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => toggleFavorite(song)}
          className={`p-1.5 rounded-full hover:bg-white/5 transition-colors ${
            isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          aria-label={isFav ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`w-4 h-4 ${
              isFav ? 'text-rose-500 fill-rose-500' : 'text-zinc-400 hover:text-white'
            }`}
          />
        </button>

        <span className="text-xs font-mono text-zinc-400 w-10 text-right">
          {formatDuration(song.duration)}
        </span>

        {/* More actions dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="More song actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#161618] border border-white/10 p-1.5 z-30 shadow-2xl animate-slide-up text-left"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  playNextInQueue(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-brand-400" />
                Play Next
              </button>
              <button
                onClick={() => {
                  addToQueue(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                <ListPlus className="w-3.5 h-3.5 text-brand-400" />
                Add to Queue
              </button>
              <button
                onClick={() => {
                  openAddToPlaylist(song);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                <ListPlus className="w-3.5 h-3.5 text-brand-neon" />
                Add to Playlist...
              </button>
              {onRemove && (
                <button
                  onClick={() => {
                    onRemove();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left"
                >
                  Remove from Playlist
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
