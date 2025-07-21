// src/hooks/useDuration.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DurationCache } from '@/lib/duration-cache';

interface UseDurationReturn {
  duration: string;
  loading: boolean;
  error: boolean;
  loadDuration: () => void;
}

export const useDuration = (trackId: string, audioUrl: string): UseDurationReturn => {
  const [duration, setDuration] = useState<string>('--:--');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedRef = useRef<Set<string>>(new Set());

  // Форматирование времени в MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Загрузка длительности через Audio API
  const loadDuration = useCallback(async () => {
    if (!trackId || !audioUrl || loadedRef.current.has(trackId)) return;

    // Проверяем кеш
    const cached = DurationCache.get(trackId);
    if (cached) {
      setDuration(cached);
      return;
    }

    setLoading(true);
    setError(false);
    loadedRef.current.add(trackId);

    try {
      // Освобождаем предыдущий audio элемент
      if (audioRef.current) {
        audioRef.current.removeEventListener('loadedmetadata', () => {});
        audioRef.current.removeEventListener('error', () => {});
        audioRef.current = null;
      }

      const audio = new Audio();
      audioRef.current = audio;

      // Promise wrapper для событий audio
      const getDuration = new Promise<number>((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onLoad);
          audio.removeEventListener('error', onError);
        };

        const onLoad = () => {
          cleanup();
          resolve(audio.duration);
        };

        const onError = () => {
          cleanup();
          reject(new Error('Failed to load audio metadata'));
        };

        audio.addEventListener('loadedmetadata', onLoad);
        audio.addEventListener('error', onError);

        // Timeout для предотвращения зависания
        setTimeout(() => {
          cleanup();
          reject(new Error('Timeout loading audio metadata'));
        }, 10000);
      });

      audio.preload = 'metadata';
      audio.src = audioUrl;

      const durationSeconds = await getDuration;
      const formattedDuration = formatDuration(durationSeconds);
      
      setDuration(formattedDuration);
      DurationCache.set(trackId, formattedDuration);
      
      console.log(`✅ Loaded duration for ${trackId}: ${formattedDuration}`);

    } catch (err) {
      console.warn(`⚠️ Failed to load duration for ${trackId}:`, err);
      setError(true);
      setDuration('--:--');
    } finally {
      setLoading(false);
      
      // Cleanup audio element
      if (audioRef.current) {
        audioRef.current.src = '';
        audioRef.current = null;
      }
    }
  }, [trackId, audioUrl, formatDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('loadedmetadata', () => {});
        audioRef.current.removeEventListener('error', () => {});
        audioRef.current.src = '';
      }
    };
  }, []);

  return {
    duration,
    loading,
    error,
    loadDuration
  };
};

// Хук для множественных треков с батчевой загрузкой
export const useBatchDurations = (tracks: Array<{id: string, url: string}>) => {
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadAllDurations = useCallback(async () => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);

    const promises = tracks.map(async (track) => {
      // Проверяем кеш
      const cached = DurationCache.get(track.id);
      if (cached) {
        return { id: track.id, duration: cached };
      }

      try {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.src = track.url;

        const duration = await new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout'));
          }, 8000);

          const onLoad = () => {
            clearTimeout(timeout);
            resolve(audio.duration);
          };

          const onError = () => {
            clearTimeout(timeout);
            reject(new Error('Load failed'));
          };

          audio.addEventListener('loadedmetadata', onLoad, { once: true });
          audio.addEventListener('error', onError, { once: true });
        });

        const formatted = `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`;
        DurationCache.set(track.id, formatted);
        
        return { id: track.id, duration: formatted };
      } catch (error) {
        console.warn(`Failed to load duration for ${track.id}`);
        return { id: track.id, duration: '--:--' };
      }
    });

    try {
      const results = await Promise.allSettled(promises);
      const newDurations: Record<string, string> = {};

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          newDurations[result.value.id] = result.value.duration;
        } else {
          newDurations[tracks[index].id] = '--:--';
        }
      });

      setDurations(prev => ({ ...prev, ...newDurations }));
      console.log(`📦 Loaded ${Object.keys(newDurations).length} durations`);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [tracks]);

  return {
    durations,
    loading,
    loadAllDurations
  };
};
