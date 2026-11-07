import React, { useState, useEffect } from 'react';
import {
  Link2,
  X,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  ArrowLeft,
  ArrowRight,
  Music2,
  RefreshCw,
  ExternalLink,
  Layers,
  Key,
} from 'lucide-react';
import { Song, Playlist, NavView } from '../types';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface PlaylistImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: NavView, payload?: any) => void;
  onPlaylistCreated?: () => void;
}

type ImportStep = 'input' | 'preview' | 'success';
type FilterTab = 'all' | 'matched' | 'unmatched';

interface ImportTrackItem {
  position: number;
  originalTitle: string;
  originalArtist: string;
  originalAlbum?: string;
  duration?: number;
  isMatched: boolean;
  matchConfidence: number;
  matchConfidenceLevel: 'HIGH' | 'MEDIUM' | 'UNMATCHED';
  matchReason?: string;
  matchedSong?: Song;
}

interface ImportPreviewData {
  source: 'spotify' | 'youtube';
  playlistId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  totalTracks: number;
  matchedCount: number;
  unmatchedCount: number;
  tracks: ImportTrackItem[];
}

export const PlaylistImportModal: React.FC<PlaylistImportModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onPlaylistCreated,
}) => {
  const { showToast } = useToast();
  const { currentSong, isPlaying, playSong, togglePlayPause } = useAudioPlayer();

  // Wizard state
  const [step, setStep] = useState<ImportStep>('input');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing playlist...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Advanced credentials accordion
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifyClientSecret, setSpotifyClientSecret] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');

  // Preview & selection state
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [isImporting, setIsImporting] = useState(false);

  // Success state
  const [createdPlaylist, setCreatedPlaylist] = useState<Playlist | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setUrl('');
      setErrorMessage(null);
      setPreviewData(null);
      setCreatedPlaylist(null);
      setSelectedSongIds([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle URL fetch & matching
  const handleFetchPlaylist = async (targetUrl?: string) => {
    const finalUrl = (targetUrl || url).trim();
    if (!finalUrl) {
      setErrorMessage('Please enter a valid Spotify or YouTube Music playlist link.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setLoadingMessage('Connecting to platform & extracting playlist metadata...');

    try {
      const data = await api.importPlaylistFetch({
        url: finalUrl,
        spotifyClientId: spotifyClientId.trim() || undefined,
        spotifyClientSecret: spotifyClientSecret.trim() || undefined,
        youtubeApiKey: youtubeApiKey.trim() || undefined,
      });

      setPreviewData(data);
      setCustomTitle(data.title);

      // By default, pre-select all matched tracks in original playlist order
      const initialSelected = data.tracks
        .filter((t) => t.isMatched && t.matchedSong)
        .map((t) => t.matchedSong!.id);

      setSelectedSongIds(initialSelected);
      setStep('preview');
    } catch (err: any) {
      console.error('Fetch error:', err);
      setErrorMessage(
        err.message || 'Failed to extract playlist. Please check the URL and ensure the playlist is public.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Toggle individual song selection
  const handleToggleSong = (songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId]
    );
  };

  // Select all matched tracks
  const handleSelectAllMatched = () => {
    if (!previewData) return;
    const allMatchedIds = previewData.tracks
      .filter((t) => t.isMatched && t.matchedSong)
      .map((t) => t.matchedSong!.id);
    setSelectedSongIds(allMatchedIds);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedSongIds([]);
  };

  // Handle Create Playlist in Supabase/SONORA
  const handleConfirmImport = async () => {
    if (!previewData || selectedSongIds.length === 0) {
      showToast('Please select at least one matched track to import', 'error');
      return;
    }

    setIsImporting(true);
    try {
      // Preserve original playlist order of the selected tracks
      const orderedSongIds = previewData.tracks
        .filter((t) => t.isMatched && t.matchedSong && selectedSongIds.includes(t.matchedSong.id))
        .map((t) => t.matchedSong!.id);

      const res = await api.importPlaylistCreate({
        title: customTitle.trim() || previewData.title,
        description: `Imported from ${
          previewData.source === 'spotify' ? 'Spotify' : 'YouTube Music'
        } (${orderedSongIds.length} tracks matched against SONORA catalogue)`,
        coverUrl: previewData.coverUrl,
        songIds: orderedSongIds,
        isPublic: true,
      });

      setCreatedPlaylist(res.playlist);
      setStep('success');
      showToast(res.message, 'success');
      if (onPlaylistCreated) {
        onPlaylistCreated();
      }
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(err.message || 'Failed to create imported playlist', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Audio Preview Handler
  const handlePreviewSong = (song: Song) => {
    if (currentSong?.id === song.id) {
      togglePlayPause();
    } else {
      playSong(song);
    }
  };

  // Quick Paste from Clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setErrorMessage(null);
      }
    } catch {
      showToast('Clipboard access was blocked by browser. Paste directly into the field.', 'info');
    }
  };

  // Filtered tracks for the preview table
  const displayedTracks = (previewData?.tracks || []).filter((t) => {
    if (filterTab === 'matched') return t.isMatched;
    if (filterTab === 'unmatched') return !t.isMatched;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#121214] border border-white/10 rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden select-none">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white">
              <Link2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white leading-tight">
                Import Playlist by Link
              </h3>
              <p className="text-xs text-[#8e8e93]">
                Spotify & YouTube Music • Match against SONORA's 910-song catalogue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* ========================================================= */}
          {/* STEP 1: INPUT URL */}
          {/* ========================================================= */}
          {step === 'input' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Playlist URL
                </label>
                <div className="relative flex items-center">
                  <input
                    type="url"
                    placeholder="https://open.spotify.com/playlist/... or https://music.youtube.com/playlist?list=..."
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setErrorMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFetchPlaylist();
                    }}
                    className="w-full bg-[#18181b] border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors pr-24"
                  />
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="absolute right-2 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    Paste
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Spotify Playlists
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> YouTube Music Playlists
                  </span>
                </div>
              </div>

              {/* Sample Links for Quick 1-Click Testing */}
              <div className="bg-[#18181b]/70 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Try a Sample Playlist</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sampleUrl = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
                      setUrl(sampleUrl);
                      handleFetchPlaylist(sampleUrl);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-white truncate">Today's Top Hits</div>
                      <div className="text-[10px] text-zinc-400 truncate">Spotify Official • 50 Tracks</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sampleUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd';
                      setUrl(sampleUrl);
                      handleFetchPlaylist(sampleUrl);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-white truncate">RapCaviar</div>
                      <div className="text-[10px] text-zinc-400 truncate">Spotify Official • Hip-Hop & Rap</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Optional Credentials Accordion */}
              <div className="border border-white/5 rounded-xl overflow-hidden bg-[#18181b]/40">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between p-3 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5" />
                    <span>Optional Custom API Credentials</span>
                  </div>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvanced && (
                  <div className="p-4 pt-1 border-t border-white/5 space-y-3 text-xs">
                    <p className="text-[11px] text-zinc-400">
                      SONORA automatically uses zero-config public metadata parsers. You can optionally supply your own developer keys if you want to import private playlists or bypass rate limits.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">
                          Spotify Client ID
                        </label>
                        <input
                          type="text"
                          value={spotifyClientId}
                          onChange={(e) => setSpotifyClientId(e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">
                          Spotify Client Secret
                        </label>
                        <input
                          type="password"
                          value={spotifyClientSecret}
                          onChange={(e) => setSpotifyClientSecret(e.target.value)}
                          placeholder="Optional"
                          className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase tracking-wider block mb-1">
                        YouTube Data API Key
                      </label>
                      <input
                        type="text"
                        value={youtubeApiKey}
                        onChange={(e) => setYoutubeApiKey(e.target.value)}
                        placeholder="Optional"
                        className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Analyze Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleFetchPlaylist()}
                  disabled={loading || !url.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg active:scale-95"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>{loadingMessage}</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze & Match Playlist</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: PREVIEW & SELECTION */}
          {/* ========================================================= */}
          {step === 'preview' && previewData && (
            <div className="space-y-5">
              {/* Playlist Summary Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-[#18181b] border border-white/10">
                <img
                  src={
                    previewData.coverUrl ||
                    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80'
                  }
                  alt={previewData.title}
                  className="w-20 h-20 rounded-xl object-cover shrink-0 shadow-lg border border-white/10"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        previewData.source === 'spotify'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {previewData.source === 'spotify' ? 'Spotify Playlist' : 'YouTube Music'}
                    </span>
                    <span className="text-xs text-zinc-400">• {previewData.totalTracks} songs discovered</span>
                  </div>

                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Playlist Title"
                    className="w-full font-bold text-base sm:text-lg text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  {previewData.description && (
                    <p className="text-xs text-zinc-400 line-clamp-1">{previewData.description}</p>
                  )}
                </div>
              </div>

              {/* Statistics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#161618] border border-white/5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total Songs</div>
                  <div className="text-lg font-bold text-white mt-0.5">{previewData.totalTracks}</div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-400 uppercase font-semibold">Matched in SONORA</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">{previewData.matchedCount}</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
                  <div className="text-[10px] text-amber-400 uppercase font-semibold">Unmatched</div>
                  <div className="text-lg font-bold text-amber-400 mt-0.5">{previewData.unmatchedCount}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#161618] border border-white/5">
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Library Coverage</div>
                  <div className="text-lg font-bold text-white mt-0.5">
                    {previewData.totalTracks > 0
                      ? `${Math.round((previewData.matchedCount / previewData.totalTracks) * 100)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Selection Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 p-1 bg-[#18181b] border border-white/5 rounded-xl text-xs">
                  <button
                    onClick={() => setFilterTab('all')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === 'all' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    All ({previewData.totalTracks})
                  </button>
                  <button
                    onClick={() => setFilterTab('matched')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === 'matched' ? 'bg-white/10 text-emerald-400' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Matched ({previewData.matchedCount})
                  </button>
                  <button
                    onClick={() => setFilterTab('unmatched')}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === 'unmatched' ? 'bg-white/10 text-amber-400' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Unmatched ({previewData.unmatchedCount})
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={handleSelectAllMatched}
                    className="text-xs text-zinc-300 hover:text-white underline underline-offset-4"
                  >
                    Select All Matched
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Track List Table */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-[#161618]">
                <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.05]">
                  {displayedTracks.map((track) => {
                    const isSelected = track.matchedSong
                      ? selectedSongIds.includes(track.matchedSong.id)
                      : false;
                    const isCurrentPlaying =
                      track.matchedSong && currentSong?.id === track.matchedSong.id;

                    return (
                      <div
                        key={track.position}
                        className={`flex items-center justify-between p-3 gap-3 transition-colors ${
                          track.isMatched ? 'hover:bg-white/[0.04]' : 'opacity-60 bg-black/20'
                        }`}
                      >
                        {/* Checkbox & Position */}
                        <div className="flex items-center gap-3 shrink-0">
                          {track.isMatched && track.matchedSong ? (
                            <button
                              type="button"
                              onClick={() => handleToggleSong(track.matchedSong!.id)}
                              className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 fill-emerald-500/20 stroke-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-zinc-500" />
                              )}
                            </button>
                          ) : (
                            <div className="w-4 h-4 rounded border border-zinc-700/50 bg-zinc-900 cursor-not-allowed" />
                          )}
                          <span className="text-xs text-zinc-500 font-mono w-5 text-right">
                            #{track.position}
                          </span>
                        </div>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-white truncate">
                              {track.originalTitle}
                            </span>
                            {track.originalAlbum && (
                              <span className="hidden md:inline text-[10px] text-zinc-500 truncate">
                                • {track.originalAlbum}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#8e8e93] truncate">
                            {track.originalArtist}
                          </div>
                        </div>

                        {/* Match Status & Preview */}
                        <div className="flex items-center gap-2 shrink-0">
                          {track.isMatched && track.matchedSong ? (
                            <>
                              <div className="text-right hidden sm:block">
                                <div className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 justify-end">
                                  <span>{Math.round(track.matchConfidence * 100)}% match</span>
                                </div>
                                <div className="text-[9px] text-zinc-500 truncate max-w-[140px]">
                                  {track.matchedSong.title}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handlePreviewSong(track.matchedSong!)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
                                  isCurrentPlaying && isPlaying
                                    ? 'bg-emerald-500 text-black'
                                    : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                                title="Preview this track"
                              >
                                {isCurrentPlaying && isPlaying ? (
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/80 text-zinc-400 border border-white/5">
                              Unmatched
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Change Playlist</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || selectedSongIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg active:scale-95"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Creating Playlist...</span>
                    </>
                  ) : (
                    <>
                      <span>Import {selectedSongIds.length} Matched Tracks</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: SUCCESS CONFIRMATION */}
          {/* ========================================================= */}
          {step === 'success' && createdPlaylist && (
            <div className="py-6 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Playlist Successfully Imported!
                </h3>
                <p className="text-xs sm:text-sm text-[#8e8e93] max-w-md mx-auto">
                  "{createdPlaylist.title}" has been saved to your library with {createdPlaylist.songs?.length || createdPlaylist.song_count || 0} matched tracks in original playlist order.
                </p>
              </div>

              {/* Playlist Card Preview */}
              <div className="max-w-xs mx-auto p-3 rounded-2xl bg-[#161618] border border-white/10 flex items-center gap-3 text-left shadow-xl">
                <img
                  src={
                    createdPlaylist.cover_url ||
                    createdPlaylist.songs?.[0]?.cover_url ||
                    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&q=80'
                  }
                  alt={createdPlaylist.title}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{createdPlaylist.title}</div>
                  <div className="text-[10px] text-[#8e8e93]">
                    {createdPlaylist.songs?.length || createdPlaylist.song_count || 0} songs • Ready to stream
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {createdPlaylist.songs && createdPlaylist.songs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      playSong(createdPlaylist.songs![0], createdPlaylist.songs);
                      onClose();
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs font-bold transition-all shadow-lg active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Play Now</span>
                  </button>
                )}

                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('playlist-detail', { id: createdPlaylist.id });
                      onClose();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1e1e22] hover:bg-[#28282e] border border-white/10 text-white text-xs font-semibold transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    <span>View Playlist</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

