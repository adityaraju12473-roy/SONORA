import React, { useState, useEffect } from 'react';
import { Play, Shuffle, Clock, ChevronLeft } from 'lucide-react';
import { Album, Song, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { deriveAlbumsAndArtistsFromSongs } from '../utils/catalogueHelpers';

interface AlbumDetailViewProps {
  albumId: string;
  onNavigate: (view: NavView, payload?: any) => void;
}

export const AlbumDetailView: React.FC<AlbumDetailViewProps> = ({ albumId, onNavigate }) => {
  const [album, setAlbum] = useState<(Album & { songs: Song[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const { playSong, currentSong, isPlaying } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);
        // Try direct API first
        try {
          const data = await api.getAlbumById(albumId);
          if (data) {
            setAlbum(data);
            return;
          }
        } catch {
          // Fall through to derived catalogue lookup
        }

        // Look up album derived from catalogue
        const allSongs = await api.getSongs();
        const { albums: derived } = deriveAlbumsAndArtistsFromSongs(allSongs);
        const match = derived.find(
          (a) =>
            a.id === albumId ||
            a.title.toLowerCase() === decodeURIComponent(albumId.replace('derived-alb-', '')).toLowerCase()
        );
        if (match) {
          setAlbum(match as (Album & { songs: Song[] }));
        }
      } catch (e) {
        console.error('Failed to load album:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbum();
  }, [albumId]);

  if (loading) {
    return (
      <div className="min-h-full w-full bg-[#000000] p-6 sm:p-10">
        <div className="w-full max-w-4xl mx-auto h-80 bg-white/5 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-full w-full bg-[#000000] text-white flex flex-col items-center justify-center p-12 space-y-4">
        <h2 className="text-xl font-bold text-white">Album not found</h2>
        <button
          onClick={() => onNavigate('albums')}
          className="px-5 py-2.5 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-colors"
        >
          Back to Albums
        </button>
      </div>
    );
  }

  const songs = album.songs || [];
  const totalDuration = songs.reduce((acc, s) => acc + s.duration, 0);

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const handlePlayAlbum = (shuffleMode = false) => {
    if (songs.length === 0) return;
    const toPlay = [...songs];
    if (shuffleMode) {
      toPlay.sort(() => Math.random() - 0.5);
    }
    playSong(toPlay[0], toPlay);
  };

  return (
    <div className="min-h-full w-full bg-[#000000] text-white">
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-44 space-y-8">
        
        {/* Back Link */}
        <button
          onClick={() => onNavigate('albums')}
          className="inline-flex items-center gap-1.5 text-xs text-[#8e8e93] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Albums</span>
        </button>

        {/* Hero Header: Split Artwork & Details */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 bg-[#161618] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl shrink-0 bg-zinc-900 border border-white/10">
            <img
              src={album.cover_url}
              alt={album.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-4 text-center sm:text-left">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8e8e93]">
                ALBUM RELEASE
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {album.title}
              </h1>
              <p
                onClick={() => onNavigate('artists')}
                className="text-sm sm:text-base font-semibold text-[#8e8e93] hover:text-white cursor-pointer transition-colors"
              >
                {album.artist_name}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-[#8e8e93] pt-1">
              <span>{album.release_year || '2025'}</span>
              <span>•</span>
              <span>{songs.length} Tracks</span>
              <span>•</span>
              <span>{formatTotalTime(totalDuration)}</span>
              {album.genre && (
                <>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white font-medium">
                    {album.genre}
                  </span>
                </>
              )}
            </div>

            {/* Play Actions */}
            <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
              <button
                onClick={() => handlePlayAlbum(false)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-xs sm:text-sm shadow-lg hover:bg-zinc-200 transition-transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
                <span>Play Album</span>
              </button>

              <button
                onClick={() => handlePlayAlbum(true)}
                className="p-3 rounded-full bg-[#202024] hover:bg-[#28282c] text-white border border-white/10 transition-colors"
                title="Shuffle Album"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tracklist Table */}
        <section className="space-y-3">
          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Tracks
          </h3>

          <div className="bg-[#161618] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1c1c1e] text-[#8e8e93] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                  <tr>
                    <th className="p-3 pl-4 w-10 text-center">#</th>
                    <th className="p-3">Title</th>
                    <th className="p-3 hidden sm:table-cell">Artist</th>
                    <th className="p-3 hidden md:table-cell">Duration</th>
                    <th className="p-3 text-right pr-4">Play</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {songs.map((song, idx) => {
                    const isCurrent = currentSong?.id === song.id;
                    return (
                      <tr
                        key={song.id}
                        onClick={() => playSong(song, songs)}
                        className={`hover:bg-white/[0.04] transition-colors cursor-pointer group ${
                          isCurrent ? 'bg-white/[0.06]' : ''
                        }`}
                      >
                        <td className="p-3 pl-4 text-center text-[#8e8e93] font-mono group-hover:text-white">
                          {isCurrent && isPlaying ? (
                            <span className="w-2 h-2 rounded-full bg-white inline-block animate-ping" />
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="p-3 font-semibold text-white truncate max-w-xs group-hover:text-zinc-200">
                          {song.title}
                        </td>
                        <td className="p-3 text-[#8e8e93] truncate hidden sm:table-cell">
                          {song.artist_name}
                        </td>
                        <td className="p-3 text-[#8e8e93] font-mono hidden md:table-cell">
                          {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                        </td>
                        <td className="p-3 text-right pr-4">
                          <button className="p-1.5 rounded-full hover:bg-white/10 text-white">
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
