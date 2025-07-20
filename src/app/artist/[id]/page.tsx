// src/app/artist/[id]/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Artist, Album, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';
import TrackList from '@/components/TrackList';
import AlbumCarousel from '@/components/AlbumCarousel';
import PlayButton from '@/components/PlayButton';
import { useMusicPlayer } from '@/lib/music-player';
import { useTracks } from '@/hooks/useTracks';

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

interface ArtistPageStats {
  totalTracks: number;
  totalReleases: number;
  albumCount: number;
  epCount: number;
  demoCount: number;
  loadingTime: number;
}

interface ErrorState {
  playlistError: string | null;
  tracksError: string | null;
  hasError: boolean;
}

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

function detectCyrillic(text?: string): boolean {
  if (!text) return false;
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Безопасная фильтрация треков артиста из Blob Storage
 */
function filterArtistTracks(allTracks: Track[], artistId: string): Track[] {
  return allTracks.filter(track => {
    if (!track || !track.artistId) return false;
    return track.artistId.toLowerCase() === artistId.toLowerCase();
  });
}

/**
 * Создание fallback структуры артиста
 */
function createFallbackArtist(artistId: string): Artist | null {
  const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
  
  if (!artistInfo) return null;
  
  return {
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

// ================================================================================
// MAIN COMPONENT WITH ENHANCED OPTIMIZATION
// ================================================================================

export default function ArtistPage() {
  const params = useParams();
  const artistId = params.id as string;
  
  const [artist, setArtist] = useState<Artist | null>(null);
  const [activeTab, setActiveTab] = useState<'Albums' | 'EPs' | 'Demos'>('Albums');
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showDiscography, setShowDiscography] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadStartTime] = useState(() => Date.now());

  // Hooks
  const { tracks: allBlobTracks, loading: tracksLoading, error: tracksError, refetch: refetchTracks } = useTracks();
  const { setQueue, playTrack, shuffleAndPlay } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED VALUES
  // ================================================================================

  const artistTracks = useMemo(() => {
    return filterArtistTracks(allBlobTracks, artistId);
  }, [allBlobTracks, artistId]);

  const errorState = useMemo<ErrorState>(() => ({
    playlistError: error,
    tracksError: tracksError,
    hasError: Boolean(error || tracksError)
  }), [error, tracksError]);

  const stats = useMemo<ArtistPageStats>(() => {
    const albumCount = artist?.Albums?.length || 0;
    const epCount = artist?.EPs?.length || 0;
    const demoCount = artist?.Demos?.length || 0;
    
    return {
      totalTracks: artistTracks.length,
      totalReleases: albumCount + epCount + demoCount,
      albumCount,
      epCount,
      demoCount,
      loadingTime: loading ? 0 : Date.now() - loadStartTime
    };
  }, [artist, artistTracks.length, loading, loadStartTime]);

  const currentAlbums = useMemo(() => {
    return (artist?.[activeTab] as Album[]) || [];
  }, [artist, activeTab]);

  const tracksToShow = useMemo(() => {
    return showAllTracks ? artistTracks : artistTracks.slice(0, 10);
  }, [artistTracks, showAllTracks]);

  const isLoading = useMemo(() => loading || tracksLoading, [loading, tracksLoading]);

  // ================================================================================
  // ENHANCED DATA FETCHING
  // ================================================================================

  const fetchArtistData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Проверяем существование артиста в ARTIST_DATA
      if (!ARTIST_DATA[artistId as keyof typeof ARTIST_DATA]) {
        setError(`Artist "${artistId}" not found in database`);
        return;
      }

      console.log(`🎤 Fetching data for artist: ${artistId}`);

      // Пытаемся загрузить данные из API плейлистов
      try {
        const response = await fetch('/api/playlist', {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10000) // 10 секунд таймаут
        });
        
        if (response.ok) {
          const data = await response.json();
          const artistData = data[artistId];
          
          if (artistData) {
            console.log(`✅ Artist data loaded from API: ${artistData.name}`);
            setArtist(artistData);
          } else {
            console.log(`⚠️ Artist not found in API, creating fallback structure`);
            const fallbackArtist = createFallbackArtist(artistId);
            setArtist(fallbackArtist);
          }
        } else {
          throw new Error(`Playlist API error: ${response.status} ${response.statusText}`);
        }
      } catch (apiError) {
        console.warn('⚠️ Playlist API failed, using fallback data:', apiError);
        const fallbackArtist = createFallbackArtist(artistId);
        
        if (fallbackArtist) {
          setArtist(fallbackArtist);
          setError('Using limited artist data - playlist API unavailable');
        } else {
          throw new Error('Artist not found and fallback failed');
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching artist data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  // ================================================================================
  // ENHANCED PLAYBACK HANDLERS
  // ================================================================================

  const handlePlayAllTracks = useCallback(() => {
    if (artistTracks.length === 0) {
      console.warn('🎵 No tracks available for artist:', artistId);
      return;
    }
    
    console.log(`🎵 Playing all tracks for ${artist?.name} (${artistTracks.length} tracks)`);
    setQueue(artistTracks);
    playTrack(artistTracks[0]);
  }, [artistTracks, artistId, artist?.name, setQueue, playTrack]);

  const handleShuffleAllTracks = useCallback(() => {
    if (artistTracks.length === 0) {
      console.warn('🔀 No tracks available for shuffle:', artistId);
      return;
    }
    
    console.log(`🔀 Shuffle playing ${artistTracks.length} tracks for ${artist?.name}`);
    shuffleAndPlay(artistTracks);
  }, [artistTracks, artistId, artist?.name, shuffleAndPlay]);

  const handleToggleAllTracks = useCallback(() => {
    setShowAllTracks(prev => !prev);
  }, []);

  const handleToggleDiscography = useCallback(() => {
    setShowDiscography(prev => !prev);
  }, []);

  const handleTabChange = useCallback((tab: 'Albums' | 'EPs' | 'Demos') => {
    setActiveTab(tab);
  }, []);

  const handleRefreshData = useCallback(async () => {
    console.log('🔄 Refreshing artist data...');
    await Promise.all([
      fetchArtistData(),
      refetchTracks()
    ]);
  }, [fetchArtistData, refetchTracks]);

  // ================================================================================
  // EFFECTS
  // ================================================================================

  useEffect(() => {
    if (artistId) {
      fetchArtistData();
    }
  }, [artistId, fetchArtistData]);

  // Auto-select first available tab with content
  useEffect(() => {
    if (artist && !isLoading) {
      const tabsWithContent = (['Albums', 'EPs', 'Demos'] as const).filter(tab => 
        (artist[tab]?.length || 0) > 0
      );
      
      if (tabsWithContent.length > 0 && !(artist[activeTab]?.length || 0)) {
        setActiveTab(tabsWithContent[0]);
      }
    }
  }, [artist, activeTab, isLoading]);

  // ================================================================================
  // LOADING STATE
  // ================================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">🎤</div>
          <div className="text-xl mb-2">Loading artist...</div>
          <div className="text-sm text-gray-400">
            {loading && !tracksLoading && 'Loading artist data...'}
            {!loading && tracksLoading && 'Loading tracks from Blob Storage...'}
            {loading && tracksLoading && 'Loading artist and tracks...'}
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

  if ((error && !artist) || (!artist && !tracksError)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl text-red-400 mb-4">
            {error || 'Artist not found'}
          </div>
          
          <div className="text-sm text-gray-400 mb-6">
            Artist ID: <code className="bg-gray-800 px-2 py-1 rounded">{artistId}</code>
          </div>
          
          <div className="space-y-3">
            <Link 
              href="/" 
              className="block bg-accent-color hover:bg-accent-color/90 text-black px-6 py-3 rounded-full font-bold transition-all duration-150 hover:scale-105"
            >
              ← Back to Home
            </Link>
            
            <button
              onClick={handleRefreshData}
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-full font-medium transition-colors"
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================================================================================
  // SUCCESS STATE WITH ENHANCED LAYOUT
  // ================================================================================

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-accent-color hover:text-green-400 mb-6 font-medium transition-colors"
        >
          ← Back to Artists
        </Link>
        
        {/* Artist Profile */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-8">
          <div className="flex-shrink-0">
            {artist?.avatar ? (
              <Image
                src={artist.avatar}
                alt={`${artist.name} avatar`}
                width={120}
                height={120}
                className="rounded-full shadow-lg"
                priority
              />
            ) : (
              <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <div className="text-white text-4xl font-bold">
                  {artist?.name?.charAt(0).toUpperCase() || '?'}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className={`text-4xl lg:text-5xl font-bold mb-3 ${
              detectCyrillic(artist?.name) ? 'font-cyrillic' : 'font-heading'
            }`}>
              {artist?.name || 'Unknown Artist'}
            </h1>
            
            {artist?.descriptionLine1 && (
              <p className={`text-lg text-gray-300 mb-2 ${
                detectCyrillic(artist.descriptionLine1) ? 'font-cyrillic' : 'font-body'
              }`}>
                {artist.descriptionLine1}
              </p>
            )}
            
            {artist?.descriptionLine2 && (
              <p className={`text-gray-400 ${
                detectCyrillic(artist.descriptionLine2) ? 'font-cyrillic' : 'font-body'
              }`}>
                {artist.descriptionLine2}
              </p>
            )}

            {/* Artist Stats */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400">
              <span>{stats.totalTracks} track{stats.totalTracks !== 1 ? 's' : ''}</span>
              {stats.totalReleases > 0 && (
                <span>• {stats.totalReleases} release{stats.totalReleases !== 1 ? 's' : ''}</span>
              )}
              {stats.albumCount > 0 && <span>• {stats.albumCount} album{stats.albumCount !== 1 ? 's' : ''}</span>}
              {stats.epCount > 0 && <span>• {stats.epCount} EP{stats.epCount !== 1 ? 's' : ''}</span>}
              {stats.demoCount > 0 && <span>• {stats.demoCount} demo{stats.demoCount !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>

        {/* Error Notifications */}
        {errorState.hasError && artistTracks.length > 0 && (
          <div className="mb-6 p-4 bg-orange-900/20 border border-orange-600/30 rounded-lg">
            <div className="text-orange-400 mb-2 font-bold">⚠️ Partial Loading Issues</div>
            <div className="text-sm text-gray-300 space-y-1">
              {errorState.playlistError && (
                <div>• Playlist data: {errorState.playlistError}</div>
              )}
              {errorState.tracksError && (
                <div>• Track data: {errorState.tracksError}</div>
              )}
              <button
                onClick={handleRefreshData}
                className="text-accent-color hover:text-green-400 underline mt-2"
              >
                🔄 Refresh data
              </button>
            </div>
          </div>
        )}

        {/* Playback Controls */}
        {artistTracks.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-6">
            <PlayButton 
              tracks={artistTracks}
              variant="header"
              size="medium"
              showText
            />
            
            <button
              onClick={handleShuffleAllTracks}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-full font-medium transition-colors"
            >
              🔀 Shuffle Play
            </button>
            
            <button
              onClick={handlePlayAllTracks}
              className="flex items-center gap-2 px-6 py-3 bg-transparent border-2 border-accent-color text-accent-color hover:bg-accent-color hover:text-black rounded-full font-medium transition-all duration-150"
            >
              ▶️ Play All
            </button>
          </div>
        )}

        {artistTracks.length === 0 && !errorState.hasError && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <div className="text-yellow-400 mb-2">⚠️ No tracks available</div>
            <div className="text-sm text-gray-400">
              No tracks found for this artist in Blob Storage
            </div>
          </div>
        )}
      </div>

      {/* All Tracks Section */}
      {artistTracks.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">All Tracks</h2>
            <div className="text-sm text-gray-400">
              {artistTracks.length} track{artistTracks.length !== 1 ? 's' : ''} available
            </div>
          </div>
          
          <TrackList 
            tracks={tracksToShow}
            showArtist={false}
            showAlbumInfo={true}
          />
          
          {artistTracks.length > 10 && (
            <div className="mt-6 text-center">
              <button
                onClick={handleToggleAllTracks}
                className="text-accent-color hover:text-green-400 font-medium transition-colors"
              >
                {showAllTracks
                  ? 'Show Less Tracks'
                  : `Show All ${artistTracks.length} Tracks`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Discography Section */}
      {stats.totalReleases > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Discography</h2>
            <button
              onClick={handleToggleDiscography}
              className="text-accent-color hover:text-green-400 font-medium transition-colors"
            >
              {showDiscography ? 'Hide' : 'Show'} Discography
            </button>
          </div>

          {showDiscography && (
            <>
              {/* Release Type Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(['Albums', 'EPs', 'Demos'] as const).map((tab) => {
                  const count = artist?.[tab]?.length || 0;
                  return (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      disabled={count === 0}
                      className={`px-4 py-2 rounded-full font-medium transition-colors ${
                        activeTab === tab
                          ? 'bg-accent-color text-black'
                          : count === 0
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                      }`}
                      aria-pressed={activeTab === tab}
                    >
                      {tab} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Albums Display */}
              {currentAlbums.length > 0 ? (
                <AlbumCarousel 
                  albums={currentAlbums} 
                  layout="vertical"
                  showFullTrackList={false}
                  maxTracksPreview={5}
                />
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-3 opacity-50">💿</div>
                  <div>No {activeTab.toLowerCase()} available</div>
                  <div className="text-sm mt-1 opacity-70">
                    This artist doesn't have any {activeTab.toLowerCase()} yet
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Other Artists Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Discover More Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.keys(ARTIST_DATA)
            .filter(otherArtistId => otherArtistId !== artistId)
            .map((otherArtistId) => {
              // Явное приведение типа для решения проблемы TypeScript
              const otherArtist = (ARTIST_DATA as any)[otherArtistId];
              
              return (
                <Link
                  key={otherArtistId}
                  href={`/artist/${otherArtistId}`}
                  className="group text-center transition-all duration-200 hover:scale-105"
                >
                  <div className="mb-3">
                    {otherArtist?.avatar ? (
                      <Image
                        src={otherArtist.avatar}
                        alt={`${otherArtist.name} avatar`}
                        width={80}
                        height={80}
                        className="rounded-full mx-auto shadow-md group-hover:shadow-lg transition-shadow"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center mx-auto shadow-md group-hover:shadow-lg transition-shadow">
                        <div className="text-white text-xl font-bold">
                          {otherArtist?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium group-hover:text-accent-color transition-colors">
                    {otherArtist?.name || 'Unknown Artist'}
                  </div>
                </Link>
              );
            })}
        </div>
      </div>




      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 p-4 bg-gray-800 rounded-lg text-sm font-mono">
          <div className="font-bold mb-3 text-accent-color">🔧 Debug Information</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-gray-400 mb-2">Artist Data:</div>
              <div>Artist ID: {artistId}</div>
              <div>Artist Name: {artist?.name || 'N/A'}</div>
              <div>Has Avatar: {artist?.avatar ? '✅' : '❌'}</div>
              <div>Loading Time: {stats.loadingTime}ms</div>
            </div>
            <div>
              <div className="text-gray-400 mb-2">Content Stats:</div>
              <div>Blob Storage Tracks: {stats.totalTracks}</div>
              <div>Albums: {stats.albumCount}</div>
              <div>EPs: {stats.epCount}</div>
              <div>Demos: {stats.demoCount}</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-400 mb-1">Data Sources:</div>
              <div>Playlist API: {errorState.playlistError ? '❌' : '✅'}</div>
              <div>Blob Storage: {errorState.tracksError ? '❌' : '✅'}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">UI State:</div>
              <div>Active Tab: {activeTab}</div>
              <div>Show All Tracks: {showAllTracks ? '✅' : '❌'}</div>
              <div>Show Discography: {showDiscography ? '✅' : '❌'}</div>
            </div>
          </div>
          
          {errorState.hasError && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded">
              <div className="text-red-400 text-xs mb-1">Errors:</div>
              {errorState.playlistError && (
                <div className="text-red-300 text-xs">Playlist: {errorState.playlistError}</div>
              )}
              {errorState.tracksError && (
                <div className="text-red-300 text-xs">Tracks: {errorState.tracksError}</div>
              )}
            </div>
          )}
          
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRefreshData}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs"
            >
              🔄 Refresh Data
            </button>
            <button
              onClick={() => console.log('Artist Data:', artist, 'Tracks:', artistTracks)}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
            >
              📋 Log Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
