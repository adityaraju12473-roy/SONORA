import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Song, RepeatMode } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { useFavorites } from './FavoritesContext';

interface AudioPlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Song[];
  queueIndex: number;
  isExpandedPlayer: boolean;
  setIsExpandedPlayer: (val: boolean) => void;
  playSong: (song: Song, contextQueue?: Song[]) => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playHistoryRecordedRef = useRef<boolean>(false);
  const { showToast } = useToast();
  const { toggleFavorite } = useFavorites();

  const [currentSong, setCurrentSong] = useState<Song | null>(() => {
    const saved = localStorage.getItem('sonora_current_song');
    return saved ? JSON.parse(saved) : null;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('sonora_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [queue, setQueue] = useState<Song[]>(() => {
    const saved = localStorage.getItem('sonora_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isExpandedPlayer, setIsExpandedPlayer] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('player=expanded')) {
      return true;
    }
    return false;
  });

  // Auto-initialize first catalogue song if URL requests expanded player test
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('player=expanded') && !currentSong) {
      api.getSongs().then((songs) => {
        if (songs && songs.length > 0) {
          setCurrentSong(songs[0]);
          setQueue(songs);
          setQueueIndex(0);
          setIsExpandedPlayer(true);
        }
      }).catch(() => {});
    }
  }, [currentSong]);

  // Initialize Audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    audio.volume = volume;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Record listening history once after listening for 5 seconds
      if (audio.currentTime > 5 && !playHistoryRecordedRef.current && currentSong) {
        playHistoryRecordedRef.current = true;
        api.recordHistory(currentSong.id).catch(() => {});
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const handlePause = () => setIsPlaying(false);

    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      if (audio.error && audio.src) {
        console.warn('Audio streaming notice:', audio.error.message);
        showToast('Stream buffer connection notice. Retrying audio stream...', 'info');
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []);

  // Save current song and queue to localStorage
  useEffect(() => {
    if (currentSong) {
      localStorage.setItem('sonora_current_song', JSON.stringify(currentSong));
    }
    localStorage.setItem('sonora_queue', JSON.stringify(queue));
  }, [currentSong, queue]);

  // Load and play song when currentSong changes
  const playSong = useCallback((song: Song, contextQueue?: Song[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    playHistoryRecordedRef.current = false;
    setCurrentSong(song);

    if (contextQueue && contextQueue.length > 0) {
      setQueue(contextQueue);
      const idx = contextQueue.findIndex((s) => s.id === song.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    } else if (queue.length === 0) {
      setQueue([song]);
      setQueueIndex(0);
    } else {
      const idx = queue.findIndex((s) => s.id === song.id);
      if (idx !== -1) {
        setQueueIndex(idx);
      } else {
        const nextQueue = [...queue, song];
        setQueue(nextQueue);
        setQueueIndex(nextQueue.length - 1);
      }
    }

    audio.src = song.audio_url;
    audio.currentTime = 0;
    audio.playbackRate = playbackRate;
    audio.play().then(() => {
      setIsPlaying(true);
    }).catch((err) => {
      console.warn('Audio autoplay interaction policy notice:', err);
    });
  }, [playbackRate, queue]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      if (queue.length > 0) {
        playSong(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => console.warn(e));
    }
  }, [currentSong, isPlaying, playSong, queue]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;

    if (repeat === 'one') {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play();
      }
      return;
    }

    let nextIdx = queueIndex + 1;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    }

    if (nextIdx >= queue.length) {
      if (repeat === 'all') {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    setQueueIndex(nextIdx);
    const nextSong = queue[nextIdx];
    if (nextSong) {
      playSong(nextSong, queue);
    }
  }, [queue, queueIndex, repeat, shuffle, playSong]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    // If more than 3 seconds in, restart the song
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = repeat === 'all' ? queue.length - 1 : 0;
    }

    setQueueIndex(prevIdx);
    const prevSong = queue[prevIdx];
    if (prevSong) {
      playSong(prevSong, queue);
    }
  }, [queue, queueIndex, repeat, playSong]);

  // Handle song ending
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      playNext();
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playNext]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(time, duration));
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const setVolume = useCallback((val: number) => {
    const audio = audioRef.current;
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    localStorage.setItem('sonora_volume', String(clamped));
    if (audio) {
      audio.volume = clamped;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const setPlaybackRate = useCallback((rate: number) => {
    const audio = audioRef.current;
    setPlaybackRateState(rate);
    if (audio) audio.playbackRate = rate;
    showToast(`Speed set to ${rate}x`, 'info');
  }, [showToast]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev;
      showToast(next ? 'Shuffle enabled' : 'Shuffle disabled', 'info');
      return next;
    });
  }, [showToast]);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => {
      if (prev === 'off') {
        showToast('Repeat all tracks', 'info');
        return 'all';
      }
      if (prev === 'all') {
        showToast('Repeat current track', 'info');
        return 'one';
      }
      showToast('Repeat off', 'info');
      return 'off';
    });
  }, [showToast]);

  const addToQueue = useCallback((song: Song) => {
    setQueue((prev) => [...prev, song]);
    showToast(`Added "${song.title}" to Queue`, 'success');
  }, [showToast]);

  const playNextInQueue = useCallback((song: Song) => {
    setQueue((prev) => {
      const next = [...prev];
      next.splice(queueIndex + 1, 0, song);
      return next;
    });
    showToast(`"${song.title}" will play next`, 'info');
  }, [queueIndex, showToast]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
    setQueueIndex((prevIndex) => {
      if (index < prevIndex) return Math.max(0, prevIndex - 1);
      if (index === prevIndex) return Math.max(0, prevIndex);
      return prevIndex;
    });
  }, []);

  const clearQueue = useCallback(() => {
    if (currentSong) {
      setQueue([currentSong]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(0);
    }
    showToast('Queue cleared', 'info');
  }, [currentSong, showToast]);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const result = Array.from(prev);
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
    setQueueIndex((prevIndex) => {
      if (fromIndex === prevIndex) return toIndex;
      if (fromIndex < prevIndex && toIndex >= prevIndex) return prevIndex - 1;
      if (fromIndex > prevIndex && toIndex <= prevIndex) return prevIndex + 1;
      return prevIndex;
    });
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) seek(audioRef.current.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) seek(audioRef.current.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(volume - 0.1);
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyL':
          if (currentSong) toggleFavorite(currentSong);
          break;
        case 'KeyN':
          playNext();
          break;
        case 'KeyP':
          playPrevious();
          break;
        case 'KeyS':
          toggleShuffle();
          break;
        case 'KeyR':
          cycleRepeat();
          break;
        case 'Escape':
          setIsExpandedPlayer(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, seek, setVolume, volume, toggleMute, toggleFavorite, currentSong, playNext, playPrevious, toggleShuffle, cycleRepeat]);

  return (
    <AudioPlayerContext.Provider
      value={{
        currentSong,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        isMuted,
        playbackRate,
        shuffle,
        repeat,
        queue,
        queueIndex,
        isExpandedPlayer,
        setIsExpandedPlayer,
        playSong,
        togglePlayPause,
        seek,
        playNext,
        playPrevious,
        setVolume,
        toggleMute,
        setPlaybackRate,
        toggleShuffle,
        cycleRepeat,
        addToQueue,
        playNextInQueue,
        removeFromQueue,
        clearQueue,
        reorderQueue,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  return context;
};
