// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [loadStartTime] = useState(() => Date.now());

  // Hooks
  const { tracks, loading: tracksLoading, error: tracksError, refetch: refetchTracks } = useTracks();
  const { setQueue, playTrack, shuffleAndPlay } = useMusicPlayer();

  // ✅ ИСПРАВЛЕНО: Простые memoized значения без циклических зависимостей
  const errorState = useMemo(() => ({
    playlistError: error,
    tracksError: tracksError,
    hasAnyError: Boolean(error || tracksError)
  }), [error, tracksError]);

  const artists = useMemo(() => {
    if (!playlistData || typeof playlistData !== 'object') return [];
    
    return Object.keys(ARTIST_DATA)
      .map(artistId => playlistData[artistId])
      .filter((artist): artist is Artist => Boolean(artist && artist.id && artist.name));
  }, [playlistData]);

  const isLoading = useMemo(() => loading || tracksLoading, [loading, tracksLoading]);

  // ✅ ИСПРАВЛЕНО: Убираем сложные вычисления из useMemo
  const totalArtists = artists.length;
  const totalTracks = tracks.length;
  const loadingTime = loading ? 0 : Date.now() - loadStartTime;

  // ✅ ИСПРАВЛЕНО: Упрощаем fetchPlaylistData
  const fetchPlaylistData = useCallback(async () => {
    try {
      setError(null);
      console.log('🔍 Fetching playlist data...');
      
      const response = await fetch('/api/playlist', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Playlist data received');
        
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
  }, []); // ✅ Пустой массив зависимостей

  const handlePlayAllTracks = useCallback(() => {
    if (tracks.length === 0) {
      console.warn('🎵 No tracks available for playback');
      return;
    }
    
    console.log(`🎵 Playing all tracks (${tracks.length} tracks)`);
    shuffleAndPlay(tracks);
  }, [tracks, shuffleAndPlay]);

  const handleRefreshData = useCallback(async () => {
    console.log('🔄 Refreshing all data...');
    setLoading(true);
    
    try {
      await Promise.all([
        fetchPlaylistData(),
        refetchTracks()
      ]);
      console.log('✅ Data refresh completed');
    } catch (error) {
      console.error('❌ Error during data refresh:', error);
    }
  }, [fetchPlaylistData, refetchTracks]);

  useEffect(() => {
    fetchPlaylistData();
  }, [fetchPlaylistData]);

  // ✅ ИСПРАВЛЕНО: Упрощенные условия рендеринга
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">🎵</div>
          <div className="text-xl mb-2">Loading music universe...</div>
          <div className="text-sm text-gray-400">
            {loading && !tracksLoading && 'Loading playlist data...'}
            {!loading && tracksLoading && 'Loading tracks...'}
            {loading && tracksLoading && 'Loading all data...'}
          </div>
        </div>
      </div>
    );
  }

  if (errorState.hasAnyError && totalTracks === 0 && totalArtists === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl text-red-400 mb-4">Unable to load music data</div>
          
          <div className="text-sm text-gray-400 mb-6 space-y-1">
            {errorState.playlistError && (
              <div>Playlist API: {errorState.playlistError}</div>
            )}
            {errorState.tracksError && (
              <div>Blob Storage: {errorState.tracksError}</div>
            )}
          </div>
          
          <button
            onClick={handleRefreshData}
            className="bg-accent-color hover:bg-accent-color/90 text-black px-6 py-3 rounded-full font-bold transition-all duration-150 hover:scale-105"
          >
            🔄 Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Six worlds.
        </h1>
        <p className="text-2xl text-gray-300 mb-8">
          One universe
        </p>
        
        {totalTracks > 0 && (
          <div className="mb-8 space-y-4">
            <PlayButton 
              tracks={tracks}
              variant="header"
              size="large"
              showText
            />
            
            <div className="text-sm text-gray-400 space-y-1">
              <div>{totalTracks} track{totalTracks !== 1 ? 's' : ''} available</div>
              <div>{totalArtists} artist{totalArtists !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}
      </div>

      {totalArtists > 0 ? (
        <ArtistGrid artists={artists} />
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-50">🎤</div>
          <div className="text-gray-400 text-lg mb-2">No artists available</div>
        </div>
      )}
      
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 p-4 bg-gray-800 rounded-lg text-sm font-mono">
          <div className="font-bold mb-3 text-accent-color">🔧 Debug Information</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div>Artists loaded: {totalArtists}</div>
              <div>Tracks loaded: {totalTracks}</div>
              <div>Loading time: {loadingTime}ms</div>
            </div>
            <div>
              <div>Playlist API: {errorState.playlistError ? '❌' : '✅'}</div>
              <div>Blob Storage: {errorState.tracksError ? '❌' : '✅'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
