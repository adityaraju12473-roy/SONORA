import { useState, useEffect } from 'react';
import { Song } from '../types';
import {
  getImmediateSongArtwork,
  fetchOfficialArtwork,
  isGenericArtwork,
} from '../utils/artworkResolver';

/**
 * Custom hook that returns the best artwork for a given song:
 * 1. Instantly returns a high-res deterministic cover or cached official cover with zero flicker.
 * 2. If the song has the generic fallback, queries official album artwork in the background
 *    and updates state once retrieved, caching it permanently in localStorage.
 */
export function useSongArtwork(song?: Song | null): string {
  const [artwork, setArtwork] = useState<string>(() => getImmediateSongArtwork(song));

  useEffect(() => {
    if (!song) return;

    // Set initial immediate artwork
    const initial = getImmediateSongArtwork(song);
    setArtwork(initial);

    // If song already has a custom (non-generic) cover, no fetch needed
    if (song.cover_url && !isGenericArtwork(song.cover_url)) {
      return;
    }

    let isMounted = true;

    // Asynchronously fetch official artwork from iTunes API
    fetchOfficialArtwork(song).then((officialCover) => {
      if (isMounted && officialCover && officialCover !== initial) {
        setArtwork(officialCover);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [song?.id, song?.title, song?.cover_url]);

  return artwork;
}

