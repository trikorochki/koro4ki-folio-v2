// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ArtistGrid from '@/components/ArtistGrid';
import { PlaylistData, Artist } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';
import { useTracks } from '@/hooks/useTracks';

export default function HomePage() {
  const [playlistData, setPlaylistData] = useState<PlaylistData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { tracks, loading: tracksLoading, error: tracksError } = useTracks();

  const errorState = useMemo(() => ({
    playlistError: error,
    tracksError: tracksError,
    hasAnyError: Boolean(error || tracksError)
  }), [error, tracksError]);

  const artists = useMemo(() => {
    return Object.keys(ARTIST_DATA)
      .map(artistId => playlistData[artistId])
      .filter((artist): artist is Artist => Boolean(artist && artist.id && artist.name));
  }, [playlistData]);

  const isLoading = useMemo(() => loading || tracksLoading, [loading, tracksLoading]);

  const fetchPlaylistData = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/playlist', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        const filteredData: PlaylistData = {};
        Object.keys(ARTIST_DATA).forEach(artistId => {
          const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
          if (artistInfo) {
            filteredData[artistId] = {
              id: artistId,
              name: artistInfo.name,
              avatar: artistInfo.avatar,
              descriptionLine1: artistInfo.descriptionLine1,
              descriptionLine2: artistInfo.descriptionLine2,
              socialLinks: artistInfo.socialLinks,
              Albums: data[artistId]?.Albums || [],
              EPs: data[artistId]?.EPs || [],
              Demos: data[artistId]?.Demos || [],
            };
          }
        });
        
        setPlaylistData(filteredData);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error('❌ Error fetching playlist data:', fetchError);
      setError(errorMessage);
      
      // Fallback data
      const fallbackData: PlaylistData = {};
      Object.keys(ARTIST_DATA).forEach(artistId => {
        const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
        if (artistInfo) {
          fallbackData[artistId] = {
            id: artistId,
            name: artistInfo.name,
            avatar: artistInfo.avatar,
            descriptionLine1: artistInfo.descriptionLine1,
            descriptionLine2: artistInfo.descriptionLine2,
            socialLinks: artistInfo.socialLinks,
            Albums: [],
            EPs: [],
            Demos: [],
          };
        }
      });
      setPlaylistData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylistData();
  }, [fetchPlaylistData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">🎵</div>
          <div className="text-xl mb-2">Loading music universe...</div>
        </div>
      </div>
    );
  }

  if (errorState.hasAnyError && artists.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl text-red-400 mb-4">Unable to load music data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ✅ ИСПРАВЛЕНО: Простой заголовок белым цветом с Tektur шрифтом */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 text-white font-heading">
          Six worlds.
        </h1>
        <p className="text-2xl text-white font-heading">
          One universe
        </p>
        {/* ❌ УБРАНО: Лишняя кнопка Play Random и счетчики */}
      </div>

      {/* ✅ Простая сетка артистов */}
      {artists.length > 0 ? (
        <ArtistGrid artists={artists} />
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-50">🎤</div>
          <div className="text-gray-400 text-lg mb-2">No artists available</div>
        </div>
      )}
    </div>
  );
}
