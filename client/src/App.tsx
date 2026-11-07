import React, { useState, useEffect } from 'react';
import { NavView } from './types';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { PlaylistModalProvider, usePlaylistModal } from './context/PlaylistModalContext';

import { DiscoverView } from './views/DiscoverView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { PlaylistsView } from './views/PlaylistsView';
import { PlaylistDetailView } from './views/PlaylistDetailView';
import { AlbumsView } from './views/AlbumsView';
import { AlbumDetailView } from './views/AlbumDetailView';
import { ArtistsView } from './views/ArtistsView';
import { ArtistDetailView } from './views/ArtistDetailView';
import { FavouritesView } from './views/FavouritesView';
import { RecentlyPlayedView } from './views/RecentlyPlayedView';
import { AdminDashboardView } from './views/AdminDashboardView';

import { FloatingMiniPlayer } from './components/FloatingMiniPlayer';
import { FloatingBottomNav } from './components/FloatingBottomNav';
import { FullScreenPlayerModal } from './components/FullScreenPlayerModal';
import { QueueDrawer } from './components/QueueDrawer';
import { AuthModal } from './components/AuthModal';

import { ChevronLeft, User, LogIn } from 'lucide-react';
import { useAuth } from './context/AuthContext';

interface HistoryItem {
  view: NavView;
  payload?: any;
}

const MinimalTopBar: React.FC<{
  currentView: NavView;
  canGoBack: boolean;
  onGoBack: () => void;
  onNavigate: (view: NavView) => void;
}> = ({ currentView, canGoBack, onGoBack, onNavigate }) => {
  const { user, isAuthenticated, setAuthModalOpen } = useAuth();
  if (currentView === 'home' || currentView === 'explore') return null;

  return (
    <header className="h-14 px-4 sm:px-6 bg-[#000000]/90 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between sticky top-0 z-30 shrink-0 select-none">
      <div className="flex items-center gap-3">
        {canGoBack && (
          <button
            onClick={onGoBack}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-sm font-bold text-white capitalize">
          {currentView.replace('-', ' ')}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <button
            onClick={() => onNavigate('admin')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161618] hover:bg-[#202024] border border-white/10 text-xs font-medium text-white transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{user?.email?.split('@')[0] || 'Profile'}</span>
          </button>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-transform active:scale-95"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

const SonoraApp: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([{ view: 'home' }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const { setNavigateHandler } = usePlaylistModal();

  const currentItem = history[historyIndex] || { view: 'home' };
  const currentView = currentItem.view;
  const currentPayload = currentItem.payload;

  const navigate = (view: NavView, payload?: any) => {
    const nextItem: HistoryItem = { view, payload };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(nextItem);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setNavigateHandler(navigate);
  }, []);

  const handleGoBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#000000] text-white antialiased selection:bg-white/20">
      {/* Minimal Navigation Top Bar (shows when navigated away from Discover) */}
      <MinimalTopBar
        currentView={currentView}
        canGoBack={historyIndex > 0}
        onGoBack={handleGoBack}
        onNavigate={navigate}
      />

      {/* Main Scrollable Canvas */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative bg-[#000000]">
        {(currentView === 'home' || currentView === 'explore') && (
          <DiscoverView onNavigate={navigate} />
        )}
        {currentView === 'search' && <SearchView onNavigate={navigate} />}
        {currentView === 'library' && <LibraryView onNavigate={navigate} />}
        {currentView === 'playlists' && <PlaylistsView onNavigate={navigate} />}
        {currentView === 'playlist-detail' && currentPayload?.id && (
          <PlaylistDetailView playlistId={currentPayload.id} onNavigate={navigate} />
        )}
        {currentView === 'albums' && <AlbumsView onNavigate={navigate} />}
        {currentView === 'album-detail' && currentPayload?.id && (
          <AlbumDetailView albumId={currentPayload.id} onNavigate={navigate} />
        )}
        {currentView === 'artists' && <ArtistsView onNavigate={navigate} />}
        {currentView === 'artist-detail' && currentPayload?.id && (
          <ArtistDetailView artistId={currentPayload.id} onNavigate={navigate} />
        )}
        {currentView === 'favourites' && <FavouritesView onNavigate={navigate} />}
        {currentView === 'history' && <RecentlyPlayedView onNavigate={navigate} />}
        {currentView === 'admin' && <AdminDashboardView onNavigate={navigate} />}
      </main>

      {/* Queue Drawer */}
      <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />

      {/* Floating Mini Player (Capsule anchored above bottom nav) */}
      <FloatingMiniPlayer onToggleQueue={() => setIsQueueOpen(!isQueueOpen)} />

      {/* Floating Bottom Navigation (Glass Capsule from Reference) */}
      <FloatingBottomNav currentView={currentView} onNavigate={navigate} />

      {/* Full-Screen Now Playing (Opens on tap or swipe up) */}
      <FullScreenPlayerModal />

      {/* Authentication Modal */}
      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FavoritesProvider>
          <AudioPlayerProvider>
            <PlaylistModalProvider>
              <SonoraApp />
            </PlaylistModalProvider>
          </AudioPlayerProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
