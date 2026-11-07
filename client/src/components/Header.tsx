import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Command,
  User,
  LogOut,
  Menu,
  X,
  Radio,
  Sliders,
  ShieldCheck,
  Disc3,
} from 'lucide-react';
import { NavView } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onNavigate: (view: NavView, payload?: any) => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onGoForward?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  searchQuery,
  onSearchChange,
  onOpenMobileMenu,
}) => {
  const { user, isAuthenticated, logout, setAuthModalOpen, isAdmin, loading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K keyboard shortcut listener to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        onNavigate('search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  return (
    <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/[0.06] bg-[#07070d]/90 backdrop-blur-2xl sticky top-0 z-30 shrink-0 select-none">
      {/* 1. LEFT: Mobile Menu, History Navigation & Futuristic Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* History Back/Forward */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            onClick={onGoBack}
            disabled={!canGoBack}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-25 disabled:hover:bg-white/[0.04] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95"
            aria-label="Go back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onGoForward}
            disabled={!canGoForward}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-25 disabled:hover:bg-white/[0.04] flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95"
            aria-label="Go forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Cyberpunk Holographic Search Bar */}
        <div className="relative flex-1 max-w-md group">
          <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search catalogue, artists, archives..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              onNavigate('search');
            }}
            onFocus={() => {
              onNavigate('search');
            }}
            className="w-full bg-[#0d0d16]/90 border border-white/10 group-hover:border-white/20 focus:border-cyan-400/80 focus:shadow-[0_0_15px_rgba(0,240,255,0.2)] rounded-full pl-9 pr-12 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition-all font-sans"
          />

          {searchQuery ? (
            <button
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[9px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded-md border border-white/5 pointer-events-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. CENTER: Subtle Telemetry Status Beacon (Hidden on small screens) */}
      <div className="hidden xl:flex items-center gap-3 px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
        </span>
        <span className="text-[10px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
          AUDIO CORE <span className="text-cyan-400 font-bold">//</span> 910 CDN TRACKS ONLINE
        </span>
      </div>

      {/* 3. RIGHT: Curator Studio & User Profile System */}
      <div className="flex items-center gap-2.5 shrink-0 ml-3">
        {isAdmin && (
          <button
            onClick={() => onNavigate('admin')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-950/40 text-purple-300 border border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-900/30 hover:shadow-[0_0_15px_rgba(157,78,221,0.25)] transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="hidden md:inline font-mono text-[11px] font-bold tracking-wide">
              CURATOR STUDIO
            </span>
          </button>
        )}

        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1 pl-3 bg-[#0d0d16]/90 hover:bg-[#141422] border border-white/10 hover:border-cyan-500/30 rounded-full transition-all group"
            >
              <div className="text-left hidden md:block">
                <div className="text-xs font-display font-bold text-zinc-200 group-hover:text-white truncate max-w-[120px]">
                  {user.full_name}
                </div>
                <div className="text-[9px] font-mono text-cyan-400/80 -mt-0.5">
                  {isAdmin ? 'SYS-ADMIN' : 'OPERATOR'}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-1 ring-cyan-400/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                <img
                  src={
                    user.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'
                  }
                  alt={user.full_name}
                  className="w-full h-full object-cover"
                />
              </div>
            </button>

            {/* Futuristic Glassmorphic Profile Dropdown */}
            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0a0a14]/98 border border-cyan-500/20 p-2 z-50 animate-slide-up shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                onMouseLeave={() => setProfileOpen(false)}
              >
                {/* User Header */}
                <div className="px-3 py-2.5 border-b border-white/[0.08] mb-1.5 bg-gradient-to-r from-cyan-500/10 via-purple-500/5 to-transparent rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-white truncate">
                      {user.full_name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                      {isAdmin ? 'ADMIN' : 'USER'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                    {user.email}
                  </div>
                </div>

                {/* Menu Actions */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      onNavigate('library');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors text-left"
                  >
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Your Library</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('playlists');
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors text-left"
                  >
                    <Disc3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Playlists & Archives</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-950/30 rounded-xl transition-colors text-left"
                    >
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>Curator Studio</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-white/[0.06]" />

                  <button
                    onClick={() => {
                      logout();
                      setProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="w-24 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] animate-pulse" />
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="px-4 py-1.5 rounded-full text-xs font-display font-bold text-black bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all"
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
