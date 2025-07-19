// src/lib/music-player.ts
'use client';

import { create } from 'zustand';
import { Track, PlayerState } from '@/types/music';
import { DurationCache } from './duration-cache';

interface MusicPlayerStore extends PlayerState {
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: 'off' | 'one' | 'all') => void;
  setQueue: (tracks: Track[]) => void;
  shuffleAndPlay: (tracks: Track[]) => void;
  getAllTracks: () => Track[];
  resumeTrack: () => void;
  clearQueue: () => void;
  findTrackIndex: (trackId: string) => number;
  updateTrackDuration: (trackId: string, duration: string) => void;
}

// Асинхронное получение длительности трека
const updateTrackDurationAsync = async (trackId: string, audioUrl: string, updateFn: (id: string, duration: string) => void) => {
  const cached = DurationCache.get(trackId);
  if (cached && cached !== '0:00') {
    updateFn(trackId, cached);
    return;
  }

  try {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    audio.addEventListener('loadedmetadata', () => {
      if (!isNaN(audio.duration) && audio.duration > 0) {
        const durationInSeconds = Math.floor(audio.duration);
        const formattedDuration = formatTime(durationInSeconds);
        
        DurationCache.set(trackId, formattedDuration);
        updateFn(trackId, formattedDuration);
        
        console.log(`⏱️ Got duration for ${trackId}: ${formattedDuration}`);
      }
    });
    
    audio.addEventListener('error', (error) => {
      console.warn(`Failed to get duration for track ${trackId}:`, error);
    });
    
    setTimeout(() => {
      if (audio.readyState === 0) {
        console.warn(`Timeout getting duration for track ${trackId}`);
      }
    }, 5000);
    
    audio.src = audioUrl;
  } catch (error) {
    console.warn(`Error getting duration for track ${trackId}:`, error);
  }
};

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const useMusicPlayer = create<MusicPlayerStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0, // 100% громкость по умолчанию
  shuffle: false,
  repeat: 'off',
  queue: [],
  currentIndex: 0,

  playTrack: (track: Track) => {
    const { queue } = get();
    const trackIndex = queue.findIndex(t => t.id === track.id);
    
    set({
      currentTrack: track,
      isPlaying: true,
      currentIndex: trackIndex >= 0 ? trackIndex : 0,
      currentTime: 0,
    });
    
    // Асинхронно получаем длительность при воспроизведении
    if (typeof window !== 'undefined') {
      updateTrackDurationAsync(track.id, track.file, (trackId, duration) => {
        const { updateTrackDuration } = get();
        updateTrackDuration(trackId, duration);
      });
    }
    
    // Record analytics with error handling
    if (typeof window !== 'undefined') {
    fetch('/api/listen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackId: track.id,
        event: '30s_listen', // или eventType
      }),
    }).catch(error => {
      console.warn('Analytics request failed:', error);
    });
    }
  },

  pauseTrack: () => set({ isPlaying: false }),

  resumeTrack: () => {
    const { currentTrack } = get();
    if (currentTrack) {
      set({ isPlaying: true });
    }
  },

  nextTrack: () => {
    const { queue, currentIndex, repeat, shuffle } = get();
    
    if (queue.length === 0) return;
    
    let nextIndex = currentIndex + 1;
    
    if (repeat === 'one') {
      return;
    } else if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }
    
    if (queue[nextIndex]) {
      const nextTrack = queue[nextIndex];
      set({
        currentIndex: nextIndex,
        currentTrack: nextTrack,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Получаем длительность нового трека
      if (typeof window !== 'undefined') {
        updateTrackDurationAsync(nextTrack.id, nextTrack.file, (trackId, duration) => {
          const { updateTrackDuration } = get();
          updateTrackDuration(trackId, duration);
        });
      }
      
      // Record analytics for new track
      if (typeof window !== 'undefined') {
        fetch('/api/listen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId: nextTrack.id,
            event: '30s_listen',
          }),
        }).catch(error => {
          console.warn('Analytics request failed:', error);
        });
      }
    }
  },

  prevTrack: () => {
    const { queue, currentIndex } = get();
    
    if (queue.length === 0) return;
    
    let prevIndex = currentIndex - 1;
    
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    
    if (queue[prevIndex]) {
      const prevTrack = queue[prevIndex];
      set({
        currentIndex: prevIndex,
        currentTrack: prevTrack,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Получаем длительность предыдущего трека
      if (typeof window !== 'undefined') {
        updateTrackDurationAsync(prevTrack.id, prevTrack.file, (trackId, duration) => {
          const { updateTrackDuration } = get();
          updateTrackDuration(trackId, duration);
        });
      }
      
      // Record analytics for new track
      if (typeof window !== 'undefined') {
        fetch('/api/listen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId: prevTrack.id,
            event: '30s_listen',
          }),
        }).catch(error => {
          console.warn('Analytics request failed:', error);
        });
      }
    }
  },

  setCurrentTime: (time: number) => set({ currentTime: time }),
  
  setDuration: (duration: number) => set({ duration }),
  
  setVolume: (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: clampedVolume });
  },
  
  setShuffle: (shuffle: boolean) => set({ shuffle }),
  
  setRepeat: (repeat: 'off' | 'one' | 'all') => set({ repeat }),
  
  setQueue: (tracks: Track[]) => {
    if (tracks.length === 0) {
      set({ 
        queue: [], 
        currentTrack: null, 
        currentIndex: 0,
        isPlaying: false,
        currentTime: 0
      });
      return;
    }
    
    set({ 
      queue: tracks, 
      currentIndex: 0,
      currentTime: 0
    });
  },
  
  shuffleAndPlay: (tracks: Track[]) => {
    if (tracks.length === 0) return;
    
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    
    set({
      queue: shuffled,
      currentIndex: 0,
      currentTrack: shuffled[0],
      isPlaying: true,
      currentTime: 0,
      shuffle: true,
    });
    
    // Получаем длительность первого трека
    if (typeof window !== 'undefined') {
      updateTrackDurationAsync(shuffled[0].id, shuffled[0].file, (trackId, duration) => {
        const { updateTrackDuration } = get();
        updateTrackDuration(trackId, duration);
      });
    }
    
    // Record analytics for first track
    if (typeof window !== 'undefined') {
      fetch('/api/listen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: shuffled[0].id,
          event: '30s_listen',
        }),
      }).catch(error => {
        console.warn('Analytics request failed:', error);
      });
    }
  },

  clearQueue: () => {
    set({
      queue: [],
      currentTrack: null,
      currentIndex: 0,
      isPlaying: false,
      currentTime: 0,
    });
  },

  findTrackIndex: (trackId: string) => {
    const { queue } = get();
    return queue.findIndex(track => track.id === trackId);
  },

  getAllTracks: () => get().queue,

  updateTrackDuration: (trackId: string, duration: string) => {
    const { currentTrack, queue } = get();
    
    // Обновляем текущий трек
    if (currentTrack?.id === trackId) {
      set({
        currentTrack: { ...currentTrack, duration }
      });
    }
    
    // Обновляем в очереди
    const updatedQueue = queue.map(track => 
      track.id === trackId ? { ...track, duration } : track
    );
    set({ queue: updatedQueue });
  },
}));
