// src/hooks/useTracks.ts
'use client';

import { useState, useEffect } from 'react';
import { Track, BlobResponse } from '@/types/music';

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
      
      const data: BlobResponse = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to load tracks from API');
      }
      
      const processedTracks: Track[] = data.tracks.map(trackData => ({
        id: trackData.id,
        title: trackData.title,
        artistId: trackData.artistId,
        albumName: trackData.albumName,
        file: trackData.url, // Прямой URL из Blob Storage
        duration: '0:00',
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
