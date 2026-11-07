import React, { useState, useEffect } from 'react';
import {
  Play,
  Shuffle,
  Repeat,
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Music2,
  Clock,
  Sparkles,
  Radio,
  Disc3,
  Heart,
} from 'lucide-react';
import { Song, Playlist, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useToast } from '../context/ToastContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import { SongRow } from '../components/SongRow';
import { PlaylistCover } from '../components/PlaylistCover';

interface PlaylistDetailViewProps {
  playlistId: string;
  onNavigate: (view: NavView, payload?: any) => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ playlistId, onNavigate }) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCover, setEditCover] = useState('');

  // Add Song Modal State
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [allCatalogueSongs, setAllCatalogueSongs] = useState<Song[]>([]);
  const [addSearchQuery, setAddSearchQuery] = useState('');

  const { playSong, repeat, cycleRepeat, currentSong, isPlaying } = useAudioPlayer();
  const { showToast } = useToast();
  const { refreshPlaylists } = usePlaylistModal();

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getPlaylistById(playlistId);
      setPlaylist(data);
      setEditTitle(data.title);
      setEditDesc(data.description || '');
      setEditCover(data.cover_url || '');
    } catch (err: any) {
      showToast(err.message || 'Failed to load playlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddSongModal = async () => {
    setIsAddSongOpen(true);
    try {
      const catalogue = await api.getSongs();
      setAllCatalogueSongs(catalogue);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTrack = async (songId: string) => {
    try {
      const updated = await api.addSongToPlaylist(playlistId, songId);
      setPlaylist(updated);
      refreshPlaylists();
      showToast('Track added to playlist', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add song', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, [playlistId]);

  const handlePlayAll = (shuffleMode = false) => {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    const songsToPlay = [...playlist.songs];
    if (shuffleMode) {
      songsToPlay.sort(() => Math.random() - 0.5);
    }
    playSong(songsToPlay[0], songsToPlay);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updatePlaylist(playlistId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        cover_url: editCover.trim() || undefined,
      });
      setPlaylist(updated);
      setIsEditOpen(false);
      refreshPlaylists();
      showToast('Playlist updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update playlist', 'error');
    }
  };

  const handleDeletePlaylist = async () => {
    if (!window.confirm(`Are you sure you want to delete playlist "${playlist?.title}"?`)) return;
    try {
      await api.deletePlaylist(playlistId);
      showToast('Playlist deleted', 'info');
      refreshPlaylists();
      onNavigate('playlists');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete playlist', 'error');
    }
  };

  const handleRemoveTrack = async (songId: string) => {
    try {
      const updated = await api.removeSongFromPlaylist(playlistId, songId);
      setPlaylist(updated);
      refreshPlaylists();
      showToast('Track removed from playlist', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove song', 'error');
    }
  };

  const handleMoveTrack = async (index: number, direction: 'up' | 'down') => {
    if (!playlist?.songs) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlist.songs.length) return;

    const newSongs = [...playlist.songs];
    const [moved] = newSongs.splice(index, 1);
    newSongs.splice(targetIndex, 0, moved);

    try {
      const updated = await api.reorderPlaylist(playlistId, newSongs.map((s) => s.id));
      setPlaylist(updated);
    } catch (err: any) {
      showToast(err.message || 'Reorder failed', 'error');
    }
  };

  const formatTotalTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  if (loading) {
    return <div className="p-8 h-80 animate-pulse bg-white/5 rounded-3xl m-6" />;
  }

  if (!playlist) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Playlist not found</h2>
        <button
          onClick={() => onNavigate('playlists')}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-2xl shadow-md transition-all"
        >
          Back to Playlists
        </button>
      </div>
    );
  }

  const isAishu = playlist.title.toLowerCase() === 'aishu';
  const allSongs = playlist.songs || [];
  const totalDuration = allSongs.reduce((acc, s) => acc + s.duration, 0);

  // Search filter
  const q = searchQuery.toLowerCase().trim();
  const displayedSongs = allSongs.filter(
    (s) =>
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.artist_name.toLowerCase().includes(q) ||
      s.album_name?.toLowerCase().includes(q)
  );

  return (
    <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 md:px-8 space-y-8 pb-44 pt-4">
      {/* Hero Header */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-[#161618] border border-white/10 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 w-full overflow-hidden">
        {/* Artwork Card */}
        <div className="relative group shrink-0 w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black">
          <PlaylistCover
            songs={playlist.songs}
            fallbackUrl={playlist.cover_url}
            title={playlist.title}
            className="group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Metadata Details */}
        <div className="flex-1 space-y-2 text-center sm:text-left min-w-0 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-white uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#eab308]" />
            <span>{isAishu ? 'Official Collection' : 'Curated Playlist'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            {playlist.title}
          </h1>

          <p className="text-xs sm:text-sm text-[#8e8e93] max-w-2xl leading-relaxed">
            {playlist.description ||
              (isAishu
                ? 'Your imported high-fidelity music collection preserved in original audio quality.'
                : 'Curated music playlist on Sonora.')}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-[#8e8e93] font-medium pt-1">
            <span className="text-white font-medium">Curated by Sonora</span>
            <span>•</span>
            <span className="text-white font-semibold">{allSongs.length} Tracks</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-[#8e8e93]">
              <Clock className="w-3.5 h-3.5" />
              {formatTotalTime(totalDuration)}
            </span>
            {isAishu && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-mono text-[11px] font-semibold">
                  Lossless Stream
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar & Search In Collection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Playback Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handlePlayAll(false)}
            disabled={allSongs.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-bold text-xs shadow-md disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
            title="Play playlist"
          >
            <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
            <span>Play Collection</span>
          </button>

          <button
            onClick={() => handlePlayAll(true)}
            disabled={allSongs.length === 0}
            className="p-2.5 rounded-full bg-[#161618] hover:bg-[#202024] text-[#8e8e93] hover:text-white border border-white/10 disabled:opacity-40 transition-colors"
            title="Shuffle playlist"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={cycleRepeat}
            className={`p-2.5 rounded-full border transition-colors ${
              repeat !== 'off'
                ? 'bg-white text-black border-white'
                : 'bg-[#161618] hover:bg-[#202024] text-[#8e8e93] hover:text-white border-white/10'
            }`}
            title={`Repeat mode: ${repeat}`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Live Filter & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* In-playlist Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search in ${playlist.title}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161618] border border-white/10 rounded-full pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
            />
          </div>

          <button
            onClick={openAddSongModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#161618] hover:bg-[#202024] text-white border border-white/10 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tracks</span>
          </button>

          <button
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#161618] hover:bg-[#202024] text-xs font-medium text-white border border-white/10 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {!isAishu && (
            <button
              onClick={handleDeletePlaylist}
              className="p-2 rounded-full bg-[#161618] hover:bg-rose-500/20 text-[#8e8e93] hover:text-rose-400 border border-white/10 transition-colors"
              title="Delete playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tracks Table */}
      <div>
        {allSongs.length === 0 ? (
          <div className="p-12 text-center bg-[#161618] rounded-2xl border border-white/10 space-y-3">
            <Music2 className="w-10 h-10 text-zinc-500 mx-auto" />
            <h3 className="text-base font-bold text-white">This collection is empty</h3>
            <p className="text-xs text-[#8e8e93]">
              Use the Curator Studio or Add Tracks button to import songs
            </p>
            <button
              onClick={() => onNavigate('admin')}
              className="px-5 py-2.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-full shadow-lg transition-all"
            >
              Open Curator Studio
            </button>
          </div>
        ) : (
          <div className="bg-[#161618] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            {displayedSongs.map((song, i) => (
              <div
                key={`${song.id}-${i}`}
                className="flex items-center justify-between group/row hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <SongRow
                    song={song}
                    index={i}
                    contextQueue={displayedSongs}
                    onNavigate={onNavigate}
                    onRemove={() => handleRemoveTrack(song.id)}
                  />
                </div>

                {/* Reorder Up/Down arrows */}
                <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 pr-4 transition-opacity shrink-0">
                  <button
                    disabled={i === 0}
                    onClick={() => handleMoveTrack(i, 'up')}
                    className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/5"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={i === allSongs.length - 1}
                    onClick={() => handleMoveTrack(i, 'down')}
                    className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/5"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#161618] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="font-bold text-base text-white">Edit Playlist Details</h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={editCover}
                  onChange={(e) => setEditCover(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Song to Playlist Modal */}
      {isAddSongOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#161618] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <h3 className="font-bold text-base text-white">Add Songs to Collection</h3>
              <button
                onClick={() => setIsAddSongOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search songs to add..."
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {allCatalogueSongs
                .filter(
                  (s) =>
                    !addSearchQuery ||
                    s.title.toLowerCase().includes(addSearchQuery.toLowerCase()) ||
                    s.artist_name.toLowerCase().includes(addSearchQuery.toLowerCase())
                )
                .map((song) => {
                  const alreadyIn = allSongs.some((ps) => ps.id === song.id);
                  return (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 truncate min-w-0 pr-2">
                        <img
                          src={song.cover_url}
                          alt={song.title}
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                        <div className="truncate text-xs">
                          <div className="font-bold text-white truncate">{song.title}</div>
                          <div className="text-zinc-400 truncate">{song.artist_name}</div>
                        </div>
                      </div>

                      <button
                        disabled={alreadyIn}
                        onClick={() => handleAddTrack(song.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                          alreadyIn
                            ? 'bg-white/5 text-zinc-500 cursor-default'
                            : 'bg-white hover:bg-zinc-200 text-black shadow-md'
                        }`}
                      >
                        {alreadyIn ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
