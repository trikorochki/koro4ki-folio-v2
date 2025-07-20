// src/hooks/useTracks.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Track } from '@/types/music';

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

interface BlobTrackData {
  id: string;
  pathname: string;
  url: string;
  artistId: string;
  albumName: string;
  fileName: string;
  title: string;
  size: number;
  uploadedAt: string;
  number?: number;
  originalTitle?: string;
  albumId?: string;
  duration?: string;
}

interface BlobResponse {
  success: boolean;
  total: number;
  tracks: BlobTrackData[];
  error?: string;
  debug?: {
    totalBlobs: number;
    audioFiles: number;
    validTracks: number;
    processingTime: number;
  };
}

interface UseTracksReturn {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalTracks: number;
  hasError: boolean;
  isReady: boolean;
}

interface UseTracksOptions {
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
  retryOnError?: boolean;
  maxRetries?: number;
}

// ================================================================================
// CONSTANTS
// ================================================================================

const DEFAULT_OPTIONS: UseTracksOptions = {
  enableAutoRefresh: false,
  refreshInterval: 300000, // 5 минут
  retryOnError: true,
  maxRetries: 3
};

const FETCH_TIMEOUT = 15000; // 15 секунд
const RETRY_DELAY = 1000; // 1 секунда

// ================================================================================
// MAIN HOOK WITH ENHANCED FUNCTIONALITY
// ================================================================================

export const useTracks = (options: UseTracksOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  // ================================================================================
  // MEMOIZED VALUES
  // ================================================================================

  const returnValue = useMemo<UseTracksReturn>(() => ({
    tracks,
    loading,
    error,
    refetch: loadTracks,
    totalTracks: tracks.length,
    hasError: Boolean(error),
    isReady: !loading && tracks.length > 0 && !error
  }), [tracks, loading, error, tracks.length]);

  // ================================================================================
  // ENHANCED TRACK LOADING WITH RETRY LOGIC
  // ================================================================================

  const loadTracks = useCallback(async (): Promise<void> => {
    const attemptLoad = async (attempt: number = 1): Promise<void> => {
      try {
        setLoading(true);
        if (attempt === 1) {
          setError(null);
          setRetryCount(0);
        }
        
        console.log(`🔄 Loading tracks from Blob Storage... (attempt ${attempt}/${config.maxRetries! + 1})`);
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        
        const response = await fetch('/api/blob/list', {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data: BlobResponse = await response.json();
        
        if (!data.success) {
          // ✅ ИСПРАВЛЕНО: Безопасная проверка error
          throw new Error(data.error || 'Failed to load tracks from API');
        }

        // Enhanced track processing with validation
        const processedTracks: Track[] = data.tracks
          .filter(trackData => {
            if (!trackData.id || !trackData.title || !trackData.url) {
              console.warn('⚠️ Skipping invalid track data:', trackData);
              return false;
            }
            return true;
          })
          .map(trackData => {
            // Enhanced track mapping with all required fields
            const track: Track = {
              id: trackData.id,
              title: trackData.title,
              artistId: trackData.artistId,
              albumName: trackData.albumName,
              file: trackData.url, // Прямой URL из Blob Storage
              // ✅ ИСПРАВЛЕНО: Безопасная проверка duration
              duration: trackData.duration || '0:00',
              // ✅ ИСПРАВЛЕНО: Безопасная проверка опциональных полей
              number: trackData.number || undefined,
              originalTitle: trackData.originalTitle || undefined,
              albumId: trackData.albumId || undefined,
              metadata: {
                pathname: trackData.pathname,
                fileName: trackData.fileName,
                size: trackData.size,
                uploadedAt: trackData.uploadedAt,
                // ✅ ИСПРАВЛЕНО: Безопасная проверка опциональных полей в metadata
                number: trackData.number || undefined,
                originalTitle: trackData.originalTitle || undefined
              }
            };
            
            return track;
          });
        
        console.log(`✅ Successfully loaded ${processedTracks.length} tracks`);
        // ✅ ИСПРАВЛЕНО: Безопасная проверка debug информации
        if (data.debug) {
          console.log(`📊 Debug info:`, data.debug);
        } else {
          console.log('📊 No debug info available');
        }
        
        setTracks(processedTracks);
        setError(null);
        setRetryCount(0);
        setLastFetchTime(Date.now());
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Failed to load tracks (attempt ${attempt}):`, errorMessage);
        
        // Handle different error types
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            console.warn('⏱️ Request timeout - server may be slow');
          } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
            console.warn('🌐 Network connectivity issue');
          }
        }
        
        // Retry logic
        if (config.retryOnError && attempt <= config.maxRetries!) {
          const delay = RETRY_DELAY * attempt; // Exponential backoff
          console.log(`🔄 Retrying in ${delay}ms... (${attempt}/${config.maxRetries})`);
          
          setRetryCount(attempt);
          
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(attemptLoad(attempt + 1));
            }, delay);
          });
        } else {
          // Final failure
          setError(errorMessage);
          setTracks([]); // Clear any existing tracks on error
        }
      } finally {
        setLoading(false);
      }
    };

    return attemptLoad();
  }, [config.retryOnError, config.maxRetries]);

  // ================================================================================
  // AUTO-REFRESH FUNCTIONALITY
  // ================================================================================

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (config.enableAutoRefresh && config.refreshInterval && !loading && !error) {
      console.log(`🔄 Auto-refresh enabled (every ${config.refreshInterval / 1000}s)`);
      
      intervalId = setInterval(() => {
        console.log('🔄 Auto-refreshing tracks...');
        loadTracks();
      }, config.refreshInterval);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('🛑 Auto-refresh disabled');
      }
    };
  }, [config.enableAutoRefresh, config.refreshInterval, loading, error, loadTracks]);

  // ================================================================================
  // INITIAL LOAD EFFECT
  // ================================================================================

  useEffect(() => {
    loadTracks();
  }, []); // Запускаем только один раз при монтировании

  // ================================================================================
  // RETURN ENHANCED INTERFACE
  // ================================================================================

  return returnValue;
};

// ================================================================================
// SPECIALIZED HOOKS FOR DIFFERENT USE CASES
// ================================================================================

/**
 * Hook для загрузки треков с auto-refresh для real-time приложений
 */
export const useTracksWithAutoRefresh = (refreshInterval: number = 300000) => {
  return useTracks({
    enableAutoRefresh: true,
    refreshInterval,
    retryOnError: true,
    maxRetries: 2
  });
};

/**
 * Hook для загрузки треков без retry (для случаев где нужна быстрая отдача)
 */
export const useTracksNoRetry = () => {
  return useTracks({
    retryOnError: false,
    maxRetries: 0
  });
};

/**
 * Hook для агрессивной загрузки треков с множественными попытками
 */
export const useTracksRobust = () => {
  return useTracks({
    retryOnError: true,
    maxRetries: 5
  });
};

// ================================================================================
// UTILITY FUNCTIONS FOR EXTERNAL USE
// ================================================================================

/**
 * Утилита для фильтрации треков по артисту
 */
export const filterTracksByArtist = (tracks: Track[], artistId: string): Track[] => {
  return tracks.filter(track => 
    track.artistId?.toLowerCase() === artistId.toLowerCase()
  );
};

/**
 * Утилита для группировки треков по альбомам
 */
export const groupTracksByAlbum = (tracks: Track[]): Record<string, Track[]> => {
  return tracks.reduce((acc, track) => {
    const albumKey = track.albumName || 'Unknown Album';
    if (!acc[albumKey]) {
      acc[albumKey] = [];
    }
    acc[albumKey].push(track);
    return acc;
  }, {} as Record<string, Track[]>);
};

/**
 * Утилита для сортировки треков по номеру
 */
export const sortTracksByNumber = (tracks: Track[]): Track[] => {
  return [...tracks].sort((a, b) => {
    const aNumber = a.number || 0;
    const bNumber = b.number || 0;
    return aNumber - bNumber;
  });
};
