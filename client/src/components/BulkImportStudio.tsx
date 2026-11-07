import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen,
  Music2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  ListMusic,
  ShieldAlert,
  HardDrive,
  Cloud,
  Copy,
  Check,
  Disc3,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Song, Playlist, NavView } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import {
  extractAudioMetadata,
  ExtractedTrackMetadata,
  computeFileHash,
  parseFilename,
} from '../utils/audioMetadata';

interface BulkImportStudioProps {
  onNavigate: (view: NavView, payload?: any) => void;
  onImportComplete?: () => void;
}

interface TrackImportItem extends ExtractedTrackMetadata {
  id: string;
  selected: boolean;
  status: 'idle' | 'hashing' | 'uploading' | 'completed' | 'duplicate_skipped' | 'failed';
  uploadProgress: number;
  errorMessage?: string;
  importedSong?: Song;
}

interface StorageStatus {
  supabaseConfigured: boolean;
  r2Configured: boolean;
  cloudinaryConfigured: boolean;
  missingCredentials: { supabase: string[]; r2: string[]; cloudinary: string[] };
  storageMode: string;
}

export const BulkImportStudio: React.FC<BulkImportStudioProps> = ({
  onNavigate,
  onImportComplete,
}) => {
  const { showToast } = useToast();
  const { playSong } = useAudioPlayer();
  const { refreshPlaylists } = usePlaylistModal();

  // Storage Credentials Status
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Folder & File Selection State
  const [folderName, setFolderName] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [tracks, setTracks] = useState<TrackImportItem[]>([]);
  const [existingHashes, setExistingHashes] = useState<Set<string>>(new Set());

  // Search & Filter in Discovered Tracks
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'duplicates' | 'completed'>('all');

  // Confirmation & Upload Execution State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentImportingIndex, setCurrentImportingIndex] = useState(0);

  // Summary State
  const [summary, setSummary] = useState<{
    totalDiscovered: number;
    successful: number;
    duplicatesSkipped: number;
    failed: number;
    totalBytes: number;
    collectionName: string;
    collection?: Playlist;
  } | null>(null);

  // Copied hash tooltip
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load storage status and existing songs for duplicate checking
  const loadInitialContext = async () => {
    try {
      setLoadingStatus(true);
      const [status, existingSongs] = await Promise.all([
        api.getStorageStatus().catch(() => ({
          supabaseConfigured: false,
          r2Configured: false,
          cloudinaryConfigured: false,
          missingCredentials: {
            supabase: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
            r2: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
            cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
          },
          storageMode: 'Local High-Fidelity Audio Storage (Byte-for-byte SHA-256)',
        })),
        api.getSongs().catch(() => []),
      ]);

      setStorageStatus(status);
      const hashes = new Set<string>();
      existingSongs.forEach((s) => {
        if (s.file_hash) hashes.add(s.file_hash.toLowerCase());
      });
      setExistingHashes(hashes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadInitialContext();
  }, []);

  // Handle Folder Selection via WebkitDirectory
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Filter audio files recursively
    const audioExts = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.webm'];
    const audioFiles: File[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const lowerName = file.name.toLowerCase();
      if (audioExts.some((ext) => lowerName.endsWith(ext))) {
        audioFiles.push(file);
      }
    }

    if (audioFiles.length === 0) {
      showToast('No audio files (.mp3, .wav, .flac, etc.) found in the selected folder.', 'info');
      return;
    }

    // Determine folder name from relative path
    const samplePath = (audioFiles[0] as any).webkitRelativePath || '';
    const rootFolder = samplePath.split('/')[0] || 'D:\\MyMusic';
    setFolderName(rootFolder);

    setScanning(true);
    setScanProgress({ current: 0, total: audioFiles.length });

    const batchHashes = new Set<string>();
    const discoveredTracks: TrackImportItem[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setScanProgress({ current: i + 1, total: audioFiles.length });
      // Yield to main thread every file so React renders the scan progress bar in real time
      await new Promise((r) => setTimeout(r, 0));

      try {
        const metadata = await extractAudioMetadata(file);
        const lowerHash = metadata.fileHash.toLowerCase();

        let isDuplicate = false;
        let duplicateReason = '';

        if (existingHashes.has(lowerHash)) {
          isDuplicate = true;
          duplicateReason = 'Already imported in SONORA';
        } else if (batchHashes.has(lowerHash)) {
          isDuplicate = true;
          duplicateReason = 'Duplicate file within this folder';
        } else {
          batchHashes.add(lowerHash);
        }

        discoveredTracks.push({
          ...metadata,
          id: `item-${i}-${metadata.fileHash.substring(0, 8)}`,
          selected: !isDuplicate,
          status: isDuplicate ? 'duplicate_skipped' : 'idle',
          uploadProgress: isDuplicate ? 100 : 0,
          isDuplicate,
          duplicateReason,
        });
      } catch (err) {
        console.warn(`Failed extracting full metadata for ${file.name}, using safe fallback:`, err);
        // Resilient fallback: compute hash and parse filename so no track is missed
        try {
          const fileHash = await computeFileHash(file);
          const parsed = parseFilename(file.name);
          const lowerHash = fileHash.toLowerCase();
          const isDuplicate = existingHashes.has(lowerHash) || batchHashes.has(lowerHash);
          if (!isDuplicate) batchHashes.add(lowerHash);

          discoveredTracks.push({
            file,
            title: parsed.title,
            artist: parsed.artist,
            album: parsed.album,
            genre: 'Soundtrack',
            duration: 180,
            releaseYear: new Date().getFullYear(),
            fileHash,
            fileSize: file.size,
            id: `item-${i}-${fileHash.substring(0, 8)}`,
            selected: !isDuplicate,
            status: isDuplicate ? 'duplicate_skipped' : 'idle',
            uploadProgress: isDuplicate ? 100 : 0,
            isDuplicate,
            duplicateReason: isDuplicate ? 'Duplicate checksum' : undefined,
          });
        } catch (fallbackErr) {
          console.error(`Unrecoverable read error for ${file.name}:`, fallbackErr);
        }
      }
    }

    setTracks(discoveredTracks);
    setScanning(false);
    setImportCompleted(false);
    setSummary(null);

    const dupCount = discoveredTracks.filter((t) => t.isDuplicate).length;
    showToast(
      `Discovered ${discoveredTracks.length} audio files (${discoveredTracks.length - dupCount} ready, ${dupCount} duplicate${dupCount === 1 ? '' : 's'})`,
      'success'
    );
  };

  // Select First 5 Songs for Initial Verification (Section 6 requirement)
  const handleSelectFirstFive = () => {
    let count = 0;
    const updated = tracks.map((t) => {
      if (!t.isDuplicate && count < 5) {
        count++;
        return { ...t, selected: true };
      }
      return { ...t, selected: false };
    });
    setTracks(updated);
    showToast('Selected the first 5 unique songs for test verification', 'info');
  };

  const handleSelectAll = (select: boolean) => {
    setTracks((prev) =>
      prev.map((t) => (t.isDuplicate ? { ...t, selected: false } : { ...t, selected: select }))
    );
  };

  const toggleTrackSelection = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleUpdateTrackField = (id: string, field: 'title' | 'artist' | 'album', value: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Execute Bulk Upload to AISHU Collection
  const executeImport = async () => {
    setShowConfirmModal(false);
    setIsImporting(true);

    const selectedTracks = tracks.filter((t) => t.selected && t.status !== 'completed');
    if (selectedTracks.length === 0) {
      showToast('No tracks selected for import', 'info');
      setIsImporting(false);
      return;
    }

    let successCount = 0;
    let duplicateSkippedCount = tracks.filter((t) => t.status === 'duplicate_skipped').length;
    let failedCount = 0;
    let totalBytesConsumed = 0;
    let aishuCollection: Playlist | undefined;

    for (let i = 0; i < selectedTracks.length; i++) {
      const item = selectedTracks[i];
      setCurrentImportingIndex(i + 1);
      setOverallProgress(Math.round(((i) / selectedTracks.length) * 100));

      // Mark track uploading
      setTracks((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, status: 'uploading', uploadProgress: 30 } : t))
      );

      try {
        const formData = new FormData();
        formData.append('audio', item.file);
        formData.append('title', item.title);
        formData.append('artist_name', item.artist);
        formData.append('album_name', item.album);
        formData.append('duration', String(item.duration));
        formData.append('genre', item.genre);
        formData.append('release_year', String(item.releaseYear));
        formData.append('file_hash', item.fileHash);
        formData.append('collection_name', 'AISHU');

        if (item.artworkBlob) {
          formData.append('cover', item.artworkBlob, 'cover.jpg');
        }

        // Advance progress
        setTracks((prev) =>
          prev.map((t) => (t.id === item.id ? { ...t, uploadProgress: 75 } : t))
        );

        const res = await api.uploadBulkTrack(formData);

        if (res.skipped) {
          duplicateSkippedCount++;
          setTracks((prev) =>
            prev.map((t) =>
              t.id === item.id
                ? {
                    ...t,
                    status: 'duplicate_skipped',
                    uploadProgress: 100,
                    duplicateReason: res.message || 'Duplicate SHA-256 hash',
                    importedSong: res.song,
                  }
                : t
            )
          );
        } else {
          successCount++;
          totalBytesConsumed += item.fileSize;
          aishuCollection = res.collection;
          setTracks((prev) =>
            prev.map((t) =>
              t.id === item.id
                ? {
                    ...t,
                    status: 'completed',
                    uploadProgress: 100,
                    importedSong: res.song,
                  }
                : t
            )
          );
        }
      } catch (err: any) {
        console.error(`Failed to upload ${item.title}:`, err);
        failedCount++;
        setTracks((prev) =>
          prev.map((t) =>
            t.id === item.id
              ? {
                  ...t,
                  status: 'failed',
                  uploadProgress: 0,
                  errorMessage: err.message || 'Upload failed',
                }
              : t
          )
        );
      }
    }

    setOverallProgress(100);
    setIsImporting(false);
    setImportCompleted(true);
    refreshPlaylists();

    const summaryResult = {
      totalDiscovered: tracks.length,
      successful: successCount,
      duplicatesSkipped: duplicateSkippedCount,
      failed: failedCount,
      totalBytes: totalBytesConsumed,
      collectionName: 'AISHU',
      collection: aishuCollection,
    };

    setSummary(summaryResult);
    showToast(`Batch completed: ${successCount} songs imported into AISHU collection!`, 'success');

    if (onImportComplete) {
      onImportComplete();
    }
  };

  // Retry a single failed track
  const handleRetryTrack = async (item: TrackImportItem) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, status: 'uploading', uploadProgress: 40, errorMessage: undefined } : t))
    );

    try {
      const formData = new FormData();
      formData.append('audio', item.file);
      formData.append('title', item.title);
      formData.append('artist_name', item.artist);
      formData.append('album_name', item.album);
      formData.append('duration', String(item.duration));
      formData.append('genre', item.genre);
      formData.append('release_year', String(item.releaseYear));
      formData.append('file_hash', item.fileHash);
      formData.append('collection_name', 'AISHU');

      if (item.artworkBlob) {
        formData.append('cover', item.artworkBlob, 'cover.jpg');
      }

      const res = await api.uploadBulkTrack(formData);
      setTracks((prev) =>
        prev.map((t) =>
          t.id === item.id
            ? { ...t, status: 'completed', uploadProgress: 100, importedSong: res.song }
            : t
        )
      );
      showToast(`Successfully imported "${item.title}"`, 'success');
      refreshPlaylists();
    } catch (err: any) {
      setTracks((prev) =>
        prev.map((t) =>
          t.id === item.id
            ? { ...t, status: 'failed', uploadProgress: 0, errorMessage: err.message || 'Retry failed' }
            : t
        )
      );
      showToast(`Retry failed for "${item.title}"`, 'error');
    }
  };

  // Filtered tracks for display
  const filteredTracks = tracks.filter((t) => {
    const q = searchFilter.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q) ||
      t.file.name.toLowerCase().includes(q) ||
      t.fileHash.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (statusFilter === 'ready') return !t.isDuplicate && t.status !== 'completed';
    if (statusFilter === 'duplicates') return t.isDuplicate || t.status === 'duplicate_skipped';
    if (statusFilter === 'completed') return t.status === 'completed';
    return true;
  });

  const selectedCount = tracks.filter((t) => t.selected && t.status !== 'completed').length;
  const duplicateCount = tracks.filter((t) => t.isDuplicate || t.status === 'duplicate_skipped').length;
  const completedCount = tracks.filter((t) => t.status === 'completed').length;
  const totalSelectedBytes = tracks
    .filter((t) => t.selected && t.status !== 'completed')
    .reduce((acc, t) => acc + t.fileSize, 0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6 w-full">
      {/* Storage Architecture & Credentials Disclosure Banner (Requirement 4) */}
      <div className="bg-[#12121a] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Storage Architecture Verification</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Pre-Flight Audit
                </span>
              </div>
              <p className="text-xs text-zinc-400 max-w-2xl">
                Checking connection to real Cloudinary, Cloudflare R2, and Supabase cloud infrastructure. Storage credentials are kept strictly private on the backend.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              storageStatus?.cloudinaryConfigured
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-zinc-800/80 border-white/10 text-zinc-400'
            }`}>
              <Cloud className="w-3.5 h-3.5" />
              <span>Cloudinary:</span>
              <span className="font-bold">{storageStatus?.cloudinaryConfigured ? 'Connected' : 'Not Set'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              storageStatus?.r2Configured
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-zinc-800/80 border-white/10 text-zinc-400'
            }`}>
              <HardDrive className="w-3.5 h-3.5" />
              <span>Cloudflare R2:</span>
              <span className="font-bold">{storageStatus?.r2Configured ? 'Configured' : 'Not Set'}</span>
            </div>

            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
              storageStatus?.supabaseConfigured
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-zinc-800/80 border-white/10 text-zinc-400'
            }`}>
              <Disc3 className="w-3.5 h-3.5" />
              <span>Supabase DB:</span>
              <span className="font-bold">{storageStatus?.supabaseConfigured ? 'Connected' : 'Not Set'}</span>
            </div>
          </div>
        </div>

        {/* Missing Credentials Notice */}
        {storageStatus && (!storageStatus.r2Configured && !storageStatus.cloudinaryConfigured || !storageStatus.supabaseConfigured) && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs">
            <div className="text-amber-300 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Cloud credentials unconfigured in server/.env:</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-zinc-400 bg-black/40 p-3 rounded-xl border border-white/5">
              <div>
                <span className="text-zinc-200 font-bold block mb-1">Missing Supabase:</span>
                <span className="font-mono text-rose-400 block">
                  {storageStatus.missingCredentials.supabase?.length > 0
                    ? storageStatus.missingCredentials.supabase.join(', ')
                    : 'All configured'}
                </span>
              </div>
              <div>
                <span className="text-zinc-200 font-bold block mb-1">Missing Cloudinary:</span>
                <span className="font-mono text-rose-400 block">
                  {storageStatus.missingCredentials.cloudinary?.length > 0
                    ? storageStatus.missingCredentials.cloudinary.join(', ')
                    : 'All configured'}
                </span>
              </div>
              <div>
                <span className="text-zinc-200 font-bold block mb-1">Missing Cloudflare R2:</span>
                <span className="font-mono text-rose-400 block">
                  {storageStatus.missingCredentials.r2?.length > 0
                    ? storageStatus.missingCredentials.r2.join(', ')
                    : 'All configured'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 italic">
              <strong>Active Storage Engine:</strong> <span className="text-amber-300 font-semibold">{storageStatus.storageMode}</span>. Audio files are preserved byte-for-byte with exact SHA-256 verification and HTTP range seeking support.
            </p>
          </div>
        )}
      </div>

      {/* Bulk Import Main Card */}
      <div className="bg-[#121218] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top Header & Folder Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <FolderOpen className="w-6 h-6 text-brand-neon" />
              <span>Bulk Music Ingestion Studio</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Target Collection: <span className="text-brand-neon font-bold">AISHU</span> • Recursive audio discovery, ID3 tag extraction, artwork parsing, and SHA-256 deduplication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore
              webkitdirectory=""
              // @ts-ignore
              directory=""
              multiple
              onChange={handleFolderSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.webm"
              onChange={handleFolderSelect}
              className="hidden"
            />
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={scanning || isImporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-500 hover:bg-brand-neon text-black font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{folderName ? 'Choose Another Folder' : 'Select Local Music Folder (D:\\MyMusic)'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning || isImporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-bold text-xs border border-white/10 transition-colors disabled:opacity-50"
            >
              <Music2 className="w-4 h-4" />
              <span>Or Select Files Directly</span>
            </button>
          </div>
        </div>

        {/* Scanning State Progress */}
        {scanning && (
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-3 animate-fade-in text-center">
            <RefreshCw className="w-8 h-8 text-brand-neon animate-spin mx-auto" />
            <h4 className="font-bold text-sm text-white">Analyzing folder & computing SHA-256 hashes...</h4>
            <p className="text-xs text-zinc-400">
              Examining file {scanProgress.current} of {scanProgress.total} • Extracting ID3 metadata, embedded artwork, and verifying duplicate checksums
            </p>
            <div className="h-2 w-full max-w-md mx-auto bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-neon transition-all duration-200"
                style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Discovered Tracks Section */}
        {tracks.length > 0 && !scanning && (
          <div className="space-y-4">
            {/* Quick Metrics & Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161622] p-4 rounded-2xl border border-white/5">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Music2 className="w-4 h-4 text-brand-neon" />
                  <span>Discovered: <strong className="text-white">{tracks.length}</strong></span>
                </span>
                <span className="w-px h-3 bg-white/10" />
                <span>Selected: <strong className="text-brand-neon">{selectedCount}</strong> ({formatBytes(totalSelectedBytes)})</span>
                <span className="w-px h-3 bg-white/10" />
                <span className="text-amber-400">Duplicates: <strong>{duplicateCount}</strong></span>
                {completedCount > 0 && (
                  <>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="text-emerald-400">Imported: <strong>{completedCount}</strong></span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSelectFirstFive}
                  disabled={isImporting}
                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold rounded-xl transition-all"
                  title="Select first 5 songs to test verification before full import"
                >
                  ✨ Select First 5 Songs (Verification Test)
                </button>
                <button
                  onClick={() => handleSelectAll(true)}
                  disabled={isImporting}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold rounded-xl border border-white/10 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  disabled={isImporting}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold rounded-xl border border-white/10 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                {[
                  { id: 'all', label: `All (${tracks.length})` },
                  { id: 'ready', label: `Ready (${tracks.length - duplicateCount})` },
                  { id: 'duplicates', label: `Duplicates (${duplicateCount})` },
                  { id: 'completed', label: `Imported (${completedCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                      statusFilter === tab.id
                        ? 'bg-brand-500 text-black'
                        : 'bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter by title, artist, hash..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-[#181822] border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Table of Discovered Tracks */}
            <div className="bg-[#101016] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161622] text-zinc-400 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-white/5">
                    <tr>
                      <th className="p-3 pl-4 w-10">Select</th>
                      <th className="p-3">Track & Title</th>
                      <th className="p-3">Artist</th>
                      <th className="p-3">Album</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">SHA-256 Hash</th>
                      <th className="p-3 text-right pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    {filteredTracks.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/5 transition-colors ${
                          item.isDuplicate ? 'opacity-60 bg-amber-500/[0.02]' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 pl-4">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={item.isDuplicate || isImporting || item.status === 'completed'}
                            onChange={() => toggleTrackSelection(item.id)}
                            className="w-4 h-4 rounded text-brand-500 focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </td>

                        {/* Artwork & Title */}
                        <td className="p-3 flex items-center gap-3 min-w-[200px]">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 shrink-0 border border-white/10 relative">
                            {item.artworkUrl ? (
                              <img
                                src={item.artworkUrl}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                <Music2 className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <input
                              type="text"
                              value={item.title}
                              disabled={isImporting || item.status === 'completed'}
                              onChange={(e) => handleUpdateTrackField(item.id, 'title', e.target.value)}
                              className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-500 font-semibold text-white text-xs truncate focus:outline-none"
                            />
                            <span className="text-[10px] text-zinc-500 block truncate font-mono">
                              {item.file.name}
                            </span>
                          </div>
                        </td>

                        {/* Artist */}
                        <td className="p-3 min-w-[130px]">
                          <input
                            type="text"
                            value={item.artist}
                            disabled={isImporting || item.status === 'completed'}
                            onChange={(e) => handleUpdateTrackField(item.id, 'artist', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-500 text-xs text-zinc-300 truncate focus:outline-none"
                          />
                        </td>

                        {/* Album */}
                        <td className="p-3 min-w-[130px]">
                          <input
                            type="text"
                            value={item.album}
                            disabled={isImporting || item.status === 'completed'}
                            onChange={(e) => handleUpdateTrackField(item.id, 'album', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-500 text-xs text-zinc-400 truncate focus:outline-none"
                          />
                        </td>

                        {/* Duration */}
                        <td className="p-3 font-mono whitespace-nowrap text-zinc-400">
                          {formatDuration(item.duration)}
                        </td>

                        {/* File Size */}
                        <td className="p-3 font-mono whitespace-nowrap text-zinc-400">
                          {formatBytes(item.fileSize)}
                        </td>

                        {/* SHA-256 Hash */}
                        <td className="p-3 min-w-[140px]">
                          <button
                            onClick={() => handleCopyHash(item.fileHash)}
                            className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 hover:text-brand-neon transition-colors group"
                            title="Click to copy full SHA-256 hash"
                          >
                            <span>{item.fileHash.substring(0, 10)}...</span>
                            {copiedHash === item.fileHash ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </button>
                        </td>

                        {/* Status */}
                        <td className="p-3 text-right pr-4 whitespace-nowrap">
                          {item.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Imported
                            </span>
                          )}
                          {item.status === 'duplicate_skipped' && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 cursor-help"
                              title={item.duplicateReason || 'Duplicate SHA-256 hash'}
                            >
                              <AlertTriangle className="w-3 h-3" /> Duplicate Skipped
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-neon border border-brand-500/20">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Uploading {item.uploadProgress}%
                            </span>
                          )}
                          {item.status === 'failed' && (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">
                                Failed
                              </span>
                              <button
                                onClick={() => handleRetryTrack(item)}
                                className="p-1 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-white"
                                title="Retry upload"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {item.status === 'idle' && (
                            <span className="text-[11px] text-zinc-500">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overall Upload Progress Bar */}
            {isImporting && (
              <div className="p-4 bg-[#14141d] rounded-2xl border border-white/10 space-y-2 animate-fade-in">
                <div className="flex justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-brand-neon animate-spin" />
                    <span>Importing Track {currentImportingIndex} of {selectedCount} to AISHU...</span>
                  </span>
                  <span className="font-mono text-brand-neon">{overallProgress}%</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-neon transition-all duration-300"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Pre-Upload Confirmation Trigger Bar (Section 6 requirement: Do not automatically upload anything without showing me the selected files and asking for confirmation) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-[#181824] to-[#12121a] rounded-2xl border border-brand-500/30">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="font-extrabold text-sm text-white flex items-center gap-2 justify-center sm:justify-start">
                  <Sparkles className="w-4 h-4 text-brand-neon" />
                  <span>Ready to Import to Collection: <strong className="text-brand-neon">AISHU</strong></span>
                </div>
                <p className="text-xs text-zinc-400">
                  {selectedCount} track{selectedCount === 1 ? '' : 's'} selected ({formatBytes(totalSelectedBytes)}) • {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} will be safely skipped.
                </p>
              </div>

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={isImporting || selectedCount === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-brand-500 hover:bg-brand-neon text-black font-black text-xs shadow-xl shadow-brand-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                {isImporting ? 'Ingesting Tracks...' : `Review & Confirm Import (${selectedCount} Songs)`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal (User Prompt Requirement: "Do not automatically upload anything without showing me the selected files and asking for confirmation") */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#14141e] border border-white/10 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-brand-500/20 text-brand-neon flex items-center justify-center">
                <ListMusic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">Confirm Music Import</h3>
                <p className="text-xs text-zinc-400">Verify details before proceeding with ingestion</p>
              </div>
            </div>

            <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-zinc-300">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Target Collection:</span>
                <span className="font-bold text-brand-neon">AISHU</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Tracks to Upload:</span>
                <span className="font-bold text-white">{selectedCount} Songs</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Total File Size:</span>
                <span className="font-bold font-mono text-white">{formatBytes(totalSelectedBytes)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Duplicates Detected & Skipped:</span>
                <span className="font-bold text-amber-400">{duplicateCount} Songs</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Target Storage Engine:</span>
                <span className="font-bold text-amber-300">{storageStatus?.storageMode || 'Local High-Fidelity'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Audio Conversion Policy:</span>
                <span className="font-bold text-emerald-400">Zero compression (Original byte-for-byte)</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 italic">
              All tracks will be processed with SHA-256 verification and automatically added to the <strong>AISHU</strong> collection playlist with playback and queue support.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeImport}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-neon text-black font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-all"
              >
                Start Ingestion Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Summary Card (Requirement 5) */}
      {summary && (
        <div className="bg-gradient-to-b from-[#161624] to-[#0f0f18] border border-brand-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-brand-neon text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ingestion Completed Successfully</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Collection "{summary.collectionName}" Summary
              </h3>
            </div>

            <div className="flex items-center gap-2.5">
              {summary.collection && (
                <button
                  onClick={() => onNavigate('playlist-detail', { id: summary.collection?.id })}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-neon text-black font-extrabold text-xs rounded-xl shadow-md transition-all hover:scale-105"
                >
                  <ListMusic className="w-4 h-4" />
                  <span>Open AISHU Collection</span>
                </button>
              )}
            </div>
          </div>

          {/* Metric KPI Tiles (Requirement 5: Total files discovered, Successfully uploaded songs, Duplicate songs skipped, Failed uploads, Total storage consumed, Collection name) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Discovered</span>
              <span className="text-xl font-black text-white">{summary.totalDiscovered}</span>
            </div>
            <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <span className="text-[11px] text-emerald-400 block mb-0.5">Uploaded</span>
              <span className="text-xl font-black text-emerald-300">{summary.successful}</span>
            </div>
            <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <span className="text-[11px] text-amber-400 block mb-0.5">Duplicates Skipped</span>
              <span className="text-xl font-black text-amber-300">{summary.duplicatesSkipped}</span>
            </div>
            <div className="p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20">
              <span className="text-[11px] text-rose-400 block mb-0.5">Failed Uploads</span>
              <span className="text-xl font-black text-rose-300">{summary.failed}</span>
            </div>
            <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-[11px] text-zinc-400 block mb-0.5">Storage Consumed</span>
              <span className="text-xl font-black text-white font-mono">{formatBytes(summary.totalBytes)}</span>
            </div>
            <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/20">
              <span className="text-[11px] text-purple-400 block mb-0.5">Collection Name</span>
              <span className="text-xl font-black text-purple-300">{summary.collectionName}</span>
            </div>
          </div>

          {/* Action Bar for Verification */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
            <p className="text-xs text-zinc-400">
              All tracks in <strong>AISHU</strong> are ready for verification: playback, seeking, next/previous controls, and SHA-256 hash preservation.
            </p>

            <div className="flex items-center gap-3">
              {summary.collection?.songs && summary.collection.songs.length > 0 && (
                <button
                  onClick={() => playSong(summary.collection!.songs![0], summary.collection!.songs)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-neon text-black font-extrabold text-xs rounded-xl shadow-lg transition-transform hover:scale-105"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play AISHU Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

