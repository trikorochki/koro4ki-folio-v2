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

const DURATION_TIMEOUT = 10000; // Увеличено для Blob Storage
const ANALYTICS_TIMEOUT = 5000;
const MAX_RETRY_ATTEMPTS = 3;

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Получает прямой URL трека из Blob Storage
 * Теперь возвращает прямые URL без проксирования через API
 */
const getTrackUrl = (track: Track): string => {
  console.log(`🎵 Getting track URL: ${track.file}`);
  
  // Проверяем, является ли это прямым URL из Blob Storage
  if (track.file.startsWith('https://') || track.file.startsWith('blob:')) {
    return track.file;
  }
  
  // Fallback для старых форматов путей
  if (track.file.startsWith('/api/music/')) {
    console.warn('⚠️ Using legacy API path, consider updating to direct Blob Storage URL');
    return track.file;
  }
  
  console.error('❌ Invalid track URL format:', track.file);
  return track.file;
};

/**
 * Оптимизированный Fisher-Yates shuffle алгоритм
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  
  // Оптимизированный Fisher-Yates алгоритм
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Используем crypto.getRandomValues для лучшей случайности
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const j = Math.floor((randomBytes[0] / (0xFFFFFFFF + 1)) * (i + 1));
    
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

// ================================================================================
// ENHANCED ASYNC FUNCTIONS
// ================================================================================

/**
 * Улучшенная функция получения длительности с поддержкой Blob Storage URL
 */
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

  let retryCount = 0;
  const maxRetries = MAX_RETRY_ATTEMPTS;

  const attemptDurationLoad = async (): Promise<void> => {
    try {
      const audioUrl = getTrackUrl(track);
      console.log(`⏱️ Loading duration (attempt ${retryCount + 1}/${maxRetries}): ${track.title}`);
      console.log(`🔗 URL: ${audioUrl}`);
      
      // Валидация URL
      if (!audioUrl || (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob:'))) {
        throw new Error(`Invalid audio URL: ${audioUrl}`);
      }
      
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.crossOrigin = 'anonymous'; // Для CORS с Blob Storage
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('canplaythrough', handleCanPlayThrough);
          try {
            audio.src = '';
          } catch (e) {
            console.warn('Error clearing audio src:', e);
          }
        };

        const handleLoadedMetadata = () => {
          if (!isNaN(audio.duration) && audio.duration > 0) {
            const formattedDuration = formatTime(audio.duration);
            DurationCache.set(trackId, formattedDuration);
            updateFn(trackId, formattedDuration);
            console.log(`⏱️ Got duration for ${trackId}: ${formattedDuration}`);
            cleanup();
            resolve();
          } else {
            console.warn(`⚠️ Invalid duration for ${trackId}: ${audio.duration}`);
            cleanup();
            reject(new Error('Invalid duration'));
          }
        };

        const handleCanPlayThrough = () => {
          // Fallback если loadedmetadata не срабатывает
          if (!isNaN(audio.duration) && audio.duration > 0) {
            handleLoadedMetadata();
          }
        };

        const handleError = (event: Event) => {
          const target = event.target as HTMLAudioElement;
          const error = target.error;
          
          let errorMessage = 'Unknown audio error';
          if (error) {
            switch (error.code) {
              case 1: errorMessage = 'Audio loading aborted'; break;
              case 2: errorMessage = 'Network error'; break;
              case 3: errorMessage = 'Audio decode error'; break;
              case 4: errorMessage = 'Audio format not supported'; break;
            }
          }
          
          console.warn(`❌ Audio error for ${trackId}:`, errorMessage);
          cleanup();
          reject(new Error(errorMessage));
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('error', handleError);
        audio.addEventListener('canplaythrough', handleCanPlayThrough);
      });

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout loading duration for track ${trackId} (${DURATION_TIMEOUT}ms)`));
        }, DURATION_TIMEOUT);
      });

      // Устанавливаем источник и ждем загрузки
      audio.src = audioUrl;
      await Promise.race([loadPromise, timeoutPromise]);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`⚠️ Failed to get duration for ${trackId} (attempt ${retryCount + 1}):`, errorMessage);
      
      retryCount++;
      if (retryCount < maxRetries) {
        // Экспоненциальная задержка между попытками
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptDurationLoad();
      } else {
        console.error(`💥 Failed to get duration for ${trackId} after ${maxRetries} attempts`);
        // Устанавливаем placeholder duration в кэш чтобы не пытаться снова
        DurationCache.set(trackId, '0:00');
        throw error;
      }
    }
  };

  try {
    await attemptDurationLoad();
  } catch (error) {
    console.warn(`Final error getting duration for track ${trackId}:`, error);
  }
};

/**
 * Улучшенная функция аналитики с обработкой ошибок
 */
const sendAnalytics = async (trackId: string, eventType: string = 'play'): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYTICS_TIMEOUT);

    const response = await fetch('/api/listen', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        trackId,
        event: eventType,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Analytics request failed with status ${response.status}`);
    } else {
      console.log(`📊 Analytics sent: ${eventType} for ${trackId}`);
    }

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('📊 Analytics request timeout');
      } else {
        console.warn('📊 Analytics request failed:', error.message);
      }
    } else {
      console.warn('📊 Analytics request failed with unknown error');
    }
  }
};

// ================================================================================
// ZUSTAND STORE
// ================================================================================

export const useMusicPlayer = create<MusicPlayerStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0,
  shuffle: false,
  repeat: 'off',
  queue: [],
  currentIndex: 0,

  playTrack: (track: Track) => {
    const { queue } = get();
    const trackIndex = queue.findIndex(t => t.id === track.id);
    
    const trackUrl = getTrackUrl(track);
    console.log(`🎵 Playing track: ${track.title} from ${trackUrl}`);
    
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
    }).catch(error => {
      console.warn(`Failed to update duration for ${track.id}:`, error);
    });
    
    // Отправляем аналитику
    sendAnalytics(track.id, 'play').catch(error => {
      console.warn(`Failed to send analytics for ${track.id}:`, error);
    });
  },

  pauseTrack: () => {
    set({ isPlaying: false });
  },

  resumeTrack: () => {
    const { currentTrack } = get();
    if (currentTrack) {
      set({ isPlaying: true });
      
      // Отправляем аналитику о возобновлении
      sendAnalytics(currentTrack.id, 'resume').catch(error => {
        console.warn(`Failed to send resume analytics:`, error);
      });
    }
  },

  nextTrack: () => {
    const { queue, currentIndex, repeat } = get();
    
    if (queue.length === 0) return;
    
    let nextIndex = currentIndex + 1;
    
    if (repeat === 'one') {
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
      console.log(`⏭️ Next track: ${nextTrack.title}`);
      
      set({
        currentIndex: nextIndex,
        currentTrack: nextTrack,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Асинхронно обновляем длительность
      updateTrackDurationAsync(nextTrack.id, nextTrack, (trackId, duration) => {
        const { updateTrackDuration } = get();
        updateTrackDuration(trackId, duration);
      }).catch(error => {
        console.warn(`Failed to update duration for next track ${nextTrack.id}:`, error);
      });
      
      // Отправляем аналитику
      sendAnalytics(nextTrack.id, 'skip_next').catch(error => {
        console.warn(`Failed to send next track analytics:`, error);
      });
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
      console.log(`⏮️ Previous track: ${prevTrack.title}`);
      
      set({
        currentIndex: prevIndex,
        currentTrack: prevTrack,
        isPlaying: true,
        currentTime: 0,
      });
      
      // Асинхронно обновляем длительность
      updateTrackDurationAsync(prevTrack.id, prevTrack, (trackId, duration) => {
        const { updateTrackDuration } = get();
        updateTrackDuration(trackId, duration);
      }).catch(error => {
        console.warn(`Failed to update duration for prev track ${prevTrack.id}:`, error);
      });
      
      // Отправляем аналитику
      sendAnalytics(prevTrack.id, 'skip_prev').catch(error => {
        console.warn(`Failed to send prev track analytics:`, error);
      });
    }
  },

  setCurrentTime: (time: number) => {
    if (isNaN(time)) {
      console.warn('⚠️ Invalid time value:', time);
      return;
    }
    const validTime = Math.max(0, time);
    set({ currentTime: validTime });
  },
  
  setDuration: (duration: number) => {
    if (isNaN(duration)) {
      console.warn('⚠️ Invalid duration value:', duration);
      return;
    }
    const validDuration = Math.max(0, duration);
    set({ duration: validDuration });
  },
  
  setVolume: (volume: number) => {
    if (isNaN(volume)) {
      console.warn('⚠️ Invalid volume value:', volume);
      return;
    }
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: clampedVolume });
  },
  
  setShuffle: (shuffle: boolean) => {
    set({ shuffle });
    console.log(`🔀 Shuffle ${shuffle ? 'enabled' : 'disabled'}`);
  },
  
  setRepeat: (repeat: 'off' | 'one' | 'all') => {
    set({ repeat });
    console.log(`🔁 Repeat mode: ${repeat}`);
  },
  
  setQueue: (tracks: Track[]) => {
    if (tracks.length === 0) {
      set({ 
        queue: [], 
        currentTrack: null, 
        currentIndex: 0,
        isPlaying: false,
        currentTime: 0
      });
      console.log('🗑️ Queue cleared');
      return;
    }
    
    console.log(`📋 Queue set with ${tracks.length} tracks`);
    set({ 
      queue: [...tracks],
      currentIndex: 0,
      currentTime: 0
    });
  },
  
  shuffleAndPlay: (tracks: Track[]) => {
    if (tracks.length === 0) {
      console.warn('⚠️ Cannot shuffle empty track list');
      return;
    }
    
    const shuffled = shuffleArray(tracks);
    const firstTrack = shuffled[0];
    
    console.log(`🔀 Shuffle play starting with: ${firstTrack.title}`);
    console.log(`📋 Shuffled ${shuffled.length} tracks`);
    
    set({
      queue: shuffled,
      currentIndex: 0,
      currentTrack: firstTrack,
      isPlaying: true,
      currentTime: 0,
      shuffle: true,
    });
    
    // Асинхронно обновляем длительность первого трека
    updateTrackDurationAsync(firstTrack.id, firstTrack, (trackId, duration) => {
      const { updateTrackDuration } = get();
      updateTrackDuration(trackId, duration);
    }).catch(error => {
      console.warn(`Failed to update duration for shuffle first track ${firstTrack.id}:`, error);
    });
    
    // Отправляем аналитику
    sendAnalytics(firstTrack.id, 'shuffle_play').catch(error => {
      console.warn(`Failed to send shuffle play analytics:`, error);
    });
  },

  clearQueue: () => {
    console.log('🗑️ Clearing queue and stopping playback');
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

  getAllTracks: () => {
    const { queue } = get();
    return [...queue];
  },

  updateTrackDuration: (trackId: string, duration: string) => {
    const { currentTrack, queue } = get();
    
    // Валидация длительности
    if (!duration || duration === 'NaN:aN') {
      console.warn(`⚠️ Invalid duration for track ${trackId}: ${duration}`);
      return;
    }
    
    // Обновляем текущий трек если это он
    if (currentTrack?.id === trackId) {
      set({
        currentTrack: { ...currentTrack, duration }
      });
    }
    
    // Обновляем трек в очереди
    const updatedQueue = queue.map(track => 
      track.id === trackId ? { ...track, duration } : track
    );
    
    set({ queue: updatedQueue });
    
    console.log(`⏱️ Updated duration for ${trackId}: ${duration}`);
  },
}));
