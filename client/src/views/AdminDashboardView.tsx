import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  UploadCloud,
  FolderOpen,
  Music2,
  Disc3,
  Mic2,
  Trash2,
  Edit2,
  Plus,
  Play,
  Database,
  Cloud,
  HardDrive,
  Sparkles,
  Flame,
  Search,
  X,
  Radio,
} from 'lucide-react';
import { Song, Album, Artist, NavView } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { BulkImportStudio } from '../components/BulkImportStudio';
import { CloudinarySyncStudio } from '../components/CloudinarySyncStudio';

interface AdminDashboardViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

type AdminTab = 'bulk-import' | 'cloudinary-sync' | 'upload' | 'songs' | 'albums' | 'artists';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { playSong } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState<AdminTab>('bulk-import');
  const [stats, setStats] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload Form State
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [genre, setGenre] = useState('Synthwave');
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [detectedDuration, setDetectedDuration] = useState<number>(0);

  // Upload Progress
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Edit Song Modal State
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // New Album Form Modal
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumArtist, setNewAlbumArtist] = useState('');
  const [newAlbumCover, setNewAlbumCover] = useState('');

  // New Artist Form Modal
  const [newArtistName, setNewArtistName] = useState('');
  const [newArtistBio, setNewArtistBio] = useState('');
  const [newArtistAvatar, setNewArtistAvatar] = useState('');

  // Search filter in songs tab
  const [songSearchQuery, setSongSearchQuery] = useState('');

  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [statsData, songsData, albumsData, artistsData] = await Promise.all([
        api.getAdminStats(),
        api.getSongs(),
        api.getAlbums(),
        api.getArtists(),
      ]);
      setStats(statsData);
      setSongs(songsData);
      setAlbums(albumsData);
      setArtists(artistsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle Audio File Selection & Duration Extraction
  const handleAudioSelect = (file: File) => {
    setAudioFile(file);
    if (!songTitle) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setSongTitle(nameWithoutExt);
    }

    const objectUrl = URL.createObjectURL(file);
    const audioTest = new Audio();
    audioTest.src = objectUrl;
    audioTest.addEventListener('loadedmetadata', () => {
      setDetectedDuration(Math.round(audioTest.duration) || 180);
      URL.revokeObjectURL(objectUrl);
    });
  };

  // Handle Cover Art Selection & Preview
  const handleCoverSelect = (file: File) => {
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCoverPreview(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload Song Form Submission
  const handleSongUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim() || !artistName.trim()) {
      showToast('Please enter both Song Title and Artist Name', 'error');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);
      setUploadStatus('Preparing assets for Cloudinary...');

      let finalAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
      let finalAudioPublicId = `sonora/audio/${Date.now()}`;
      let finalCoverUrl = coverPreview || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80';

      if (audioFile || coverFile) {
        setUploadProgress(35);
        setUploadStatus('Streaming audio file to Cloudinary (resource_type: video)...');

        const formData = new FormData();
        if (audioFile) formData.append('audio', audioFile);
        if (coverFile) formData.append('cover', coverFile);

        const uploadRes = await api.uploadFiles(formData);
        setUploadProgress(70);
        setUploadStatus('Cloudinary streaming URL resolved. Connecting Supabase...');

        if (uploadRes.audio?.url) {
          finalAudioUrl = uploadRes.audio.url;
          finalAudioPublicId = uploadRes.audio.publicId;
        }
        if (uploadRes.cover?.url) {
          finalCoverUrl = uploadRes.cover.url;
        }
      }

      setUploadProgress(85);
      setUploadStatus('Writing track metadata to Supabase catalogue...');

      const matchedArtist = artists.find((a) => a.name.toLowerCase() === artistName.trim().toLowerCase());
      const matchedAlbum = albums.find((a) => a.title.toLowerCase() === albumName.trim().toLowerCase());

      const newSong = await api.createSong({
        title: songTitle.trim(),
        artist_name: artistName.trim(),
        artist_id: matchedArtist ? matchedArtist.id : null,
        album_name: albumName.trim() || null,
        album_id: matchedAlbum ? matchedAlbum.id : null,
        genre: genre || 'Alternative',
        duration: detectedDuration || 215,
        release_year: releaseYear,
        cover_url: finalCoverUrl,
        audio_url: finalAudioUrl,
        cloudinary_public_id: finalAudioPublicId,
        cloudinary_format: 'mp3',
        is_featured: isFeatured,
        is_trending: isTrending,
      });

      setUploadProgress(100);
      setUploadStatus('Song published to Sonora catalogue!');
      showToast(`"${newSong.title}" is now live and streamable!`, 'success');

      setSongTitle('');
      setArtistName('');
      setAlbumName('');
      setAudioFile(null);
      setCoverFile(null);
      setCoverPreview('');
      setDetectedDuration(0);

      await loadAllData();
      setActiveTab('songs');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const handleDeleteSong = async (id: string, title: string) => {
    if (!window.confirm(`Permanently remove track "${title}" from catalogue?`)) return;
    try {
      await api.deleteSong(id);
      showToast(`Track "${title}" deleted`, 'info');
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete song', 'error');
    }
  };

  const handleUpdateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;

    try {
      await api.updateSong(editingSong.id, {
        title: editingSong.title,
        artist_name: editingSong.artist_name,
        album_name: editingSong.album_name,
        genre: editingSong.genre,
        release_year: editingSong.release_year,
        is_featured: editingSong.is_featured,
        is_trending: editingSong.is_trending,
      });
      showToast('Track updated successfully', 'success');
      setEditingSong(null);
      await loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const filteredSongs = songs.filter((s) => {
    const q = songSearchQuery.toLowerCase().trim();
    return !q || s.title.toLowerCase().includes(q) || s.artist_name.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q);
  });

  return (
    <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-8 pb-44">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Master Control & Media Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Curator Studio</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage Cloudinary audio streams, artwork, catalogue metadata, and Supabase database.
          </p>
        </div>

        {/* Cloud / Storage Status Pill */}
        <div className="flex items-center gap-2.5 bg-[#14141d] border border-white/10 p-2 px-3.5 rounded-2xl text-xs shrink-0 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <HardDrive className={`w-3.5 h-3.5 ${stats?.r2Configured ? 'text-sky-400' : 'text-amber-400'}`} />
            <span>Cloudflare R2:</span>
            <span className={`font-bold ${stats?.r2Configured ? 'text-brand-neon' : 'text-amber-400'}`}>
              {stats?.r2Configured ? 'Connected' : 'Local Fallback'}
            </span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Database className={`w-3.5 h-3.5 ${stats?.supabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>Supabase:</span>
            <span className={`font-bold ${stats?.supabaseConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
              {stats?.supabaseConfigured ? 'Connected' : 'Local DB'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#14141a] border border-white/5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-1">
              <Music2 className="w-3.5 h-3.5 text-brand-neon" />
              <span>Total Tracks</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{stats.totalSongs}</div>
          </div>
          <div className="p-4 bg-[#14141a] border border-white/5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-1">
              <Mic2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Artists</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{stats.totalArtists}</div>
          </div>
          <div className="p-4 bg-[#14141a] border border-white/5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-1">
              <Disc3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Albums</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{stats.totalAlbums}</div>
          </div>
          <div className="p-4 bg-[#14141a] border border-white/5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-1">
              <Radio className="w-3.5 h-3.5 text-pink-400" />
              <span>Total Streams</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{stats.totalStreams.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'cloudinary-sync', label: 'Cloudinary Cloud Sync (Direct CDN)', icon: Cloud },
          { id: 'bulk-import', label: 'Local Folder Ingestion (AISHU)', icon: FolderOpen },
          { id: 'upload', label: 'Single Track Upload', icon: UploadCloud },
          { id: 'songs', label: `Manage Tracks (${songs.length})`, icon: Music2 },
          { id: 'albums', label: `Manage Albums (${albums.length})`, icon: Disc3 },
          { id: 'artists', label: `Manage Artists (${artists.length})`, icon: Mic2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-500 text-black shadow-md shadow-brand-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: CLOUDINARY CLOUD SYNC */}
      {activeTab === 'cloudinary-sync' && (
        <CloudinarySyncStudio onNavigate={onNavigate} onImportComplete={loadAllData} />
      )}

      {/* TAB 0: BULK FOLDER IMPORT STUDIO (AISHU) */}
      {activeTab === 'bulk-import' && (
        <BulkImportStudio onNavigate={onNavigate} onImportComplete={loadAllData} />
      )}

      {/* TAB 1: UPLOAD SONG STUDIO */}
      {activeTab === 'upload' && (
        <div className="w-full bg-[#121218] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-brand-neon" />
              <span>Direct Cloudinary & Supabase Studio Ingestion</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Deliver lossless audio with HTTP range streaming via Cloudinary, synced directly to your Supabase catalogue.
            </p>
          </div>

          <form onSubmit={handleSongUploadSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
              {/* Left Column: Media Dropzones (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Media Source
                </div>

                {/* Audio File Picker */}
                <div
                  onClick={() => audioInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-brand-500/50 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center min-h-[140px]"
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => e.target.files?.[0] && handleAudioSelect(e.target.files[0])}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-brand-500/10 text-brand-neon flex items-center justify-center mb-2">
                    <Music2 className="w-5 h-5" />
                  </div>
                  {audioFile ? (
                    <div>
                      <span className="text-xs font-bold text-white block truncate max-w-[240px]">
                        {audioFile.name}
                      </span>
                      <span className="text-[11px] text-brand-neon font-mono mt-0.5 block">
                        {(audioFile.size / (1024 * 1024)).toFixed(1)} MB • {detectedDuration}s duration
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block">
                        Select Audio File
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        MP3, WAV, FLAC, M4A, OGG
                      </span>
                    </div>
                  )}
                </div>

                {/* Cover Artwork Picker */}
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-brand-500/50 rounded-2xl p-5 text-center cursor-pointer transition-colors bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center min-h-[140px]"
                >
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleCoverSelect(e.target.files[0])}
                    className="hidden"
                  />
                  {coverPreview ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={coverPreview}
                        alt="Cover Preview"
                        className="w-16 h-16 rounded-xl object-cover shadow-md border border-white/10 shrink-0"
                      />
                      <div className="text-left">
                        <span className="text-xs font-bold text-white block">Artwork Ready</span>
                        <span className="text-[10px] text-zinc-400 mt-0.5 block">Click to change cover</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-2">
                        <Disc3 className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-zinc-200 block">
                        Select Album Cover
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">JPG, PNG, WEBP</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Metadata & Actions (7 Cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Track Metadata
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Track Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Celestial Orbit"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Artist Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aetheria"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Album Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Neon Odyssey (or leave blank for Single)"
                      value={albumName}
                      onChange={(e) => setAlbumName(e.target.value)}
                      className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Genre
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Synthwave">Synthwave</option>
                      <option value="Neo-Soul">Neo-Soul</option>
                      <option value="Cyberpunk">Cyberpunk</option>
                      <option value="Indie Folk">Indie Folk</option>
                      <option value="Deep House">Deep House</option>
                      <option value="Electronic">Electronic</option>
                      <option value="Ambient">Ambient</option>
                      <option value="Lo-Fi Chill">Lo-Fi Chill</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Release Year
                    </label>
                    <input
                      type="number"
                      value={releaseYear}
                      onChange={(e) => setReleaseYear(parseInt(e.target.value, 10))}
                      className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  {/* Featured & Trending Toggles */}
                  <div className="flex items-center gap-5 pt-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-zinc-300">
                      <input
                        type="checkbox"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-brand-500 focus:ring-0 cursor-pointer"
                      />
                      <Sparkles className="w-3.5 h-3.5 text-brand-neon" />
                      <span>Featured Hero</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-zinc-300">
                      <input
                        type="checkbox"
                        checked={isTrending}
                        onChange={(e) => setIsTrending(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Trending Shelf</span>
                    </label>
                  </div>
                </div>

                {/* Live Progress Bar */}
                {uploading && (
                  <div className="space-y-1.5 p-3.5 bg-white/5 rounded-2xl border border-white/10 animate-fade-in">
                    <div className="flex justify-between text-xs font-semibold text-zinc-300">
                      <span>{uploadStatus}</span>
                      <span className="font-mono text-brand-neon">{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-600 to-brand-neon transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading || !songTitle.trim() || !artistName.trim()}
                  className="w-full py-3 rounded-2xl bg-brand-500 hover:bg-brand-neon text-black font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-4"
                >
                  {uploading ? 'Publishing Track...' : 'Upload & Publish to Sonora'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MANAGE SONGS TABLE */}
      {activeTab === 'songs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tracks by title or artist..."
                value={songSearchQuery}
                onChange={(e) => setSongSearchQuery(e.target.value)}
                className="w-full bg-[#14141a] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <button
              onClick={() => setActiveTab('upload')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500 text-black text-xs font-bold hover:bg-brand-neon transition-colors self-start"
            >
              <Plus className="w-3.5 h-3.5" /> Add Track
            </button>
          </div>

          <div className="bg-[#121218] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-zinc-400 font-bold uppercase tracking-wider border-b border-white/5">
                  <tr>
                    <th className="p-3 pl-4">Track</th>
                    <th className="p-3">Artist</th>
                    <th className="p-3">Album</th>
                    <th className="p-3">Genre</th>
                    <th className="p-3">Streams</th>
                    <th className="p-3 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {filteredSongs.map((song) => (
                    <tr key={song.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 pl-4 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                          <img
                            src={song.cover_url}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-white truncate max-w-[170px]">
                            {song.title}
                          </div>
                          {song.is_featured && (
                            <span className="text-[9px] font-bold text-brand-neon uppercase">
                              Featured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-medium truncate max-w-[120px]">{song.artist_name}</td>
                      <td className="p-3 text-zinc-400 truncate max-w-[120px]">{song.album_name || 'Single'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px]">
                          {song.genre}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{song.plays_count.toLocaleString()}</td>
                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => playSong(song, songs)}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white"
                            title="Play"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => setEditingSong(song)}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSong(song.id, song.title)}
                            className="p-1.5 hover:bg-rose-500/15 rounded-lg text-zinc-400 hover:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANAGE ALBUMS */}
      {activeTab === 'albums' && (
        <div className="space-y-6">
          {/* Create Album Card */}
          <div className="bg-[#121218] border border-white/10 rounded-3xl p-6 max-w-2xl space-y-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Disc3 className="w-4 h-4 text-brand-neon" />
              <span>Create New Album</span>
            </h3>
            <div className="space-y-2.5">
              <input
                type="text"
                placeholder="Album Title *"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                placeholder="Artist Name *"
                value={newAlbumArtist}
                onChange={(e) => setNewAlbumArtist(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <input
                type="url"
                placeholder="Cover Image URL *"
                value={newAlbumCover}
                onChange={(e) => setNewAlbumCover(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newAlbumTitle || !newAlbumArtist) return;
                  await api.createAlbum({
                    title: newAlbumTitle,
                    artist_name: newAlbumArtist,
                    cover_url: newAlbumCover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                    release_year: new Date().getFullYear(),
                  });
                  showToast('Album created', 'success');
                  setNewAlbumTitle('');
                  setNewAlbumArtist('');
                  setNewAlbumCover('');
                  loadAllData();
                }}
                className="px-4 py-1.5 bg-brand-500 hover:bg-brand-neon text-black text-xs font-bold rounded-xl"
              >
                Add Album
              </button>
            </div>
          </div>

          {/* Albums Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 gap-5 w-full">
            {albums.map((album) => (
              <div key={album.id} className="p-3 bg-[#14141a] border border-white/5 rounded-2xl relative group">
                <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2 shadow-md bg-zinc-900">
                  <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover" />
                </div>
                <h4 className="font-bold text-xs text-white truncate">{album.title}</h4>
                <p className="text-[11px] text-zinc-400 truncate">{album.artist_name}</p>
                <button
                  onClick={async () => {
                    if (window.confirm(`Delete album ${album.title}?`)) {
                      await api.deleteAlbum(album.id);
                      showToast('Album deleted', 'info');
                      loadAllData();
                    }
                  }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-black/60 text-zinc-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MANAGE ARTISTS */}
      {activeTab === 'artists' && (
        <div className="space-y-6">
          {/* Create Artist Form */}
          <div className="bg-[#121218] border border-white/10 rounded-3xl p-6 max-w-2xl space-y-3">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Mic2 className="w-4 h-4 text-purple-400" />
              <span>Add New Artist</span>
            </h3>
            <div className="space-y-2.5">
              <input
                type="text"
                placeholder="Artist Name *"
                value={newArtistName}
                onChange={(e) => setNewArtistName(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <input
                type="text"
                placeholder="Artist Biography"
                value={newArtistBio}
                onChange={(e) => setNewArtistBio(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <input
                type="url"
                placeholder="Avatar Image URL *"
                value={newArtistAvatar}
                onChange={(e) => setNewArtistAvatar(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newArtistName) return;
                  await api.createArtist({
                    name: newArtistName,
                    bio: newArtistBio,
                    avatar_url: newArtistAvatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
                    monthly_listeners: 100000,
                    is_verified: true,
                  });
                  showToast('Artist added', 'success');
                  setNewArtistName('');
                  setNewArtistBio('');
                  setNewArtistAvatar('');
                  loadAllData();
                }}
                className="px-4 py-1.5 bg-brand-500 hover:bg-brand-neon text-black text-xs font-bold rounded-xl"
              >
                Add Artist
              </button>
            </div>
          </div>

          {/* Artists Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-5 w-full">
            {artists.map((artist) => (
              <div key={artist.id} className="p-3.5 bg-[#14141a] border border-white/5 rounded-2xl text-center relative group">
                <div className="w-20 h-20 rounded-full mx-auto overflow-hidden mb-2 shadow-md border border-white/10 bg-zinc-900">
                  <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="font-bold text-xs text-white truncate">{artist.name}</h4>
                <p className="text-[10px] text-zinc-400">{(artist.monthly_listeners / 1000).toFixed(0)}k listeners</p>
                <button
                  onClick={async () => {
                    if (window.confirm(`Delete artist ${artist.name}?`)) {
                      await api.deleteArtist(artist.id);
                      showToast('Artist deleted', 'info');
                      loadAllData();
                    }
                  }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-zinc-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Song Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#14141a] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
              <h3 className="font-bold text-sm text-white">Edit Track Metadata</h3>
              <button onClick={() => setEditingSong(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSong} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingSong.title}
                  onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                  className="w-full bg-[#1e1e28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Artist</label>
                <input
                  type="text"
                  required
                  value={editingSong.artist_name}
                  onChange={(e) => setEditingSong({ ...editingSong, artist_name: e.target.value })}
                  className="w-full bg-[#1e1e28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Album</label>
                <input
                  type="text"
                  value={editingSong.album_name || ''}
                  onChange={(e) => setEditingSong({ ...editingSong, album_name: e.target.value })}
                  className="w-full bg-[#1e1e28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-400 mb-1">Genre</label>
                <input
                  type="text"
                  value={editingSong.genre}
                  onChange={(e) => setEditingSong({ ...editingSong, genre: e.target.value })}
                  className="w-full bg-[#1e1e28] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-5 pt-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editingSong.is_featured}
                    onChange={(e) => setEditingSong({ ...editingSong, is_featured: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-brand-500"
                  />
                  <span>Featured</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editingSong.is_trending}
                    onChange={(e) => setEditingSong({ ...editingSong, is_trending: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-amber-500"
                  />
                  <span>Trending</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSong(null)}
                  className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-black bg-brand-500 hover:bg-brand-neon rounded-xl"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
