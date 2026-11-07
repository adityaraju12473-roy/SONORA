import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, Disc, Radio } from 'lucide-react';
import { Song, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { SongRow } from '../components/SongRow';

interface ExploreViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

const genres = [
  { name: 'Synthwave', gradient: 'from-pink-600 to-purple-800', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80' },
  { name: 'Neo-Soul', gradient: 'from-amber-600 to-rose-900', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80' },
  { name: 'Cyberpunk', gradient: 'from-cyan-600 to-blue-900', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=80' },
  { name: 'Indie Folk', gradient: 'from-emerald-700 to-teal-950', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80' },
  { name: 'Deep House', gradient: 'from-purple-600 to-indigo-900', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=400&q=80' },
  { name: 'Electronic', gradient: 'from-blue-600 to-violet-900', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80' },
  { name: 'Ambient', gradient: 'from-teal-600 to-slate-900', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { name: 'Lo-Fi Chill', gradient: 'from-orange-600 to-amber-900', image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=400&q=80' },
];

export const ExploreView: React.FC<ExploreViewProps> = ({ onNavigate }) => {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const { playSong } = useAudioPlayer();

  useEffect(() => {
    const fetchGenreSongs = async () => {
      try {
        setLoading(true);
        const data = await api.getSongs(selectedGenre ? { genre: selectedGenre } : undefined);
        setSongs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchGenreSongs();
  }, [selectedGenre]);

  return (
    <div className="px-6 md:px-10 py-6 space-y-9 w-full pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-neon text-xs font-bold uppercase tracking-wider mb-1">
            <Compass className="w-4 h-4" />
            <span>Discover Sonic Worlds</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Explore & Genres</h1>
        </div>

        {selectedGenre && (
          <button
            onClick={() => setSelectedGenre(null)}
            className="self-start sm:self-auto px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold text-zinc-300 transition-colors"
          >
            Show All Genres
          </button>
        )}
      </div>

      {/* Genre Stations Grid (Consistent 16:9 / 2:1 Cards) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Disc className="w-4 h-4 text-brand-400" />
          <span>Browse Stations</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4 w-full">
          {genres.map((g) => {
            const isSelected = selectedGenre?.toLowerCase() === g.name.toLowerCase();
            return (
              <div
                key={g.name}
                onClick={() => setSelectedGenre(isSelected ? null : g.name)}
                className={`group relative h-28 sm:h-32 rounded-2xl overflow-hidden p-4 cursor-pointer card-hover-glow transition-all duration-200 bg-gradient-to-br ${g.gradient} select-none ${
                  isSelected ? 'ring-2 ring-brand-neon scale-[1.02] shadow-xl' : ''
                }`}
              >
                <div className="relative z-10">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-md">
                    {g.name}
                  </h3>
                  <span className="text-[11px] text-white/80 font-medium">Station</span>
                </div>

                {/* Angled Artwork Thumbnail (Strictly 64x64 to 72x72) */}
                <div className="absolute -right-3 -bottom-3 w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shadow-2xl rotate-[20deg] group-hover:rotate-[15deg] group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={g.image}
                    alt={g.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filtered Tracks List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-brand-neon" />
            <span>
              {selectedGenre ? `${selectedGenre} Tracks (${songs.length})` : `All Catalogue Tracks (${songs.length})`}
            </span>
          </h2>
          {songs.length > 0 && (
            <button
              onClick={() => playSong(songs[0], songs)}
              className="text-xs font-semibold text-brand-neon hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Play Selection
            </button>
          )}
        </div>

        {loading ? (
          <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
        ) : songs.length === 0 ? (
          <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/5">
            <p className="text-sm text-zinc-400">No tracks found for this genre.</p>
          </div>
        ) : (
          <div className="bg-[#121218]/80 border border-white/5 rounded-2xl p-2 divide-y divide-white/5">
            {songs.map((song, i) => (
              <SongRow
                key={song.id}
                song={song}
                index={i}
                contextQueue={songs}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
