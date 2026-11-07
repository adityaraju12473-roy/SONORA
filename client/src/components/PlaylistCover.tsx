import React from 'react';
import { Song } from '../types';
import { getImmediateSongArtwork } from '../utils/artworkResolver';
import { ListMusic } from 'lucide-react';

interface PlaylistCoverProps {
  songs?: Song[];
  fallbackUrl?: string | null;
  title?: string;
  className?: string;
}

export const PlaylistCover: React.FC<PlaylistCoverProps> = ({
  songs,
  fallbackUrl,
  title = 'Playlist',
  className = '',
}) => {
  // If playlist has 2 or more songs, create a 2x2 artwork collage of actual tracks
  if (songs && songs.length >= 2) {
    let artworks: string[] = [];
    if (songs.length >= 4) {
      artworks = songs.slice(0, 4).map((s) => getImmediateSongArtwork(s));
    } else if (songs.length === 3) {
      artworks = [
        getImmediateSongArtwork(songs[0]),
        getImmediateSongArtwork(songs[1]),
        getImmediateSongArtwork(songs[2]),
        getImmediateSongArtwork(songs[0]),
      ];
    } else if (songs.length === 2) {
      artworks = [
        getImmediateSongArtwork(songs[0]),
        getImmediateSongArtwork(songs[1]),
        getImmediateSongArtwork(songs[1]),
        getImmediateSongArtwork(songs[0]),
      ];
    }

    return (
      <div className={`grid grid-cols-2 grid-rows-2 w-full h-full aspect-square overflow-hidden bg-[#161618] border border-white/5 ${className}`}>
        {artworks.map((art, idx) => (
          <div key={idx} className="relative w-full h-full overflow-hidden border-[0.5px] border-black/40">
            <img
              src={art}
              alt={`${title} track ${idx + 1}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    );
  }

  // If playlist has exactly 1 song, use that song's artwork
  if (songs && songs.length === 1) {
    const singleArt = getImmediateSongArtwork(songs[0]);
    return (
      <img
        src={singleArt}
        alt={title}
        loading="lazy"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  // Fallback if provided
  if (fallbackUrl) {
    return (
      <img
        src={fallbackUrl}
        alt={title}
        loading="lazy"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  // Minimalist black playlist placeholder
  return (
    <div className={`w-full h-full aspect-square flex items-center justify-center bg-[#161618] border border-white/5 text-zinc-500 ${className}`}>
      <ListMusic className="w-8 h-8 opacity-40" />
    </div>
  );
};
