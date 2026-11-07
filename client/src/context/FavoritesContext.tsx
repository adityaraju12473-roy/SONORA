import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Song } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: Song[];
  favoriteIds: Set<string>;
  toggleFavorite: (song: Song) => Promise<void>;
  isFavorite: (songId: string) => boolean;
  refreshFavorites: () => Promise<void>;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  const refreshFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getFavorites();
      setFavorites(data);
      setFavoriteIds(new Set(data.map((s) => s.id)));
    } catch (err) {
      console.error('Failed to load favorites', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites, isAuthenticated]);

  const toggleFavorite = async (song: Song) => {
    try {
      const isFav = favoriteIds.has(song.id);
      
      // Optimistic update
      if (isFav) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(song.id);
          return next;
        });
        setFavorites((prev) => prev.filter((s) => s.id !== song.id));
        showToast(`Removed "${song.title}" from Favourites`, 'info');
      } else {
        setFavoriteIds((prev) => new Set(prev).add(song.id));
        setFavorites((prev) => [song, ...prev]);
        showToast(`Added "${song.title}" to Favourites`, 'success');
      }

      await api.toggleFavorite(song.id);
    } catch (error) {
      console.error('Failed to toggle favorite', error);
      // Revert if error
      refreshFavorites();
      showToast('Could not update favourites', 'error');
    }
  };

  const isFavorite = (songId: string) => favoriteIds.has(songId);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoriteIds,
        toggleFavorite,
        isFavorite,
        refreshFavorites,
        loading,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
  return context;
};
