import React, { useState, useEffect } from 'react';
import {
  Music2,
  PlaySquare,
  AudioWaveform,
  Play,
  Pause,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { Song, Album, NavView } from '../types';
import { api } from '../services/api';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useSongArtwork } from '../hooks/useSongArtwork';
import { isSongArtworkVerified } from '../utils/artworkResolver';

interface DiscoverViewProps {
  onNavigate: (view: NavView, payload?: any) => void;
}

/**
 * Individual Album Grid Item with high-res verified artwork
 */
const AlbumGridItem: React.FC<{
  song: Song;
  onSelect: () => void;
}> = ({ song, onSelect }) => {
  const artwork = useSongArtwork(song);
  const isVerified = isSongArtworkVerified(song);

  return (
    <div
      onClick={onSelect}
      className="group relative aspect-square rounded-xl overflow-hidden bg-[#161618] border border-white/[0.06] hover:border-white/20 cursor-pointer active:scale-95 transition-all duration-200"
      title={`${song.album_name || song.title} - ${song.artist_name}`}
    >
      <img
        src={artwork}
        alt={song.title}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      {!isVerified && (
        <div
          className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-400 backdrop-blur-sm"
          title="Artwork pending manual review"
        >
          Review
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-end p-2.5 transition-opacity">
        <span className="text-[11px] font-semibold text-white truncate drop-shadow">
          {song.title}
        </span>
      </div>
    </div>
  );
};

/**
 * Songs on Display Pill Card (Exact match to reference Screen 2)
 */
const SongDisplayPill: React.FC<{
  song: Song;
  playlist: Song[];
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: () => void;
}> = ({ song, isPlaying, isCurrent, onPlay }) => {
  const artwork = useSongArtwork(song);
  const isVerified = isSongArtworkVerified(song);

  return (
    <div
      onClick={onPlay}
      className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-2xl border transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
        isCurrent
          ? 'bg-[#202024] border-white/20 shadow-md'
          : 'bg-[#161618] hover:bg-[#1e1e22] border-white/[0.06] hover:border-white/15'
      }`}
    >
      {/* Circular Artwork Thumbnail */}
      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0 border border-white/10 bg-zinc-900">
        <img
          src={artwork}
          alt={song.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {isCurrent && isPlaying && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          </div>
        )}
      </div>

      {/* Song Title & Artist / Year */}
      <div className="truncate flex-1 min-w-0 pr-1">
        <div className="text-xs sm:text-[13px] font-semibold text-white truncate leading-tight flex items-center gap-1.5">
          <span className="truncate">{song.title}</span>
          {!isVerified && (
            <span className="px-1 py-0.2 rounded bg-amber-500/20 text-[8px] font-bold text-amber-400 shrink-0">
              Review
            </span>
          )}
        </div>
        <div className="text-[10px] sm:text-[11px] text-[#8e8e93] truncate leading-tight mt-0.5 flex items-center gap-1 font-normal">
          {song.release_year && (
            <span className="px-1 py-0.2 rounded bg-white/10 text-[9px] font-bold text-white leading-none">
              E
            </span>
          )}
          <span className="truncate">{song.artist_name}</span>
          {song.release_year ? <span>· {song.release_year}</span> : null}
        </div>
      </div>
    </div>
  );
};

/**
 * Musical Read Editorial Card (Portrait 2:3 aspect ratio)
 */
const MusicalReadCard: React.FC<{
  song: Song;
  onSelect: () => void;
}> = ({ song, onSelect }) => {
  const artwork = useSongArtwork(song);
  const isVerified = isSongArtworkVerified(song);

  return (
    <div
      onClick={onSelect}
      className="w-28 sm:w-36 shrink-0 cursor-pointer group active:scale-95 transition-transform"
    >
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#161618] border border-white/10 shadow-lg group-hover:border-white/20">
        <img
          src={artwork}
          alt={song.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {!isVerified && (
          <div
            className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-400 backdrop-blur-sm"
            title="Artwork pending manual review"
          >
            Review
          </div>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5">
        <div className="text-xs font-semibold text-white truncate group-hover:text-zinc-200">
          {song.title}
        </div>
        <div className="text-[10px] text-[#8e8e93] truncate">
          {song.artist_name}
        </div>
      </div>
    </div>
  );
};

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'featured'>('browse');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const { currentSong, isPlaying, playSong } = useAudioPlayer();

  useEffect(() => {
    const loadCatalogue = async () => {
      try {
        setLoading(true);
        const songsData = await api.getSongs();
        setSongs(songsData);
      } catch (err) {
        console.error('Failed to load catalogue in DiscoverView:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCatalogue();
  }, []);

  // Responsive track slicing: wide screens show more items naturally
  const albumSongs = songs.slice(0, 18); // Shows 9 on mobile (3 cols x 3 rows) and fills 2-3 rows on desktop
  const displaySongs = songs.slice(18, 38); // 20 songs for display pills (2 cols mobile, 3-4 cols desktop)
  const editorialSongs = songs.slice(38, 54); // 16 songs for Musical Read
  const featuredSong = songs[0]; // Hero featured track/album

  const handlePlayAlbum = () => {
    if (featuredSong && songs.length > 0) {
      playSong(featuredSong, songs);
    }
  };

  return (
    <div className="min-h-full w-full bg-[#000000] text-white flex flex-col items-center">
      {/* Responsive Container: Mobile 390px, Tablet 768px, Laptop 1366px, Desktop 1920px */}
      <div className="w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] px-4 sm:px-6 lg:px-10 pt-4 pb-44 space-y-8">
        
        {/* TOP HEADER: Status & Capsule Switcher (Exact match to Reference) */}
        <header className="w-full flex items-center justify-between py-1 select-none">
          {/* Left: Two Capsule Buttons */}
          <div className="flex items-center gap-1.5 bg-[#161618] p-1 rounded-full border border-white/10">
            <button
              onClick={() => setActiveTab('browse')}
              className={`p-1.5 rounded-full transition-all ${
                activeTab === 'browse'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8e8e93] hover:text-white'
              }`}
              title="Browse Albums & Tracks"
            >
              <Music2 className="w-3.5 h-3.5 fill-current" />
            </button>
            <button
              onClick={() => setActiveTab('featured')}
              className={`p-1.5 rounded-full transition-all ${
                activeTab === 'featured'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#8e8e93] hover:text-white'
              }`}
              title="Featured Album of the Day"
            >
              <PlaySquare className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>

          {/* Center Title */}
          <div className="text-center">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Discover
            </h1>
          </div>

          {/* Right: Audio Spectrum / Mic Capsule */}
          <button
            onClick={() => onNavigate('search')}
            className="p-2 rounded-full bg-[#161618] hover:bg-[#202024] text-[#8e8e93] hover:text-white border border-white/10 transition-colors"
            title="Search Audio"
          >
            <AudioWaveform className="w-4 h-4" />
          </button>
        </header>

        {loading ? (
          <div className="space-y-6 animate-pulse py-4">
            <div className="h-5 w-24 bg-white/10 rounded-md" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <div key={i} className="aspect-square bg-white/5 rounded-xl" />
              ))}
            </div>
          </div>
        ) : activeTab === 'browse' ? (
          /* ============================================================
             SCREEN 1 & 2: BROWSE DISCOVER
             ============================================================ */
          <div className="space-y-8">
            {/* 1. ALBUMS (Responsive Grid: 3 cols on mobile, 4-8 on desktop) */}
            <section className="space-y-2.5">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Albums
                </h2>
                <p className="text-xs text-[#8e8e93] font-normal">
                  Some of the albums you've been discovering with NowPlaying.
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9 gap-2.5 sm:gap-3.5 pt-1">
                {albumSongs.map((song) => (
                  <AlbumGridItem
                    key={song.id}
                    song={song}
                    onSelect={() => {
                      if (song.album_id) {
                        onNavigate('album-detail', { id: song.album_id });
                      } else {
                        playSong(song, songs);
                      }
                    }}
                  />
                ))}
              </div>
            </section>

            {/* 2. SONGS ON DISPLAY (Responsive Grid: 1-2 cols mobile, 3-4 cols desktop) */}
            <section className="space-y-2.5">
              <div
                onClick={() => onNavigate('library')}
                className="group cursor-pointer inline-block"
              >
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1 group-hover:text-zinc-200">
                  <span>Songs on Display</span>
                  <ChevronRight className="w-4 h-4 text-[#8e8e93] group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                </h2>
                <p className="text-xs text-[#8e8e93] font-normal">
                  The songs you've found using SongDisplay.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                {displaySongs.map((song) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <SongDisplayPill
                      key={song.id}
                      song={song}
                      playlist={songs}
                      isPlaying={isPlaying}
                      isCurrent={isCurrent}
                      onPlay={() => playSong(song, songs)}
                    />
                  );
                })}
              </div>
            </section>

            {/* 3. MUSICAL READ (Editorial Horizontally Scrollable Collection) */}
            <section className="space-y-2.5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Musical Read
                </h2>
                <p className="text-xs text-[#8e8e93] font-normal">
                  Curated soundscapes & artist discographies.
                </p>
              </div>

              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar select-none">
                {editorialSongs.map((song) => (
                  <MusicalReadCard
                    key={song.id}
                    song={song}
                    onSelect={() => playSong(song, songs)}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ============================================================
             SCREEN 3: FEATURED ALBUM EXPERIENCE (Responsive Split Layout on Desktop)
             ============================================================ */
          <div className="space-y-8 pt-2">
            {featuredSong && (
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 lg:gap-14 bg-[#161618] border border-white/[0.08] rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl">
                {/* Hero Artwork */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 lg:w-96 lg:h-96 shrink-0 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/10 bg-zinc-900 mx-auto md:mx-0">
                  <img
                    src={featuredSong.cover_url}
                    alt={featuredSong.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Album Details Column */}
                <div className="flex-1 min-w-0 space-y-5 w-full">
                  {/* Album Title Header + ALBUM OF THE DAY Badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="truncate min-w-0">
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-black text-white tracking-tight uppercase truncate">
                        {featuredSong.album_name || featuredSong.title}
                      </h2>
                      <p className="text-sm sm:text-base font-medium text-[#8e8e93] mt-1">
                        {featuredSong.artist_name}
                      </p>
                    </div>

                    {/* Stacked Badge from Reference */}
                    <div className="text-right shrink-0">
                      <div className="text-[9px] sm:text-[10px] font-extrabold text-[#8e8e93] tracking-widest uppercase leading-tight">
                        ALBUM
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-extrabold text-[#8e8e93] tracking-widest uppercase leading-tight">
                        OF THE
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-extrabold text-[#8e8e93] tracking-widest uppercase leading-tight">
                        DAY
                      </div>
                    </div>
                  </div>

                  {/* Editorial Description */}
                  <p className="text-xs sm:text-sm lg:text-base text-zinc-300 leading-relaxed font-normal">
                    Immerse in the soundscapes of "{featuredSong.album_name || featuredSong.title},"
                    blending emotive melodies, authentic acoustic instrumentation, and introspective vibes.
                    Curated directly from the SONORA master collection.
                  </p>

                  {/* Metadata Tags */}
                  <div className="flex items-center justify-between text-xs sm:text-sm text-[#8e8e93] pt-1 border-t border-white/10">
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      <Zap className="w-4 h-4 fill-white text-white" />
                      <span>{featuredSong.genre || 'Electronic / Soundscape'}</span>
                    </div>
                    <div>
                      Released in {featuredSong.release_year || '2025'}
                    </div>
                  </div>

                  {/* Action Buttons: Learn more & Play Album */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        if (featuredSong.album_id) {
                          onNavigate('album-detail', { id: featuredSong.album_id });
                        }
                      }}
                      className="flex-1 py-3 px-5 rounded-full bg-[#202024] hover:bg-[#2c2c30] text-white text-xs sm:text-sm font-semibold border border-white/10 transition-colors active:scale-95 text-center"
                    >
                      Learn more
                    </button>

                    <button
                      onClick={handlePlayAlbum}
                      className="flex-1 py-3 px-5 rounded-full bg-white hover:bg-zinc-200 text-black text-xs sm:text-sm font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play Album</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIOUSLY FEATURED SECTION (Responsive Grid) */}
            <section className="space-y-3 pt-4 border-t border-white/10">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Previously Featured
                </h3>
                <p className="text-xs text-[#8e8e93]">
                  Albums that were featured on previous days.
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-3.5 pt-1">
                {songs.slice(1, 17).map((song) => (
                  <AlbumGridItem
                    key={'prev-' + song.id}
                    song={song}
                    onSelect={() => playSong(song, songs)}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
