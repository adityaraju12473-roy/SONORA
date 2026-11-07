import React, { useState } from 'react';
import { Heart, Play, Shuffle, Search, Clock } from 'lucide-react';
import { NavView } from '../types';
import { useFavorites } from '../context/FavoritesContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { SongRow } from '../components/SongRow';

interface FavouritesViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

export const FavouritesView: React.FC<FavouritesViewProps> = ({ onNavigate }) => {
  const { favorites, loading } = useFavorites();
  const { playSong } = useAudioPlayer();
  const [filterQuery, setFilterQuery] = useState('');

  const filtered = favorites.filter((s) => {
    const q = filterQuery.toLowerCase().trim();
    return !q || s.title.toLowerCase().includes(q) || s.artist_name.toLowerCase().includes(q);
  });

  const totalDuration = favorites.reduce((acc, s) => acc + s.duration, 0);

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const handlePlayAll = (shuffleMode = false) => {
    if (filtered.length === 0) return;
    const list = [...filtered];
    if (shuffleMode) list.sort(() => Math.random() - 0.5);
    playSong(list[0], list);
  };

  return (
    <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 md:px-8 space-y-8 pb-44 pt-4">
      {/* Hero Header */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-[#161618] border border-white/10 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 w-full overflow-hidden">
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl bg-[#202024] border border-white/10 flex items-center justify-center shadow-xl shrink-0">
          <Heart className="w-16 h-16 text-red-500 fill-red-500" />
        </div>

        <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-white uppercase tracking-wider">
            <span>Playlist</span>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Liked Songs
          </h1>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-[#8e8e93] font-medium pt-1">
            <span className="text-white font-semibold">{favorites.length} saved songs</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-[#8e8e93]">
              <Clock className="w-3.5 h-3.5" />
              {formatTotalTime(totalDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 self-start">
          <button
            onClick={() => handlePlayAll(false)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-bold text-xs shadow-md disabled:opacity-40 transition-all hover:scale-105"
            title="Play liked songs"
          >
            <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
            <span>Play Liked Songs</span>
          </button>

          <button
            onClick={() => handlePlayAll(true)}
            disabled={filtered.length === 0}
            className="p-2.5 rounded-full bg-[#161618] hover:bg-[#202024] text-[#8e8e93] hover:text-white border border-white/10 disabled:opacity-40 transition-colors"
            title="Shuffle liked songs"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Input */}
        {favorites.length > 0 && (
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in favourites..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-[#161618] border border-white/10 rounded-full pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
            />
          </div>
        )}
      </div>

      {/* Tracks Table */}
      <div>
        {loading ? (
          <div className="h-64 rounded-2xl bg-[#161618] animate-pulse" />
        ) : favorites.length === 0 ? (
          <div className="p-16 text-center bg-[#161618] rounded-2xl border border-white/10 space-y-3">
            <Heart className="w-10 h-10 text-zinc-500 mx-auto" />
            <h3 className="text-base font-bold text-white">Songs you like will appear here</h3>
            <p className="text-xs text-[#8e8e93]">Save songs by tapping the heart icon on any track</p>
            <button
              onClick={() => onNavigate('home')}
              className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors"
            >
              Explore Music
            </button>
          </div>
        ) : (
          <div className="bg-[#161618] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            {filtered.map((song, i) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                contextQueue={filtered}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
