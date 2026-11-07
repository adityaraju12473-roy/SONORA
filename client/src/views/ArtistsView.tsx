import React, { useState, useEffect } from 'react';
import { User, Play } from 'lucide-react';
import { Artist, NavView } from '../types';
import { api } from '../services/api';
import { deriveAlbumsAndArtistsFromSongs } from '../utils/catalogueHelpers';

interface ArtistsViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({ onNavigate }) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        setLoading(true);
        const [artistsData, songsData] = await Promise.all([
          api.getArtists().catch(() => []),
          api.getSongs().catch(() => []),
        ]);

        if (artistsData.length > 0) {
          setArtists(artistsData);
        } else if (songsData.length > 0) {
          const { artists: derived } = deriveAlbumsAndArtistsFromSongs(songsData);
          setArtists(derived);
        }
      } catch (e) {
        console.error('Failed to load artists:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchArtists();
  }, []);

  return (
    <div className="min-h-full w-full bg-[#000000] text-white">
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-44 space-y-7">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Artists
          </h1>
          <p className="text-xs sm:text-sm text-[#8e8e93] font-normal mt-1">
            {artists.length} artists in the SONORA master collection.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="aspect-square bg-white/5 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
            {artists.map((artist) => (
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
        )}
      </div>
    </div>
  );
};
