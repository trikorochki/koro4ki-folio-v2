// src/app/artist/[id]/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Artist, Album, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';
import TrackList from '@/components/TrackList';
import AlbumCarousel from '@/components/AlbumCarousel';
import PlayButton from '@/components/PlayButton';
import { useMusicPlayer } from '@/lib/music-player';
import { useTracks } from '@/hooks/useTracks'; // ✅ ДОБАВЛЕНО

// Функция для определения кириллицы
function detectCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export default function ArtistPage() {
  const params = useParams();
  const artistId = params.id as string;
  
  const [artist, setArtist] = useState<Artist | null>(null);
  const [activeTab, setActiveTab] = useState<'Albums' | 'EPs' | 'Demos'>('Albums');
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showDiscography, setShowDiscography] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ ДОБАВЛЕНО: Используем новую систему загрузки треков
  const { tracks: allBlobTracks, loading: tracksLoading } = useTracks();
  const { setQueue, playTrack, shuffleAndPlay } = useMusicPlayer();

  // ✅ ДОБАВЛЕНО: Фильтруем треки для текущего артиста
  const artistTracks = useMemo(() => {
    return allBlobTracks.filter(track => track.artistId === artistId);
  }, [allBlobTracks, artistId]);

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Проверяем, что артист существует в ARTIST_DATA
        if (!ARTIST_DATA[artistId as keyof typeof ARTIST_DATA]) {
          setError(`Artist "${artistId}" not found`);
          return;
        }

        const response = await fetch('/api/playlist');
        
        if (response.ok) {
          const data = await response.json();
          const artistData = data[artistId];
          
          if (artistData) {
            setArtist(artistData);
          } else {
            // ✅ ИСПРАВЛЕНО: Создаем базовую структуру артиста
            const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
            setArtist({
              id: artistId,
              name: artistInfo.name,
              avatar: artistInfo.avatar,
              descriptionLine1: artistInfo.descriptionLine1,
              descriptionLine2: artistInfo.descriptionLine2,
              socialLinks: artistInfo.socialLinks,
              Albums: [],
              EPs: [],
              Demos: [],
            });
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError(error instanceof Error ? error.message : 'Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (artistId) {
      fetchArtistData();
    }
  }, [artistId]);

  // ✅ ДОБАВЛЕНО: Обработчики для воспроизведения треков
  const handlePlayAllTracks = () => {
    if (artistTracks.length > 0) {
      setQueue(artistTracks);
      playTrack(artistTracks[0]);
    }
  };

  const handleShuffleAllTracks = () => {
    if (artistTracks.length > 0) {
      shuffleAndPlay(artistTracks);
    }
  };

  // Состояние загрузки
  if (loading || tracksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">🎵</div>
          <div>Loading artist...</div>
        </div>
      </div>
    );
  }

  // Состояние ошибки
  if (error || !artist) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">
            {error || 'Artist not found'}
          </div>
          <Link 
            href="/" 
            className="text-blue-500 hover:text-blue-300 underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Безопасное получение данных с fallback
  const currentAlbums = (artist[activeTab] as Album[]) || [];
  
  // ✅ ИЗМЕНЕНО: Используем треки из Blob Storage вместо playlist API
  const allTracks = artistTracks;
  const tracksToShow = showAllTracks ? allTracks : allTracks.slice(0, 10);
  const totalReleases = (artist.Albums?.length || 0) + (artist.EPs?.length || 0) + (artist.Demos?.length || 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Заголовок артиста */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="text-blue-500 hover:text-blue-300 mb-4 inline-block"
        >
          ← Back to Artists
        </Link>
        
        <div className="flex items-center gap-6 mb-6">
          {artist.avatar && (
            <Image
              src={artist.avatar}
              alt={artist.name}
              width={120}
              height={120}
              className="rounded-full"
            />
          )}
          <div>
            <h1 className="text-4xl font-bold mb-2">{artist.name}</h1>
            {artist.descriptionLine1 && (
              <p className="text-lg text-gray-300">{artist.descriptionLine1}</p>
            )}
            {artist.descriptionLine2 && (
              <p className="text-gray-400">{artist.descriptionLine2}</p>
            )}
          </div>
        </div>

        {/* ✅ ДОБАВЛЕНО: Кнопки воспроизведения */}
        {allTracks.length > 0 && (
          <div className="flex gap-4 mb-6">
            <PlayButton 
              tracks={allTracks}
              variant="header"
              size="medium"
              showText
            />
            <button
              onClick={handleShuffleAllTracks}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-full font-medium transition-colors"
            >
              Shuffle Play
            </button>
          </div>
        )}
      </div>

      {/* ✅ ОБНОВЛЕНО: Секция All Tracks с треками из Blob Storage */}
      {allTracks.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-4">All Tracks</h2>
          <TrackList 
            tracks={tracksToShow}
          />
          
          {allTracks.length > 10 && (
            <button
              onClick={() => setShowAllTracks(!showAllTracks)}
              className="mt-4 text-blue-500 hover:text-blue-300 font-medium"
            >
              {showAllTracks
                ? 'Show Less'
                : `Show All ${allTracks.length} Tracks`}
            </button>
          )}
        </div>
      )}

      {/* Секция Discography */}
      {totalReleases > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Discography</h2>
            <button
              onClick={() => setShowDiscography(!showDiscography)}
              className="text-blue-500 hover:text-blue-300 font-medium"
            >
              {showDiscography ? 'Hide' : 'Show'} Discography
            </button>
          </div>

          {showDiscography && (
            <>
              {/* Tabs */}
              <div className="flex gap-4 mb-6">
                {(['Albums', 'EPs', 'Demos'] as const).map((tab) => {
                  const count = artist[tab]?.length || 0;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      disabled={count === 0}
                      className={`px-4 py-2 rounded-full font-medium transition-colors ${
                        activeTab === tab
                          ? 'bg-blue-600 text-white'
                          : count === 0
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      {tab} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              {currentAlbums.length > 0 ? (
                <AlbumCarousel albums={currentAlbums} />
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No {activeTab.toLowerCase()} available
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Секция Other Artists */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Other Artists</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.values(ARTIST_DATA)
            .filter(otherArtist => otherArtist.id !== artistId)
            .map((otherArtist) => (
              <Link
                key={otherArtist.id}
                href={`/artist/${otherArtist.id}`}
                className="text-center hover:scale-105 transition-transform"
              >
                {otherArtist.avatar && (
                  <Image
                    src={otherArtist.avatar}
                    alt={otherArtist.name}
                    width={80}
                    height={80}
                    className="rounded-full mx-auto mb-2"
                  />
                )}
                <div className="text-sm font-medium">{otherArtist.name}</div>
              </Link>
            ))}
        </div>
      </div>

      {/* ✅ ДОБАВЛЕНО: Debug информация */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 p-4 bg-gray-800 rounded-lg text-sm">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>Artist: {artist.name}</div>
          <div>Tracks from Blob Storage: {artistTracks.length}</div>
          <div>Albums: {artist.Albums?.length || 0}</div>
          <div>EPs: {artist.EPs?.length || 0}</div>
          <div>Demos: {artist.Demos?.length || 0}</div>
        </div>
      )}
    </div>
  );
}
