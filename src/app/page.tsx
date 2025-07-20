// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ArtistGrid from '@/components/ArtistGrid';
import PlayButton from '@/components/PlayButton';
import { PlaylistData, Artist, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';
import { useTracks } from '@/hooks/useTracks';
import { useMusicPlayer } from '@/lib/music-player';

export default function HomePage() {
  const [playlistData, setPlaylistData] = useState<PlaylistData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ ДОБАВЛЕНО: Используем новый хук для загрузки треков
  const { tracks, loading: tracksLoading, error: tracksError } = useTracks();
  const { setQueue } = useMusicPlayer();

  useEffect(() => {
    const fetchPlaylistData = async () => {
      try {
        setError(null);
        
        // Пробуем загрузить данные из API
        const response = await fetch('/api/playlist');
        
        if (response.ok) {
          const data = await response.json();
          const filteredData: PlaylistData = {};
          
          // Обрабатываем каждого артиста из ARTIST_DATA
          Object.keys(ARTIST_DATA).forEach(artistId => {
            const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
            
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
          });
          
          setPlaylistData(filteredData);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        console.error('Error fetching playlist data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        
        // Fallback: создаем пустую структуру данных
        const fallbackData: PlaylistData = {};
        Object.keys(ARTIST_DATA).forEach(artistId => {
          const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
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
        });
        setPlaylistData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylistData();
  }, []);

  // ✅ ДОБАВЛЕНО: Обработчики для воспроизведения всех треков
  const handlePlayAllTracks = () => {
    if (tracks.length > 0) {
      setQueue(tracks);
    }
  };

  // Состояние загрузки
  if (loading || tracksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">🎵</div>
          <div>Loading music...</div>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (error && tracksError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-500">
          <div className="mb-4">❌ Error loading data</div>
          <div className="text-sm">{error || tracksError}</div>
        </div>
      </div>
    );
  }

  const artists = Object.keys(ARTIST_DATA)
    .map(artistId => playlistData[artistId])
    .filter(Boolean) as Artist[];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Six worlds.
        </h1>
        <p className="text-2xl text-gray-300 mb-8">
          One universe
        </p>
        
        {/* ✅ ДОБАВЛЕНО: Кнопка воспроизведения всех треков */}
        {tracks.length > 0 && (
          <div className="mb-8">
            <PlayButton 
              tracks={tracks}
              variant="header"
              size="large"
              showText
            />
            <p className="text-sm text-gray-400 mt-2">
              {tracks.length} tracks available
            </p>
          </div>
        )}
      </div>

      {/* Artists Grid */}
      {artists.length > 0 ? (
        <ArtistGrid artists={artists} />
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400">No artists available</div>
        </div>
      )}
      
      {/* ✅ ДОБАВЛЕНО: Debug информация в development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 p-4 bg-gray-800 rounded-lg text-sm">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>Artists loaded: {artists.length}</div>
          <div>Tracks loaded: {tracks.length}</div>
          <div>Playlist API: {error ? '❌' : '✅'}</div>
          <div>Blob Storage: {tracksError ? '❌' : '✅'}</div>
        </div>
      )}
    </div>
  );
}
