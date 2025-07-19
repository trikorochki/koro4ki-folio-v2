// src/components/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useMusicPlayer } from '@/lib/music-player';
import { PlaylistData } from '@/types/music';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [playlistData, setPlaylistData] = useState<PlaylistData>({});
  const { setQueue, playTrack, isPlaying, currentTrack, pauseTrack, shuffleAndPlay } = useMusicPlayer();

  useEffect(() => {
    const fetchPlaylistData = async () => {
      try {
        const response = await fetch('/api/playlist');
        if (response.ok) {
          const data = await response.json();
          setPlaylistData(data);
        }
      } catch (error) {
        console.error('Error fetching playlist data:', error);
      }
    };

    fetchPlaylistData();
  }, []);

  const handlePlayRandom = () => {
    const allTracks = Object.values(playlistData)
      .flatMap(artist => [...(artist.Albums || []), ...(artist.EPs || []), ...(artist.Demos || [])])
      .flatMap(album => album.tracks || []);
    
    if (allTracks.length === 0) return;
    
    if (isPlaying && currentTrack) {
      pauseTrack();
    } else {
      shuffleAndPlay(allTracks);
    }
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen) {
        const target = event.target as Element;
        if (!target.closest('.dropdown')) {
          setIsMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const artists = [
    { id: 'flowkorochki', name: 'FLOWKORO4KI' },
    { id: 'psykorochki', name: 'PSYKORO4KI' },
    { id: 'riffkorochki', name: 'RIFFKORO4KI' },
    { id: 'trapkorochki', name: 'TRAPKORO4KI' },
    { id: 'streetkorochki', name: 'STREETKORO4KI' },
    { id: 'nukorochki', name: 'NÜKORO4KI' }
  ];

  return (
    <header className="site-header fixed top-0 left-0 w-full h-20 bg-black/80 backdrop-blur-lg border-b border-card-hover-bg-color z-50">
      <div className="container mx-auto px-4 h-full flex items-center justify-between">
        {/* Логотип */}
        <Link href="/" className="logo-link">
          <Image
            src="/images/kr4-logo.png"
            alt="KR4 Neuromusic Production Logo"
            width={60}
            height={60}
            className="rounded-lg"
            priority
          />
        </Link>

        {/* Кнопка Play Random */}
        <button 
          className="header-play-random-btn flex items-center gap-3 bg-accent-color hover:bg-green-400 text-black font-bold px-6 py-3 rounded-full font-body transition-all duration-200 hover:scale-105"
          onClick={handlePlayRandom}
          disabled={Object.keys(playlistData).length === 0}
        >
          <div className="play-circle w-5 h-5 flex items-center justify-center">
            {isPlaying && currentTrack ? (
              <div className="pause-symbol flex gap-1">
                <div className="w-1 h-4 bg-black"></div>
                <div className="w-1 h-4 bg-black"></div>
              </div>
            ) : (
              <div className="play-triangle w-0 h-0 border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5"></div>
            )}
          </div>
          <span className="play-text hidden sm:inline">
            {isPlaying && currentTrack ? 'Pause' : 'Play Random'}
          </span>
        </button>

        {/* Навигация */}
        <nav className="site-nav">
          <div className="dropdown relative">
            <button 
              className="dropdown-btn border border-secondary-text-color text-secondary-text-color hover:text-primary-text-color hover:border-primary-text-color px-4 py-2 rounded-full transition-colors font-body"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
            >
              Artists {isMenuOpen ? '↑' : '↓'}
            </button>
            
            {isMenuOpen && (
              <div className="dropdown-content absolute top-full right-0 mt-2 bg-card-bg-color rounded-lg shadow-lg border border-card-hover-bg-color min-w-48 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                {artists.map((artist) => (
                  <Link
                    key={artist.id}
                    href={`/artist/${artist.id}`}
                    className="block px-4 py-3 text-primary-text-color hover:bg-card-hover-bg-color transition-colors first:rounded-t-lg last:rounded-b-lg"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {artist.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
