import React, { useState, useEffect } from 'react';
import { Clock3, Play, History } from 'lucide-react';
import { ListeningHistoryItem, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { SongRow } from '../components/SongRow';

interface RecentlyPlayedViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

export const RecentlyPlayedView: React.FC<RecentlyPlayedViewProps> = ({ onNavigate }) => {
  const [history, setHistory] = useState<ListeningHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = useAudioPlayer();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await api.getListeningHistory();
        setHistory(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatPlayedAt = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  const validSongs = history.filter((h) => h.song).map((h) => h.song!);

  return (
    <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 md:px-8 space-y-6 pb-44 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#8e8e93] text-xs font-semibold uppercase tracking-wider mb-1">
            <Clock3 className="w-4 h-4 text-[#eab308]" />
            <span>Playback History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Recently Played</h1>
        </div>

        {validSongs.length > 0 && (
          <button
            onClick={() => playSong(validSongs[0], validSongs)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-bold text-xs shadow-md transition-all hover:scale-105"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Replay Recent</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-64 rounded-2xl bg-[#161618] animate-pulse" />
      ) : history.length === 0 ? (
        <div className="p-16 text-center bg-[#161618] rounded-2xl border border-white/10 space-y-3">
          <History className="w-10 h-10 text-zinc-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No listening history yet</h3>
          <p className="text-xs text-[#8e8e93]">Songs you play will automatically appear here</p>
        </div>
      ) : (
        <div className="bg-[#161618] border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
          {history.map((item, i) => {
            if (!item.song) return null;
            return (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <SongRow
                    song={item.song}
                    index={i}
                    contextQueue={validSongs}
                    onNavigate={onNavigate}
                  />
                </div>
                <span className="text-[11px] font-mono text-[#8e8e93] shrink-0 pr-4">
                  {formatPlayedAt(item.played_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
