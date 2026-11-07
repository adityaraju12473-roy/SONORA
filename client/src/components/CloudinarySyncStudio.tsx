import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Music2,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Radio,
  Clock,
  HardDrive,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Song, Playlist, NavView } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';

interface CloudinaryAssetItem {
  asset_id: string;
  public_id: string;
  filename: string;
  title: string;
  artist_name: string;
  album_name: string;
  duration: number;
  format: string;
  bytes: number;
  secure_url: string;
  created_at: string;
  isAlreadyImported: boolean;
  existingSongId?: string;
  status?: 'ready' | 'importing' | 'completed' | 'skipped' | 'failed';
  errorMessage?: string;
}

interface StorageStatus {
  supabaseConfigured: boolean;
  r2Configured: boolean;
  cloudinaryConfigured: boolean;
  missingCredentials: { supabase: string[]; r2: string[]; cloudinary: string[] };
  storageMode: string;
}

interface CloudinarySyncStudioProps {
  onNavigate: (view: NavView, payload?: any) => void;
  onImportComplete?: () => void;
}

export const CloudinarySyncStudio: React.FC<CloudinarySyncStudioProps> = ({
  onNavigate,
  onImportComplete,
}) => {
  const { showToast } = useToast();
  const { playSong } = useAudioPlayer();
  const { refreshPlaylists } = usePlaylistModal();

  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Cloudinary Query State
  const [folderPrefix, setFolderPrefix] = useState('');
  const [collectionName, setCollectionName] = useState('AISHU');
  const [assets, setAssets] = useState<CloudinaryAssetItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<{
    totalProcessed: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    collectionName: string;
    collection?: Playlist;
  } | null>(null);

  // Filter & Search in fetched assets
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'imported' | 'skipped'>('all');

  // Load storage credentials status
  const checkStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await api.getStorageStatus();
      setStorageStatus(res);
    } catch (e) {
      console.error('Failed to load storage status', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // Fetch audio assets from Cloudinary using Admin API
  const handleFetchAssets = async (cursor?: string) => {
    try {
      setIsLoadingAssets(true);
      const res = await api.getCloudinaryAudioAssets({
        prefix: folderPrefix.trim() || undefined,
        max_results: 100,
        next_cursor: cursor,
      });

      if (!res.success) {
        showToast(res.error || 'Failed to fetch Cloudinary assets', 'error');
        return;
      }

      const formatted: CloudinaryAssetItem[] = res.assets.map((a) => ({
        ...a,
        status: a.isAlreadyImported ? 'skipped' : 'ready',
      }));

      if (cursor) {
        setAssets((prev) => [...prev, ...formatted]);
      } else {
        setAssets(formatted);
      }

      setNextCursor(res.next_cursor);
      showToast(`Retrieved ${res.count} audio assets from Cloudinary!`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error connecting to Cloudinary Admin API', 'error');
    } finally {
      setIsLoadingAssets(false);
    }
  };

  // Import Tracks (supports limit for small batch test or full import)
  const handleExecuteImport = async (limit?: number) => {
    if (assets.length === 0) {
      showToast('Please fetch assets from Cloudinary first', 'info');
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(10);

      const targetAssets = limit && limit > 0 ? assets.slice(0, limit) : assets;
      const res = await api.importCloudinaryAudioAssets({
        assets: targetAssets,
        collectionName: collectionName.trim() || 'AISHU',
      });

      setImportProgress(100);

      if (!res.success) {
        showToast(res.error || 'Import failed', 'error');
        return;
      }

      setImportSummary(res.summary);

      // Update asset statuses locally
      const importedIds = new Set(res.importedSongs.map((s) => s.cloudinary_asset_id || s.cloudinary_public_id));
      const skippedIds = new Set(res.skippedTracks.map((s) => s.asset_id));
      const failedMap = new Map(res.failedTracks.map((f) => [f.asset_id, f.error]));

      setAssets((prev) =>
        prev.map((a) => {
          if (importedIds.has(a.asset_id) || importedIds.has(a.public_id)) {
            return { ...a, status: 'completed', isAlreadyImported: true };
          }
          if (skippedIds.has(a.asset_id)) {
            return { ...a, status: 'skipped', isAlreadyImported: true };
          }
          if (failedMap.has(a.asset_id)) {
            return { ...a, status: 'failed', errorMessage: failedMap.get(a.asset_id) };
          }
          return a;
        })
      );

      refreshPlaylists();
      showToast(
        `Import completed: ${res.summary.importedCount} songs added to ${res.summary.collectionName} (${res.summary.skippedCount} skipped)!`,
        'success'
      );

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Import operation failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Play preview directly from Cloudinary HTTPS stream
  const handlePreviewSong = (asset: CloudinaryAssetItem) => {
    const previewSong: Song = {
      id: asset.existingSongId || `cloud-preview-${asset.asset_id}`,
      title: asset.title,
      artist_name: asset.artist_name,
      album_name: asset.album_name || 'Cloudinary Stream',
      genre: 'Cloud Audio',
      duration: asset.duration,
      cover_url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=600&q=80',
      audio_url: asset.secure_url,
      cloudinary_public_id: asset.public_id,
      cloudinary_asset_id: asset.asset_id,
      plays_count: 0,
      is_featured: false,
      is_trending: false,
      created_at: asset.created_at || new Date().toISOString(),
    };
    playSong(previewSong);
    showToast(`Streaming "${asset.title}" directly from Cloudinary CDN`, 'info');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredAssets = assets.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.artist_name.toLowerCase().includes(q) ||
      a.public_id.toLowerCase().includes(q) ||
      a.asset_id.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (statusFilter === 'ready') return a.status === 'ready';
    if (statusFilter === 'imported') return a.status === 'completed';
    if (statusFilter === 'skipped') return a.status === 'skipped' || a.isAlreadyImported;
    return true;
  });

  const readyCount = assets.filter((a) => a.status === 'ready' && !a.isAlreadyImported).length;
  const importedCount = assets.filter((a) => a.status === 'completed' || a.isAlreadyImported).length;

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* 1. Storage & Architecture Status Banner */}
      <div className="bg-[#12121c] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Cloudinary & Supabase Asset Synchronization</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Direct CDN Bridge
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Fetch your uploaded audio assets from Cloudinary via the server-side Admin API (<code className="text-purple-300">resource_type: 'video'</code>) and synchronize them with Supabase with exact asset ID deduplication and zero transcoding.
              </p>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
            <div
              className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
                storageStatus?.cloudinaryConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Cloudinary Admin API:</span>
              <span className="font-bold">{storageStatus?.cloudinaryConfigured ? 'Connected' : 'Missing Keys'}</span>
            </div>

            <div
              className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
                storageStatus?.supabaseConfigured
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Supabase DB:</span>
              <span className="font-bold">{storageStatus?.supabaseConfigured ? 'Connected' : 'Local Fallback'}</span>
            </div>
          </div>
        </div>

        {/* Missing Credentials Alert & Guidance */}
        {storageStatus && (!storageStatus.cloudinaryConfigured || !storageStatus.supabaseConfigured) && (
          <div className="mt-5 pt-4 border-t border-white/5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Configuration Required in server/.env:</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-300 bg-black/50 p-4 rounded-2xl border border-white/5 font-mono">
              <div>
                <span className="text-purple-300 font-bold block mb-1 font-sans">1. Cloudinary Credentials:</span>
                {storageStatus.missingCredentials.cloudinary?.length > 0 ? (
                  <ul className="list-disc list-inside text-rose-400 space-y-0.5">
                    {storageStatus.missingCredentials.cloudinary.map((k) => (
                      <li key={k}>{k}=your_{k.toLowerCase()}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-emerald-400">All configured ✓</span>
                )}
              </div>

              <div>
                <span className="text-purple-300 font-bold block mb-1 font-sans">2. Supabase Credentials:</span>
                {storageStatus.missingCredentials.supabase?.length > 0 ? (
                  <ul className="list-disc list-inside text-rose-400 space-y-0.5">
                    {storageStatus.missingCredentials.supabase.map((k) => (
                      <li key={k}>{k}=your_{k.toLowerCase()}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-emerald-400">All configured ✓</span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-zinc-400">
              Paste your Cloudinary and Supabase keys into <code className="text-purple-300 bg-white/5 px-1.5 py-0.5 rounded">server/.env</code>. The backend keeps all credentials strictly secret and never passes them to the frontend.
            </p>
          </div>
        )}
      </div>

      {/* 2. Controls & Retrieval Panel */}
      <div className="bg-[#12121a] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/5">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-purple-400" />
              <span>Cloudinary Audio Asset Bridge</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Query uploaded audio files, review metadata and asset IDs, test a small batch, and import seamlessly into collection <strong className="text-purple-300">{collectionName}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-zinc-400">Folder Prefix:</span>
              <input
                type="text"
                value={folderPrefix}
                onChange={(e) => setFolderPrefix(e.target.value)}
                placeholder="e.g. sonora/audio (or blank)"
                className="bg-transparent border-none text-white text-xs font-mono focus:outline-none w-36"
              />
            </div>

            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-zinc-400">Target Collection:</span>
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="AISHU"
                className="bg-transparent border-none text-brand-neon font-bold text-xs focus:outline-none w-24"
              />
            </div>

            <button
              onClick={() => handleFetchAssets()}
              disabled={isLoadingAssets}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAssets ? 'animate-spin' : ''}`} />
              <span>{isLoadingAssets ? 'Fetching Cloudinary...' : 'Fetch Audio Assets'}</span>
            </button>
          </div>
        </div>

        {/* 3. Batch Action Bar (Small Batch Test & Full Import) */}
        {assets.length > 0 && (
          <div className="p-5 bg-gradient-to-r from-[#171426] to-[#12121d] rounded-2xl border border-purple-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-extrabold text-white">
                  {assets.length} Audio Assets Retrieved from Cloudinary
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {readyCount} Ready to Import
                </span>
                {importedCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-bold">
                    {importedCount} Already Imported
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Audio will stream directly from Cloudinary CDN (<code className="text-purple-300">secure_url</code>) with zero conversion, byte-for-byte fidelity, and HTTP range support.
              </p>
            </div>

            {/* Action Buttons: Small Batch Test vs Full Batch */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Task 14: Test with a small batch before importing the complete library */}
              <button
                onClick={() => handleExecuteImport(5)}
                disabled={isImporting || readyCount === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                title="Test with 5 tracks first to verify playback and database integration"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Test Small Batch (5 Tracks)</span>
              </button>

              <button
                onClick={() => handleExecuteImport()}
                disabled={isImporting || readyCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-neon text-black font-black text-xs shadow-lg shadow-brand-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <Cloud className="w-4 h-4" />
                <span>{isImporting ? 'Importing...' : `Import All (${readyCount} Tracks)`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Import Summary Banner */}
        {importSummary && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-300 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                <strong>Import Succeeded!</strong> {importSummary.importedCount} tracks added to collection{' '}
                <strong className="text-white">{importSummary.collectionName}</strong>,{' '}
                {importSummary.skippedCount} duplicates skipped.
              </span>
            </div>
            <button
              onClick={() => onNavigate('library')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shrink-0 transition-colors"
            >
              <span>View in Your Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4. Filter & Search Controls */}
        {assets.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search tracks, artists, asset IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161622] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#161622] p-1 rounded-xl border border-white/5 text-xs">
              {(['all', 'ready', 'imported', 'skipped'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                    statusFilter === filter
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. Cloudinary Tracks Table */}
        {assets.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0d0d14]">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#141420] text-zinc-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3.5 pl-4 w-12 text-center">Play</th>
                  <th className="p-3.5">Title & Artist</th>
                  <th className="p-3.5">Cloudinary Asset ID</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">File Size</th>
                  <th className="p-3.5 text-right pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAssets.map((asset) => (
                  <tr key={asset.asset_id} className="hover:bg-white/[0.02] transition-colors group">
                    {/* Play Button */}
                    <td className="p-3 pl-4 text-center">
                      <button
                        onClick={() => handlePreviewSong(asset)}
                        className="w-8 h-8 rounded-full bg-purple-600/30 hover:bg-purple-500 text-purple-300 hover:text-white flex items-center justify-center transition-all hover:scale-110 mx-auto"
                        title="Stream direct preview from Cloudinary"
                      >
                        <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                      </button>
                    </td>

                    {/* Title & Artist */}
                    <td className="p-3 max-w-xs truncate">
                      <div className="font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                        {asset.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {asset.artist_name} • <span className="text-zinc-500">{asset.format.toUpperCase()}</span>
                      </div>
                    </td>

                    {/* Asset ID & Public ID */}
                    <td className="p-3 max-w-xs">
                      <button
                        onClick={() => copyToClipboard(asset.asset_id, asset.asset_id)}
                        className="flex items-center gap-1 font-mono text-[11px] text-zinc-400 hover:text-white transition-colors"
                        title="Click to copy Asset ID"
                      >
                        <span>{asset.asset_id.substring(0, 14)}...</span>
                        {copiedId === asset.asset_id ? (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />
                        )}
                      </button>
                      <div className="text-[10px] text-zinc-500 truncate" title={asset.public_id}>
                        {asset.public_id}
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="p-3 font-mono text-zinc-400 whitespace-nowrap">
                      {formatDuration(asset.duration)}
                    </td>

                    {/* Size */}
                    <td className="p-3 font-mono text-zinc-400 whitespace-nowrap">
                      {formatBytes(asset.bytes)}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-right pr-4 whitespace-nowrap">
                      {asset.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Imported
                        </span>
                      )}
                      {(asset.status === 'skipped' || asset.isAlreadyImported) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20">
                          <Check className="w-3 h-3" /> Already In Library
                        </span>
                      )}
                      {asset.status === 'ready' && !asset.isAlreadyImported && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-white/10">
                          Ready
                        </span>
                      )}
                      {asset.status === 'failed' && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20"
                          title={asset.errorMessage}
                        >
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-white/10 bg-[#0d0d14] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
              <Cloud className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-white">No Cloudinary Assets Loaded Yet</h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Click <strong>"Fetch Audio Assets"</strong> above to retrieve all uploaded audio tracks directly from your Cloudinary account.
              </p>
            </div>
          </div>
        )}

        {/* Pagination Trigger */}
        {nextCursor && (
          <div className="text-center pt-2">
            <button
              onClick={() => handleFetchAssets(nextCursor)}
              disabled={isLoadingAssets}
              className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 font-bold text-xs border border-white/10 transition-colors"
            >
              {isLoadingAssets ? 'Loading More...' : 'Load Next Page of Assets'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
