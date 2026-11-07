import React, { useState, useEffect } from 'react';
import { Disc3, Play } from 'lucide-react';
import { Album, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { deriveAlbumsAndArtistsFromSongs } from '../utils/catalogueHelpers';

interface AlbumsViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ onNavigate }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = useAudioPlayer();

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        setLoading(true);
        const [albumsData, songsData] = await Promise.all([
          api.getAlbums().catch(() => []),
          api.getSongs().catch(() => []),
        ]);

        if (albumsData.length > 0) {
          setAlbums(albumsData);
        } else if (songsData.length > 0) {
          const { albums: derived } = deriveAlbumsAndArtistsFromSongs(songsData);
          setAlbums(derived);
        }
      } catch (e) {
        console.error('Failed to load albums:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbums();
  }, []);

  return (
    <div className="min-h-full w-full bg-[#000000] text-white">
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-44 space-y-7">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Albums & EPs
          </h1>
          <p className="text-xs sm:text-sm text-[#8e8e93] font-normal mt-1">
            {albums.length} releases discovered in the SONORA master collection.
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
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => {
                  if (album.songs && album.songs.length > 0) {
                    playSong(album.songs[0], album.songs);
                  } else {
                    onNavigate('album-detail', { id: album.id });
                  }
                }}
                className="group p-3 rounded-2xl bg-[#161618] hover:bg-[#202024] border border-white/[0.06] hover:border-white/15 cursor-pointer transition-all select-none flex flex-col justify-between active:scale-95"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 shadow-md bg-zinc-900 shrink-0">
                  <img
                    src={album.cover_url}
                    alt={album.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-semibold text-xs sm:text-sm text-white truncate">
                    {album.title}
                  </h4>
                  <p className="text-[10px] text-[#8e8e93] truncate">
                    {album.artist_name} {album.release_year ? `• ${album.release_year}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
