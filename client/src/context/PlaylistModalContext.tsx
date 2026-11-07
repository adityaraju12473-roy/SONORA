import React, { createContext, useContext, useState, useEffect } from 'react';
import { Song, Playlist, NavView } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { Plus, Check, ListMusic, X } from 'lucide-react';
import { PlaylistImportModal } from '../components/PlaylistImportModal';

interface PlaylistModalContextType {
  openAddToPlaylist: (song: Song) => void;
  openCreatePlaylist: () => void;
  openImportPlaylist: () => void;
  closeImportPlaylist: () => void;
  isImportOpen: boolean;
  setNavigateHandler: (fn: (view: NavView, payload?: any) => void) => void;
  refreshPlaylists: () => Promise<void>;
  playlists: Playlist[];
}

const PlaylistModalContext = createContext<PlaylistModalContextType | undefined>(undefined);

export const PlaylistModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [navigateHandler, setNavigateHandlerState] = useState<((view: NavView, payload?: any) => void) | undefined>(undefined);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const loadPlaylists = async () => {
    try {
      const data = await api.getPlaylists();
      setPlaylists(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const openAddToPlaylist = (song: Song) => {
    setSelectedSong(song);
    setIsModalOpen(true);
    loadPlaylists();
  };

  const openCreatePlaylist = () => {
    setIsCreateOpen(true);
  };

  const openImportPlaylist = () => {
    setIsImportOpen(true);
  };

  const closeImportPlaylist = () => {
    setIsImportOpen(false);
  };

  const setNavigateHandler = (fn: (view: NavView, payload?: any) => void) => {
    setNavigateHandlerState(() => fn);
  };

  const handleAddSong = async (playlistId: string) => {
    if (!selectedSong) return;
    try {
      await api.addSongToPlaylist(playlistId, selectedSong.id);
      showToast(`Added "${selectedSong.title}" to playlist`, 'success');
      setIsModalOpen(false);
      loadPlaylists();
    } catch (err: any) {
      showToast(err.message || 'Could not add song', 'error');
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setLoading(true);
      const created = await api.createPlaylist({
        title: newTitle.trim(),
        description: newDesc.trim(),
      });
      showToast(`Playlist "${created.title}" created!`, 'success');
      setNewTitle('');
      setNewDesc('');
      setIsCreateOpen(false);
      await loadPlaylists();

      if (selectedSong) {
        await api.addSongToPlaylist(created.id, selectedSong.id);
        showToast(`Added "${selectedSong.title}" to ${created.title}`, 'success');
        setIsModalOpen(false);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create playlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PlaylistModalContext.Provider
      value={{
        openAddToPlaylist,
        openCreatePlaylist,
        openImportPlaylist,
        closeImportPlaylist,
        isImportOpen,
        setNavigateHandler,
        refreshPlaylists: loadPlaylists,
        playlists,
      }}
    >
      {children}

      {/* Playlist Import Modal */}
      <PlaylistImportModal
        isOpen={isImportOpen}
        onClose={closeImportPlaylist}
        onNavigate={navigateHandler}
        onPlaylistCreated={loadPlaylists}
      />

      {/* Add To Playlist Dialog */}
      {isModalOpen && selectedSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#14141a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <ListMusic className="w-6 h-6 text-brand-400" />
                <div>
                  <h3 className="font-semibold text-lg text-white">Add to Playlist</h3>
                  <p className="text-xs text-zinc-400 truncate max-w-[260px]">{selectedSong.title} • {selectedSong.artist_name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 max-h-60 overflow-y-auto space-y-2 pr-1">
              {playlists.map((pl) => {
                const alreadyIn = pl.songs?.some((s) => s.id === selectedSong.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleAddSong(pl.id)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={pl.cover_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=100&q=80'}
                        alt={pl.title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-medium text-sm text-white">{pl.title}</div>
                        <div className="text-xs text-zinc-400">{pl.song_count || pl.songs?.length || 0} tracks</div>
                      </div>
                    </div>
                    {alreadyIn ? (
                      <span className="flex items-center gap-1 text-xs text-brand-400 font-medium">
                        <Check className="w-4 h-4" /> Added
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 font-medium"
              >
                <Plus className="w-4 h-4" /> New Playlist
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Playlist Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#14141a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="font-semibold text-lg text-white">Create New Playlist</h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Playlist Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midnight Vibing"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#1e1e28] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Give your playlist a mood or description..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-[#1e1e28] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newTitle.trim()}
                  className="px-5 py-2 text-sm font-semibold text-black bg-brand-500 hover:bg-brand-400 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PlaylistModalContext.Provider>
  );
};

export const usePlaylistModal = () => {
  const context = useContext(PlaylistModalContext);
  if (!context) throw new Error('usePlaylistModal must be used within PlaylistModalProvider');
  return context;
};
