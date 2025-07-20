// src/hooks/useTracks.ts
'use client';

import { useState, useEffect } from 'react';
import { Track } from '@/types/music';

interface TrackResponse {
  success: boolean;
  total: number;
  tracks: Array<{
    id: string;
    pathname: string;
    url: string;
    artistId: string;
    albumName: string;
    fileName: string;
    title: string;
    size: number;
    uploadedAt: string;
  }>;
}

export const useTracks = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTracks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading tracks from Blob Storage...');
      
      const response = await fetch('/api/blob/list');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: TrackResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to load tracks from API');
      }
      
      // ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: используем прямые URL
      const processedTracks: Track[] = data.tracks.map((trackData, idx) => ({
        id: trackData.id,
        title: trackData.title,
        artistId: trackData.artistId,
        albumName: trackData.albumName,
        albumId: trackData.albumName || '', // Provide albumId, fallback to albumName or empty string
        file: trackData.url, // ✅ Прямой URL из Blob Storage
        duration: '0:00', // Будет обновлено асинхронно
        number: idx + 1, // Assign a track number based on index
        originalTitle: trackData.title, // Use title as originalTitle
        metadata: {
          pathname: trackData.pathname,
          fileName: trackData.fileName,
          size: trackData.size,
          uploadedAt: trackData.uploadedAt
        }
      }));
      
      console.log(`✅ Loaded ${processedTracks.length} tracks`);
      setTracks(processedTracks);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Failed to load tracks:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  return {
    tracks,
    loading,
    error,
    refetch: loadTracks
  };
};
