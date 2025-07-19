// src/components/MusicPlayer.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useMusicPlayer } from '@/lib/music-player';
import { DurationCache } from '@/lib/duration-cache';

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [actualDuration, setActualDuration] = useState(0);
  
  const {
    currentTrack,
    isPlaying,
    currentTime,
    volume,
    queue,
    currentIndex,
    pauseTrack,
    nextTrack,
    prevTrack,
    setCurrentTime,
    setVolume,
    resumeTrack,
    updateTrackDuration,
  } = useMusicPlayer();

  // ... все useEffect остаются без изменений ...

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.src = currentTrack.file;
      audioRef.current.load();
      setActualDuration(0);
      
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      }
    }
  }, [currentTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration > 0) {
      const duration = audioRef.current.duration;
      setActualDuration(duration);
      
      if (currentTrack) {
        const formattedDuration = formatTime(duration);
        updateTrackDuration(currentTrack.id, formattedDuration);
        DurationCache.set(currentTrack.id, formattedDuration);
      }
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && audioRef.current && actualDuration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * actualDuration;
      
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleProgressClick(e);
    }
  };

  const handleProgressMouseUp = () => {
    setIsDragging(false);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!currentTrack) return;
    
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  };

  const getArtistName = (): string => {
    if (!currentTrack) return '';
    const artistMap: Record<string, string> = {
      'flowkorochki': 'FLOWKORO4KI',
      'psykorochki': 'PSYKORO4KI',
      'riffkorochki': 'RIFFKORO4KI',
      'trapkorochki': 'TRAPKORO4KI',
      'streetkorochki': 'STREETKORO4KI',
      'nukorochki': 'NÜKORO4KI'
    };
    return artistMap[currentTrack.artistId] || currentTrack.artistId.toUpperCase();
  };

  const getAlbumName = (): string => {
    if (!currentTrack) return '';
    const parts = currentTrack.id.split('_');
    return parts.slice(1, -1).join(' ').replace(/_/g, ' ');
  };

  if (!currentTrack) return null;

  const progressPercentage = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  return (
    // ✅ ИСПРАВЛЕНО: Используем стандартные Tailwind цвета вместо CSS переменных
    <div 
      className="fixed bottom-0 left-0 w-full h-[90px] z-50 border-t"
      style={{
        backgroundColor: '#181818', // var(--card-bg-color)
        borderTopColor: '#282828'   // var(--card-hover-bg-color)
      }}
    >
      <div className="container mx-auto px-4 h-full flex items-center gap-4">
        {/* Track Info */}
        <div className="flex-1 min-w-0 max-w-xs">
          <h4 className="font-bold text-sm truncate mb-1" style={{ color: '#ffffff' }}>
            {currentTrack.title}
          </h4>
          <p className="text-xs truncate mb-1" style={{ color: '#b3b3b3' }}>
            {getArtistName()}
          </p>
          <p className="text-xs truncate opacity-70" style={{ color: '#b3b3b3' }}>
            {getAlbumName() || 'Unknown Album'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={prevTrack}
            className="transition-colors text-xl disabled:opacity-50 p-2"
            style={{ color: '#ffffff' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1DB954'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}
            disabled={queue.length <= 1}
            title="Previous track"
          >
            ⏮
          </button>
          
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{ backgroundColor: '#1DB954' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1ed760'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1DB954'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <div className="flex gap-1">
                <div className="w-0.5 h-3 bg-black rounded-sm"></div>
                <div className="w-0.5 h-3 bg-black rounded-sm"></div>
              </div>
            ) : (
              <div className="w-0 h-0 border-l-[8px] border-l-black border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-0.5"></div>
            )}
          </button>
          
          <button
            onClick={nextTrack}
            className="transition-colors text-xl disabled:opacity-50 p-2"
            style={{ color: '#ffffff' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1DB954'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#ffffff'}
            disabled={queue.length <= 1}
            title="Next track"
          >
            ⏭
          </button>
        </div>

        {/* Progress */}
        <div className="flex-1 min-w-0 max-w-md">
          <div className="flex items-center gap-3 text-xs" style={{ color: '#b3b3b3' }}>
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            
            <div 
              ref={progressRef}
              className="flex-1 rounded-full h-2 cursor-pointer relative group"
              style={{ backgroundColor: 'rgba(179, 179, 179, 0.2)' }}
              onMouseDown={handleProgressMouseDown}
              onMouseMove={handleProgressMouseMove}
              onMouseUp={handleProgressMouseUp}
              onMouseLeave={handleProgressMouseUp}
            >
              <div
                className="h-2 rounded-full transition-all"
                style={{ 
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: '#1DB954'
                }}
              />
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ 
                  left: `calc(${Math.min(progressPercentage, 100)}% - 6px)`,
                  backgroundColor: '#1DB954'
                }}
              />
            </div>
            
            <span className="w-10">
              {actualDuration > 0 ? formatTime(actualDuration) : currentTrack.duration}
            </span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm" style={{ color: '#ffffff' }}>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: 'rgba(179, 179, 179, 0.2)',
              accentColor: '#1DB954'
            }}
          />
          <span className="text-xs w-8" style={{ color: '#b3b3b3' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextTrack}
        onError={(e) => {
          console.error('Audio error:', e);
        }}
        preload="metadata"
      />
    </div>
  );
}
