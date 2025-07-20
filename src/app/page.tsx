// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ArtistGrid from '@/components/ArtistGrid';
import PlayButton from '@/components/PlayButton';
import { PlaylistData, Artist, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';
import { useTracks } from '@/hooks/useTracks';
import { useMusicPlayer } from '@/lib/music-player';

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

interface HomePageStats {
  totalArtists: number;
  totalReleases: number;
  totalTracks: number;
  loadingTime: number;
}

interface ErrorState {
  playlistError: string | null;
  tracksError: string | null;
  hasAnyError: boolean;
}

// ================================================================================
// MAIN COMPONENT WITH ENHANCED OPTIMIZATION
// ================================================================================

export default function HomePage() {
  const [playlistData, setPlaylistData] = useState<PlaylistData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadStartTime] = useState(() => Date.now());

  // Hooks
  const { tracks, loading: tracksLoading, error: tracksError, refetch: refetchTracks } = useTracks();
  const { setQueue, playTrack, shuffleAndPlay } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED VALUES
  // ================================================================================

  const errorState = useMemo<ErrorState>(() => ({
    playlistError: error,
    tracksError: tracksError,
    hasAnyError: Boolean(error || tracksError)
  }), [error, tracksError]);

  const artists = useMemo(() => {
    return Object.keys(ARTIST_DATA)
      .map(artistId => playlistData[artistId])
      .filter((artist): artist is Artist => Boolean(artist));
  }, [playlistData]);

  const stats = useMemo<HomePageStats>(() => {
    const totalReleases = artists.reduce((sum, artist) => 
      sum + artist.Albums.length + artist.EPs.length + artist.Demos.length, 0
    );
    
    return {
      totalArtists: artists.length,
      totalReleases,
      totalTracks: tracks.length,
      loadingTime: loading ? 0 : Date.now() - loadStartTime
    };
  }, [artists, tracks.length, loading, loadStartTime]);

  const isLoading = useMemo(() => loading || tracksLoading, [loading, tracksLoading]);

  // ================================================================================
  // ENHANCED DATA FETCHING
  // ================================================================================

  const fetchPlaylistData = useCallback(async () => {
    try {
      setError(null);
      console.log('🔍 Fetching playlist data from /api/playlist...');
      
      const response = await fetch('/api/playlist', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // Добавляем таймаут
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Playlist data received:', Object.keys(data).length, 'artists');
        
        // Создаем структуру данных с информацией из ARTIST_DATA
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
        console.log('📊 Processed playlist data for', Object.keys(filteredData).length, 'artists');
        
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error('❌ Error fetching playlist data:', fetchError);
      setError(errorMessage);
      
      // Создаем fallback структуру с пустыми релизами
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
      console.log('📝 Created fallback data structure');
    } finally {
      setLoading(false);
    }
  }, []);

  // ================================================================================
  // ENHANCED PLAYBACK HANDLERS
  // ================================================================================

  const handlePlayAllTracks = useCallback(() => {
    if (tracks.length === 0) {
      console.warn('🎵 No tracks available for playback');
      return;
    }
    
    console.log(`🎵 Playing all tracks (${tracks.length} tracks)`);
    shuffleAndPlay(tracks);
  }, [tracks, shuffleAndPlay]);

  const handlePlayFirstTrack = useCallback(() => {
    if (tracks.length === 0) return;
    
    console.log('🎵 Playing first track');
    setQueue(tracks);
    playTrack(tracks[0]);
  }, [tracks, setQueue, playTrack]);

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

  // ================================================================================
  // EFFECTS
  // ================================================================================

  useEffect(() => {
    fetchPlaylistData();
  }, [fetchPlaylistData]);

  // ================================================================================
  // LOADING STATE
  // ================================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">🎵</div>
          <div className="text-xl mb-2">Loading music universe...</div>
          <div className="text-sm text-gray-400">
            {loading && !tracksLoading && 'Loading playlist data...'}
            {!loading && tracksLoading && 'Loading tracks from Blob Storage...'}
            {loading && tracksLoading && 'Loading all music data...'}
          </div>
          <div className="mt-4">
            <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================================
  // ERROR STATE
  // ================================================================================

  if (errorState.hasAnyError && tracks.length === 0 && artists.length === 0) {
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

  // ================================================================================
  // SUCCESS STATE WITH PARTIAL ERRORS
  // ================================================================================

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Six worlds.
        </h1>
        <p className="text-2xl text-gray-300 mb-8">
          One universe
        </p>
        
        {/* Play Controls */}
        {tracks.length > 0 && (
          <div className="mb-8 space-y-4">
            <div className="flex justify-center gap-4">
              <PlayButton 
                tracks={tracks}
                variant="header"
                size="large"
                showText
              />
              
              <button
                onClick={handlePlayFirstTrack}
                className="bg-transparent border-2 border-accent-color text-accent-color hover:bg-accent-color hover:text-black px-6 py-3 rounded-full font-bold transition-all duration-150 hover:scale-105"
              >
                ▶️ Play First
              </button>
            </div>
            
            <div className="text-sm text-gray-400 space-y-1">
              <div>{stats.totalTracks} track{stats.totalTracks !== 1 ? 's' : ''} available</div>
              <div>{stats.totalArtists} artist{stats.totalArtists !== 1 ? 's' : ''} • {stats.totalReleases} release{stats.totalReleases !== 1 ? 's' : ''}</div>
            </div>
          </div>
        )}
        
        {tracks.length === 0 && !errorState.hasAnyError && (
          <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <div className="text-yellow-400 mb-2">⚠️ No tracks loaded</div>
            <div className="text-sm text-gray-400">Music data is being processed or unavailable</div>
          </div>
        )}
      </div>

      {/* Error Notifications */}
      {errorState.hasAnyError && (tracks.length > 0 || artists.length > 0) && (
        <div className="mb-8 p-4 bg-orange-900/20 border border-orange-600/30 rounded-lg">
          <div className="text-orange-400 mb-2 font-bold">⚠️ Partial Loading Issues</div>
          <div className="text-sm text-gray-300 space-y-1">
            {errorState.playlistError && (
              <div>• Playlist API error: {errorState.playlistError}</div>
            )}
            {errorState.tracksError && (
              <div>• Blob Storage error: {errorState.tracksError}</div>
            )}
            <div className="mt-2">
              <button
                onClick={handleRefreshData}
                className="text-accent-color hover:text-green-400 underline"
              >
                🔄 Try reloading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Artists Grid */}
      {artists.length > 0 ? (
        <ArtistGrid artists={artists} />
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-50">🎤</div>
          <div className="text-gray-400 text-lg mb-2">No artists available</div>
          <div className="text-sm text-gray-500">
            {errorState.hasAnyError 
              ? 'Unable to load artist data due to connection issues'
              : 'Artist data is being processed'
            }
          </div>
        </div>
      )}
      
      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 p-4 bg-gray-800 rounded-lg text-sm font-mono">
          <div className="font-bold mb-3 text-accent-color">🔧 Debug Information</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 mb-2">Data Status:</div>
              <div>Artists loaded: {stats.totalArtists}</div>
              <div>Releases loaded: {stats.totalReleases}</div>
              <div>Tracks loaded: {stats.totalTracks}</div>
              <div>Loading time: {stats.loadingTime}ms</div>
            </div>
            <div>
              <div className="text-gray-400 mb-2">API Status:</div>
              <div>Playlist API: {errorState.playlistError ? '❌' : '✅'}</div>
              <div>Blob Storage: {errorState.tracksError ? '❌' : '✅'}</div>
              <div>Artists data: {artists.length > 0 ? '✅' : '❌'}</div>
              <div>Tracks data: {tracks.length > 0 ? '✅' : '❌'}</div>
            </div>
          </div>
          
          {errorState.hasAnyError && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded">
              <div className="text-red-400 text-xs">Error Details:</div>
              {errorState.playlistError && (
                <div className="text-red-300 text-xs mt-1">Playlist: {errorState.playlistError}</div>
              )}
              {errorState.tracksError && (
                <div className="text-red-300 text-xs mt-1">Tracks: {errorState.tracksError}</div>
              )}
            </div>
          )}
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRefreshData}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
            >
              🔄 Refresh All
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs"
            >
              🔄 Hard Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
