// src/lib/music-player.ts
'use client';

import { create } from 'zustand';
import { Track, PlayerState } from '@/types/music';
import { DurationCache } from './duration-cache';

// ================================================================================
// TYPES & INTERFACES
// ================================================================================

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

// ================================================================================
// CONSTANTS
// ================================================================================

const DURATION_TIMEOUT = 8000; // Увеличен timeout до 8 секунд
const ANALYTICS_TIMEOUT = 5000;

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Создание правильного URL для аудиофайла
const createAudioUrl = (track: Track): string => {
  if (track.file.startsWith('/api/music/') || track.file.startsWith('http')) {
    return track.file;
  }
  
  // Если file содержит относительный путь, строим API URL
  return `/api/music/${track.file}`;
};

// ================================================================================
// ASYNC FUNCTIONS
// ================================================================================

// Улучшенное асинхронное получение длительности трека
const updateTrackDurationAsync = async (
  trackId: string, 
  track: Track, 
  updateFn: (id: string, duration: string) => void
): Promise<void> => {
  // Проверяем кэш
  const cached = DurationCache.get(trackId);
  if (cached && cached !== '0:00') {
    updateFn(trackId, cached);
    return;
  }

  try {
    const audioUrl = createAudioUrl(track);
    const audio = new Audio();
    audio.preload = 'metadata';
    
    // Promise для обработки загрузки метаданных
    const loadPromise = new Promise<void>((resolve, reject) => {
      const handleLoadedMetadata = () => {
        if (!isNaN(audio.duration) && audio.duration > 0) {
          const formattedDuration = formatTime(audio.duration);
          DurationCache.set(trackId, formattedDuration);
          updateFn(trackId, formattedDuration);
          console.log(`⏱️ Got duration for ${trackId}: ${formattedDuration}`);
        }
        cleanup();
        resolve();
      };

      const handleError = (error: any) => {
        console.warn(`Failed to get duration for track ${trackId}:`, error);
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleError);
        // Освобождаем ресурсы
        audio.src = '';
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('error', handleError);
    });

    // Timeout для предотвращения зависания
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout getting duration for track ${trackId}`));
      }, DURATION_TIMEOUT);
    });

    // Устанавливаем источник и ждем результат
    audio.src = audioUrl;
    
    await Promise.race([loadPromise, timeoutPromise]);

  } catch (error) {
    console.warn(`Error getting duration for track ${trackId}:`, error);
  }
};

// Отправка аналитики с улучшенной обработкой ошибок
const sendAnalytics = async (trackId: string, eventType: string = '30s_listen'): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYTICS_TIMEOUT);

    await fetch('/api/listen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackId,
        event: eventType,
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Analytics request timeout');
    } else {
      console.warn('Analytics request failed:', error);
    }
  }
};

// ================================================================================
// ZUSTAND STORE
// ================================================================================

export const useMusicPlayer = create<MusicPlayerStore>((set, get) => ({
  // Начальное состояние
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0,
  shuffle: false,
  repeat: 'off',
  queue: [],
  currentIndex: 0,

  // ================================================================================
  // TRACK PLAYBACK ACTIONS
  // ================================================================================

  playTrack: (track: Track) => {
    const { queue } = get();
    const trackIndex = queue.findIndex(t => t.id === track.id);
    
    set({
      currentTrack: track,
      isPlaying: true,
      currentIndex: trackIndex >= 0 ? trackIndex : 0,
      currentTime: 0,
    });
    
    // Асинхронно получаем длительность
    updateTrackDurationAsync(track.id, track, (trackId, duration) => {
      const { updateTrackDuration } = get();
      updateTrackDuration(trackId, duration);
    });
    
    // Отправляем аналитику
    sendAnalytics(track.id);
  },

  pauseTrack: () => {
    set({ isPlaying: false });
  },

  resumeTrack: () => {
    const { currentTrack } = get();
    if (currentTrack) {
      set({ isPlaying: true });
    }
  },

  // ================================================================================
  // NAVIGATION ACTIONS
  // ================================================================================

  nextTrack: () => {
    const { queue, currentIndex, repeat } = get();
    
    if (queue.length === 0) return;
    
    let nextIndex = currentIndex + 1;
    
    if (repeat === 'one') {
      // При repeat: 'one' перезапускаем текущий трек
      set({ currentTime: 0 });
      return;
    } else if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        set({ isPlaying: false });
        return;
      }
    }
    
    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      set({
        currentIndex: nextIndex,
        currentTrack: nextTrack,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Получаем длительность нового трека
      updateTrackDurationAsync(nextTrack.id, nextTrack, (trackId, duration) => {
        const { updateTrackDuration } = get();
        updateTrackDuration(trackId, duration);
      });
      
      // Отправляем аналитику
      sendAnalytics(nextTrack.id);
    }
  },

  prevTrack: () => {
    const { queue, currentIndex } = get();
    
    if (queue.length === 0) return;
    
    let prevIndex = currentIndex - 1;
    
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    
    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      set({
        currentIndex: prevIndex,
        currentTrack: prevTrack,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Получаем длительность предыдущего трека
      updateTrackDurationAsync(prevTrack.id, prevTrack, (trackId, duration) => {
        const { updateTrackDuration } = get();
        updateTrackDuration(trackId, duration);
      });
      
      // Отправляем аналитику
      sendAnalytics(prevTrack.id);
    }
  },

  // ================================================================================
  // PLAYER CONTROL ACTIONS
  // ================================================================================

  setCurrentTime: (time: number) => {
    const validTime = Math.max(0, time);
    set({ currentTime: validTime });
  },
  
  setDuration: (duration: number) => {
    const validDuration = Math.max(0, duration);
    set({ duration: validDuration });
  },
  
  setVolume: (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: clampedVolume });
  },
  
  setShuffle: (shuffle: boolean) => {
    set({ shuffle });
  },
  
  setRepeat: (repeat: 'off' | 'one' | 'all') => {
    set({ repeat });
  },

  // ================================================================================
  // QUEUE MANAGEMENT ACTIONS
  // ================================================================================
  
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
      queue: [...tracks], // Создаем копию массива
      currentIndex: 0,
      currentTime: 0
    });
  },
  
  shuffleAndPlay: (tracks: Track[]) => {
    if (tracks.length === 0) return;
    
    // Улучшенный shuffle алгоритм (Fisher-Yates)
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const firstTrack = shuffled[0];
    
    set({
      queue: shuffled,
      currentIndex: 0,
      currentTrack: firstTrack,
      isPlaying: true,
      currentTime: 0,
      shuffle: true,
    });
    
    // Получаем длительность первого трека
    updateTrackDurationAsync(firstTrack.id, firstTrack, (trackId, duration) => {
      const { updateTrackDuration } = get();
      updateTrackDuration(trackId, duration);
    });
    
    // Отправляем аналитику
    sendAnalytics(firstTrack.id);
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

  // ================================================================================
  // UTILITY ACTIONS
  // ================================================================================

  findTrackIndex: (trackId: string) => {
    const { queue } = get();
    return queue.findIndex(track => track.id === trackId);
  },

  getAllTracks: () => {
    const { queue } = get();
    return [...queue]; // Возвращаем копию для предотвращения мутации
  },

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
