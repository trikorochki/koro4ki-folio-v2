// src/app/artist/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Artist, Album } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';
import TrackList from '@/components/TrackList';
import AlbumCarousel from '@/components/AlbumCarousel';
import PlayButton from '@/components/PlayButton';
import { useMusicPlayer } from '@/lib/music-player';

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
  
  const { setQueue, playTrack, shuffleAndPlay, isPlaying, currentTrack } = useMusicPlayer();

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/playlist`);
        if (response.ok) {
          const data = await response.json();
          const artistData = data[artistId];
          
          if (artistData) {
            setArtist(artistData);
          } else {
            setError(`Artist "${artistId}" not found`);
          }
        } else {
          setError('Failed to fetch artist data');
        }
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (artistId) {
      fetchArtistData();
    }
  }, [artistId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-color mx-auto"></div>
          <div className="text-xl text-primary-text-color font-body">Loading artist...</div>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-50">🎵</div>
          <div className="text-xl text-primary-text-color font-body">
            {error || 'Artist not found'}
          </div>
          <Link 
            href="/" 
            className="inline-block bg-accent-color hover:bg-green-400 text-black px-6 py-3 rounded-full font-bold transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Безопасное получение данных с fallback
  const currentAlbums = (artist[activeTab] as Album[]) || [];
  const allTracks = [
    ...(artist.Albums || []),
    ...(artist.EPs || []),
    ...(artist.Demos || [])
  ].flatMap(album => album.tracks || []);

  const handlePlayAllTracks = () => {
    if (allTracks.length > 0) {
      setQueue(allTracks);
      playTrack(allTracks[0]);
    }
  };

  const handleShuffleAllTracks = () => {
    if (allTracks.length > 0) {
      shuffleAndPlay(allTracks);
    }
  };

  const tracksToShow = showAllTracks ? allTracks : allTracks.slice(0, 10);
  const totalReleases = (artist.Albums?.length || 0) + (artist.EPs?.length || 0) + (artist.Demos?.length || 0);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Заголовок артиста */}
        <header className="artist-header flex flex-col lg:flex-row items-center lg:items-start gap-8 mb-8">
          <div className="relative group">
            <Image
              src={artist.avatar}
              alt={`${artist.name} avatar`}
              width={250}
              height={250}
              className="w-60 h-60 rounded-full object-cover shadow-2xl"
              priority
            />
            {allTracks.length > 0 && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <PlayButton
                  tracks={allTracks}
                  size="large"
                  variant="artist"
                  className="shadow-lg"
                />
              </div>
            )}
          </div>
          
          <div className="artist-info text-center lg:text-left flex-1">
            <h1 className="text-5xl font-heading font-bold text-primary-text-color mb-4">
              {artist.name}
            </h1>
            
            <p className={`text-xl text-primary-text-color mb-3 ${
              detectCyrillic(artist.descriptionLine1) ? 'font-cyrillic' : 'font-body'
            }`}>
              {artist.descriptionLine1}
            </p>
            
            <p className={`text-lg text-secondary-text-color mb-6 ${
              detectCyrillic(artist.descriptionLine2) ? 'font-cyrillic' : 'font-body'
            }`}>
              {artist.descriptionLine2}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
              {allTracks.length > 0 && (
                <PlayButton
                  tracks={allTracks}
                  variant="header"
                  className="w-full sm:w-auto"
                />
              )}
              
              {totalReleases > 0 && (
                <button 
                  className="discography-btn bg-transparent border-2 border-accent-color text-accent-color hover:bg-accent-color hover:text-black px-6 py-3 rounded-full font-bold transition-all"
                  onClick={() => setShowDiscography(!showDiscography)}
                >
                  {showDiscography ? 'Hide' : 'Show'} Discography
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 text-secondary-text-color text-sm font-body">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-accent-color rounded-full"></span>
                {allTracks.length} tracks
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {artist.Albums?.length || 0} albums
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                {artist.EPs?.length || 0} EPs
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                {artist.Demos?.length || 0} demos
              </span>
            </div>
          </div>
        </header>

        {allTracks.length > 0 && (
          <>
            <div className="section-divider border-t border-card-hover-bg-color my-8"></div>

            {/* Секция All Tracks */}
            <section className="mb-8">
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-2xl font-heading font-bold text-primary-text-color">
                  All Tracks
                </h3>
                
                <div className="flex items-center gap-3">
                  <PlayButton
                    tracks={allTracks}
                    size="medium"
                    variant="artist"
                    className="flex-shrink-0"
                  />
                  
                  <button 
                    className="icon-btn bg-card-bg-color text-primary-text-color w-10 h-10 rounded-full flex items-center justify-center hover:bg-card-hover-bg-color transition-colors"
                    onClick={handleShuffleAllTracks}
                    title="Shuffle all tracks"
                    disabled={allTracks.length === 0}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                    </svg>
                  </button>
                </div>
              </header>
              
              <div className="track-list">
                <TrackList tracks={tracksToShow} />
                
                {allTracks.length > 10 && (
                  <button 
                    className="w-full mt-4 py-3 text-accent-color hover:text-green-400 hover:bg-card-hover-bg-color rounded font-bold transition-colors"
                    onClick={() => setShowAllTracks(!showAllTracks)}
                  >
                    {showAllTracks 
                      ? 'Show Less' 
                      : `Show All ${allTracks.length} Tracks`
                    }
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {/* Секция Discography */}
        {showDiscography && totalReleases > 0 && (
          <>
            <div className="section-divider border-t border-card-hover-bg-color my-8"></div>
            <section className="discography-section">
              <h2 className="text-3xl font-heading font-bold text-primary-text-color mb-6">
                Discography
              </h2>
              
              <div className="tabs-section">
                <nav className="tab-nav flex flex-wrap gap-2 sm:gap-4 border-b border-card-hover-bg-color mb-6">
                  {(['Albums', 'EPs', 'Demos'] as const).map((tab) => {
                    const count = artist[tab]?.length || 0;
                    return (
                      <button
                        key={tab}
                        className={`tab-btn px-4 py-2 font-body border-b-2 transition-colors ${
                          activeTab === tab
                            ? 'text-primary-text-color border-accent-color'
                            : 'text-secondary-text-color border-transparent hover:text-primary-text-color'
                        } ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        disabled={count === 0}
                      >
                        {tab} ({count})
                      </button>
                    );
                  })}
                </nav>
                
                <div className="tab-content">
                  {currentAlbums.length > 0 ? (
                    <AlbumCarousel albums={currentAlbums} />
                  ) : (
                    <div className="text-center py-12 text-secondary-text-color">
                      <div className="text-4xl opacity-50 mb-4">📀</div>
                      <p className="font-body">No {activeTab.toLowerCase()} available</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* Секция Other Artists */}
        <div className="section-divider border-t border-card-hover-bg-color my-8"></div>
        <section className="other-artists-section">
          <h2 className="text-3xl font-heading font-bold text-primary-text-color mb-6">
            Other Artists
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.values(ARTIST_DATA)
              .filter(otherArtist => otherArtist.id !== artistId)
              .map((otherArtist) => (
                <Link
                  key={otherArtist.id}
                  href={`/artist/${otherArtist.id}`}
                  className="text-center group"
                >
                  <Image
                    src={otherArtist.avatar}
                    alt={otherArtist.name}
                    width={100}
                    height={100}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover mx-auto mb-2 group-hover:scale-105 transition-transform shadow-lg"
                    loading="lazy"
                  />
                  <p className="text-xs sm:text-sm font-bold text-primary-text-color group-hover:text-accent-color transition-colors truncate">
                    {otherArtist.name}
                  </p>
                </Link>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
