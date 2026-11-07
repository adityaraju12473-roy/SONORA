import React from 'react';
import { ListMusic, Plus, Play, Link2 } from 'lucide-react';
import { NavView } from '../types';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { PlaylistCover } from '../components/PlaylistCover';

interface PlaylistsViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({ onNavigate }) => {
  const { playlists, openCreatePlaylist, openImportPlaylist } = usePlaylistModal();
  const { playSong } = useAudioPlayer();

  return (
    <div className="min-h-full w-full bg-[#000000] text-white">
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10 py-6 pb-44 space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Playlists
            </h1>
            <p className="text-xs sm:text-sm text-[#8e8e93] font-normal mt-1">
              {playlists.length} playlists in your library.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={openImportPlaylist}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#161618] hover:bg-[#202024] border border-white/10 hover:border-emerald-500/40 text-white text-xs font-semibold transition-transform active:scale-95 shadow-md group"
            >
              <Link2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform stroke-[2.5]" />
              <span>Import Playlist</span>
            </button>

            <button
              onClick={openCreatePlaylist}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-transform active:scale-95 shadow-md"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Playlist</span>
            </button>
          </div>
        </div>

        {playlists.length === 0 ? (
          <div className="text-center py-16 bg-[#161618] border border-white/[0.08] rounded-2xl p-8 space-y-3">
            <ListMusic className="w-10 h-10 text-[#8e8e93] mx-auto" />
            <h3 className="text-base font-bold text-white">No playlists yet</h3>
            <p className="text-xs text-[#8e8e93] max-w-sm mx-auto">
              Create a custom playlist or import directly from Spotify & YouTube Music links.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={openImportPlaylist}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#202024] hover:bg-[#28282e] border border-white/10 text-white text-xs font-semibold"
              >
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Import Playlist</span>
              </button>
              <button
                onClick={openCreatePlaylist}
                className="px-4 py-2 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200"
              >
                Create Playlist
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onNavigate('playlist-detail', { id: pl.id })}
                className="group p-3 rounded-2xl bg-[#161618] hover:bg-[#202024] border border-white/[0.06] hover:border-white/15 cursor-pointer transition-all select-none flex flex-col justify-between active:scale-95"
              >
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 shadow-md bg-zinc-900 shrink-0">
                  <PlaylistCover
                    songs={pl.songs}
                    fallbackUrl={pl.cover_url}
                    title={pl.title}
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-semibold text-xs sm:text-sm text-white truncate">
                    {pl.title}
                  </h4>
                  <p className="text-[10px] text-[#8e8e93] truncate">
                    {pl.song_count || pl.songs?.length || 0} tracks
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
