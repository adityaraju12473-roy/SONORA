import React from 'react';
import { Compass, Search, Library, Music2, User, Sparkles } from 'lucide-react';
import { NavView } from '../types';

interface FloatingBottomNavProps {
  currentView: NavView;
  onNavigate: (view: NavView, payload?: any) => void;
}

export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = ({
  currentView,
  onNavigate,
}) => {
  const isDiscover = currentView === 'home' || currentView === 'explore';
  const isLibrary = currentView === 'library' || currentView === 'playlists' || currentView === 'favourites';
  const isSearch = currentView === 'search';

  return (
    <nav className="fixed bottom-3.5 left-1/2 -translate-x-1/2 z-40 select-none">
      <div className="flex items-center gap-6 sm:gap-10 px-5 py-2 rounded-full bg-[#161618]/92 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.95)]">
        {/* 1. Discover Tab (Gold Accent Icon from Reference) */}
        <button
          onClick={() => onNavigate('home')}
          className="flex flex-col items-center gap-1 group transition-all"
          title="Discover"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isDiscover
                ? 'bg-[#eab308] text-black shadow-[0_2px_10px_rgba(234,179,8,0.4)] scale-105'
                : 'bg-white/10 text-white group-hover:bg-white/20'
            }`}
          >
            <Music2 className="w-4 h-4 fill-current stroke-[2.5]" />
          </div>
          <span
            className={`text-[10px] font-medium tracking-tight transition-colors ${
              isDiscover ? 'text-white font-semibold' : 'text-[#8e8e93] group-hover:text-white'
            }`}
          >
            Discover
          </span>
        </button>

        {/* 2. Library Tab */}
        <button
          onClick={() => onNavigate('library')}
          className="flex flex-col items-center gap-1 group transition-all"
          title="Your Library"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isLibrary
                ? 'bg-white text-black shadow-md scale-105'
                : 'text-[#8e8e93] group-hover:text-white'
            }`}
          >
            <Library className="w-4 h-4 stroke-[2]" />
          </div>
          <span
            className={`text-[10px] font-medium tracking-tight transition-colors ${
              isLibrary ? 'text-white font-semibold' : 'text-[#8e8e93] group-hover:text-white'
            }`}
          >
            Library
          </span>
        </button>

        {/* 3. Search Tab */}
        <button
          onClick={() => onNavigate('search')}
          className="flex flex-col items-center gap-1 group transition-all"
          title="Search Catalogue"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isSearch
                ? 'bg-white text-black shadow-md scale-105'
                : 'text-[#8e8e93] group-hover:text-white'
            }`}
          >
            <Search className="w-4 h-4 stroke-[2]" />
          </div>
          <span
            className={`text-[10px] font-medium tracking-tight transition-colors ${
              isSearch ? 'text-white font-semibold' : 'text-[#8e8e93] group-hover:text-white'
            }`}
          >
            Search
          </span>
        </button>
      </div>
    </nav>
  );
};

