import React from 'react';
import {
  Home,
  Compass,
  Search,
  Library,
  ListMusic,
  Disc3,
  Mic2,
  Heart,
  Clock3,
  ShieldAlert,
  Radio,
  PlusCircle,
  X,
  Sparkles,
  Play,
  Zap,
} from 'lucide-react';
import { NavView } from '../types';
import { useAuth } from '../context/AuthContext';
import { usePlaylistModal } from '../context/PlaylistModalContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView, payload?: any) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpen = false,
  onClose,
}) => {
  const { user, isAdmin, setAuthModalOpen, logout, loading } = useAuth();
  const { openCreatePlaylist, playlists } = usePlaylistModal();
  const { playSong } = useAudioPlayer();

  const handleNav = (view: NavView, payload?: any) => {
    onNavigate(view, payload);
    if (onClose) onClose();
  };

  const aishuPlaylist = playlists.find(
    (p) => p.title.toLowerCase() === 'aishu'
  );

  const mainNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Discover', icon: Compass },
    { id: 'search', label: 'Search', icon: Search },
  ];

  const libraryItems = [
    { id: 'library', label: 'Your Library', icon: Library },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'albums', label: 'Albums', icon: Disc3 },
    { id: 'artists', label: 'Artists', icon: Mic2 },
    { id: 'favourites', label: 'Favourites', icon: Heart, isFav: true },
    { id: 'history', label: 'Recently Played', icon: Clock3 },
  ];

  const handlePlayAishu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aishuPlaylist && aishuPlaylist.songs && aishuPlaylist.songs.length > 0) {
      playSong(aishuPlaylist.songs[0], aishuPlaylist.songs);
    } else {
      handleNav('playlist-detail', { id: aishuPlaylist?.id || 'pl-aishu' });
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md lg:hidden transition-opacity"
        />
      )}

      {/* Futuristic Glassmorphic Sidebar Container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[240px] shrink-0 bg-[#07070d]/95 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col h-full select-none transition-transform duration-300 ease-in-out shadow-[8px_0_32px_rgba(0,0,0,0.6)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo & Telemetry Badge */}
        <div className="p-4 sm:p-5 pb-4 flex items-center justify-between border-b border-white/[0.05]">
          <div
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0 ring-1 ring-cyan-400/30">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-base tracking-wider text-white flex items-center gap-1.5 font-display">
                SONORA
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
              </span>
              <span className="text-[9px] tracking-widest uppercase font-mono font-bold text-cyan-400/80 block -mt-0.5">
                AUDIO CORE v2.0
              </span>
            </div>
          </div>

          {/* Close button for mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
          {/* 1. Main Navigation */}
          <div>
            <div className="px-3 mb-2 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
              CORE SYSTEM
            </div>
            <div className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id as NavView)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 relative ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent text-white font-bold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(0,240,255,0.08)]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : 'text-zinc-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. AISHU Flagship Archive Shortcut */}
          <div>
            <div className="px-3 mb-2 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
              <span>FLAGSHIP ARCHIVE</span>
              <span className="text-[8px] px-1.5 py-0.2 bg-pink-500/20 text-pink-300 rounded font-mono font-bold border border-pink-500/30">
                MASTER
              </span>
            </div>
            <div
              onClick={() => handleNav('playlist-detail', { id: aishuPlaylist?.id || 'pl-aishu' })}
              className="group relative p-2.5 rounded-xl bg-gradient-to-br from-[#160e26] via-[#120b1f] to-[#0a0712] border border-pink-500/30 hover:border-pink-400/60 cursor-pointer shadow-lg shadow-pink-950/20 transition-all hover:scale-[1.02] flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md ring-1 ring-pink-400/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-black text-white truncate group-hover:text-pink-300 transition-colors font-display">
                    AISHU
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate font-mono">
                    {aishuPlaylist?.songs?.length || 261} TRACKS
                  </div>
                </div>
              </div>

              <button
                onClick={handlePlayAishu}
                className="w-7 h-7 rounded-lg bg-pink-500 hover:bg-pink-400 text-white flex items-center justify-center opacity-85 group-hover:opacity-100 shadow-md shadow-pink-500/30 transition-all hover:scale-110 shrink-0 ml-1"
                title="Play AISHU Now"
              >
                <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* 3. Library Section */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                YOUR LIBRARY
              </span>
              <button
                onClick={() => {
                  openCreatePlaylist();
                  if (onClose) onClose();
                }}
                className="text-zinc-400 hover:text-cyan-400 transition-colors p-0.5"
                title="Create Playlist"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {libraryItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id as NavView)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-cyan-500/10 text-white font-bold border-l-2 border-cyan-400 shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.isFav && isActive
                          ? 'text-rose-500 fill-rose-500'
                          : isActive
                          ? 'text-cyan-400'
                          : item.isFav
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Curator Studio / Admin Control */}
          <div>
            <div className="px-3 mb-2 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500">
              STUDIO & TELEMETRY
            </div>
            <button
              onClick={() => handleNav('admin')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                currentView === 'admin'
                  ? 'bg-purple-600/20 text-purple-300 font-bold border-purple-500/40 shadow-lg shadow-purple-950/20'
                  : 'bg-[#0e0e18]/60 border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">Curator Studio</span>
              </div>
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded uppercase shrink-0">
                {isAdmin ? 'ADMIN' : 'STUDIO'}
              </span>
            </button>
          </div>
        </div>

        {/* 5. User Profile Footer with Glowing Beacon */}
        <div className="p-3 border-t border-white/[0.05] bg-[#050509] shrink-0 space-y-2">
          {user ? (
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-cyan-500/30 shadow-[0_0_8px_rgba(0,240,255,0.2)]">
                  <img
                    src={
                      user.avatar_url ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                    }
                    alt={user.full_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate max-w-[110px] font-display">
                    {user.full_name}
                  </div>
                  <div className="text-[9px] text-cyan-400 uppercase font-mono font-bold tracking-wider">
                    {user.role}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-[10px] font-mono text-zinc-400 hover:text-rose-400 font-semibold px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                title="Sign Out"
              >
                EXIT
              </button>
            </div>
          ) : loading ? (
            <div className="w-full h-9 rounded-xl bg-white/5 animate-pulse" />
          ) : (
            <button
              onClick={() => {
                setAuthModalOpen(true);
                if (onClose) onClose();
              }}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02]"
            >
              CONNECT SESSION
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
