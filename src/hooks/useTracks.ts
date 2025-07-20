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
  refreshInterval: 300000,
  retryOnError: true,
  maxRetries: 3
};

const FETCH_TIMEOUT = 15000;
const RETRY_DELAY = 1000;

// ================================================================================
// MAIN HOOK WITH CORRECTED ORDER
// ================================================================================

export const useTracks = (options: UseTracksOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  // ✅ ИСПРАВЛЕНО: Объявляем loadTracks ПЕРЕД использованием в useMemo
  const loadTracks = useCallback(async (): Promise<void> => {
    const attemptLoad = async (attempt: number = 1): Promise<void> => {
      try {
        setLoading(true);
        if (attempt === 1) {
          setError(null);
          setRetryCount(0);
        }
        
        console.log(`🔄 Loading tracks (attempt ${attempt}/${config.maxRetries! + 1})`);
        
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
          throw new Error(data.error || 'Failed to load tracks');
        }

        const processedTracks: Track[] = data.tracks
          .filter(trackData => {
            if (!trackData.id || !trackData.title || !trackData.url) {
              console.warn('⚠️ Skipping invalid track:', trackData);
              return false;
            }
            return true;
          })
          .map(trackData => {
            const track: Track = {
              id: trackData.id,
              title: trackData.title,
              artistId: trackData.artistId,
              albumName: trackData.albumName,
              file: trackData.url,
              duration: trackData.duration || '0:00',
              number: trackData.number,
              originalTitle: trackData.originalTitle,
              albumId: trackData.albumId,
              metadata: {
                pathname: trackData.pathname,
                fileName: trackData.fileName,
                size: trackData.size,
                uploadedAt: trackData.uploadedAt,
                number: trackData.number,
                originalTitle: trackData.originalTitle
              }
            };
            
            return track;
          });
        
        console.log(`✅ Loaded ${processedTracks.length} tracks`);
        if (data.debug) {
          console.log(`📊 Debug:`, data.debug);
        }
        
        setTracks(processedTracks);
        setError(null);
        setRetryCount(0);
        setLastFetchTime(Date.now());
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Load failed (attempt ${attempt}):`, errorMessage);
        
        if (err instanceof Error && err.name === 'AbortError') {
          console.warn('⏱️ Request timeout');
        }
        
        if (config.retryOnError && attempt <= config.maxRetries!) {
          const delay = RETRY_DELAY * attempt;
          console.log(`🔄 Retrying in ${delay}ms...`);
          
          setRetryCount(attempt);
          
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(attemptLoad(attempt + 1));
            }, delay);
          });
        } else {
          setError(errorMessage);
          setTracks([]);
        }
      } finally {
        setLoading(false);
      }
    };

    return attemptLoad();
  }, [config.retryOnError, config.maxRetries]);

  // ✅ ИСПРАВЛЕНО: Теперь useMemo может безопасно использовать loadTracks
  const returnValue = useMemo<UseTracksReturn>(() => ({
    tracks,
    loading,
    error,
    refetch: loadTracks, // ✅ Функция уже объявлена выше
    totalTracks: tracks.length,
    hasError: Boolean(error),
    isReady: !loading && tracks.length > 0 && !error
  }), [tracks, loading, error, loadTracks]);

  // ================================================================================
  // AUTO-REFRESH
  // ================================================================================

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (config.enableAutoRefresh && config.refreshInterval && !loading && !error) {
      console.log(`🔄 Auto-refresh enabled (${config.refreshInterval / 1000}s)`);
      
      intervalId = setInterval(() => {
        console.log('🔄 Auto-refreshing...');
        loadTracks();
      }, config.refreshInterval);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [config.enableAutoRefresh, config.refreshInterval, loading, error, loadTracks]);

  // ================================================================================
  // INITIAL LOAD
  // ================================================================================

  useEffect(() => {
    loadTracks();
  }, []); // ✅ Пустые зависимости - загружаем только при монтировании

  return returnValue;
};

// ================================================================================
// SPECIALIZED HOOKS
// ================================================================================

export const useTracksWithAutoRefresh = (refreshInterval: number = 300000) => {
  return useTracks({
    enableAutoRefresh: true,
    refreshInterval,
    retryOnError: true,
    maxRetries: 2
  });
};

export const useTracksNoRetry = () => {
  return useTracks({
    retryOnError: false,
    maxRetries: 0
  });
};

export const useTracksRobust = () => {
  return useTracks({
    retryOnError: true,
    maxRetries: 5
  });
};

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

export const filterTracksByArtist = (tracks: Track[], artistId: string): Track[] => {
  return tracks.filter(track => 
    track.artistId?.toLowerCase() === artistId.toLowerCase()
  );
};

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

export const sortTracksByNumber = (tracks: Track[]): Track[] => {
  return [...tracks].sort((a, b) => {
    const aNumber = a.number || 0;
    const bNumber = b.number || 0;
    return aNumber - bNumber;
  });
};
