// src/components/MusicPlayer.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMusicPlayer } from '@/lib/music-player';
import { DurationCache } from '@/lib/duration-cache';

// ================================================================================
// TYPES & CONSTANTS
// ================================================================================

interface AudioProgressEvent extends React.MouseEvent<HTMLDivElement> {}

const ARTIST_MAP: Record<string, string> = {
  'flowkorochki': 'FLOWKORO4KI',
  'psykorochki': 'PSYKORO4KI',
  'riffkorochki': 'RIFFKORO4KI',
  'trapkorochki': 'TRAPKORO4KI',
  'streetkorochki': 'STREETKORO4KI',
  'nukorochki': 'NÜKORO4KI'
} as const;

const COLORS = {
  background: '#181818',
  border: '#282828',
  primary: '#1DB954',
  primaryHover: '#1ed760',
  white: '#ffffff',
  gray: '#b3b3b3'
} as const;

// ================================================================================
// MAIN COMPONENT
// ================================================================================

export default function MusicPlayer() {
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [actualDuration, setActualDuration] = useState(0);

  // Music player state
  const {
    currentTrack,
    isPlaying,
    currentTime,
    volume,
    queue,
    pauseTrack,
    nextTrack,
    prevTrack,
    setCurrentTime,
    setVolume,
    resumeTrack,
    updateTrackDuration,
  } = useMusicPlayer();

  // ================================================================================
  // UTILITY FUNCTIONS WITH useCallback
  // ================================================================================

  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getArtistName = useCallback((): string => {
    if (!currentTrack) return '';
    return ARTIST_MAP[currentTrack.artistId] || currentTrack.artistId.toUpperCase();
  }, [currentTrack]);

  const getAlbumName = useCallback((): string => {
    if (!currentTrack) return '';
    const parts = currentTrack.id.split('_');
    return parts.slice(1, -1).join(' ').replace(/_/g, ' ');
  }, [currentTrack]);

  // ================================================================================
  // ERROR HANDLING
  // ================================================================================

  const handleAudioError = useCallback((error: any) => {
    console.error('Audio playback error:', error);
    
    if (error.name === 'NotSupportedError') {
      console.warn('Audio format not supported or file not found, trying next track');
      nextTrack();
    } else if (error.name === 'NetworkError' || error.name === 'AbortError') {
      console.warn('Network error loading audio, retrying in 2 seconds...');
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio && currentTrack && !isPlaying) {
          audio.load();
        }
      }, 2000);
    } else {
      console.error('Unexpected audio error:', error);
      setTimeout(() => {
        nextTrack();
      }, 1000);
    }
  }, [nextTrack, currentTrack, isPlaying]);

  // ================================================================================
  // AUDIO EVENT HANDLERS WITH useCallback
  // ================================================================================

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !isDragging) {
      setCurrentTime(audio.currentTime);
    }
  }, [isDragging, setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.duration <= 0) return;

    const duration = audio.duration;
    setActualDuration(duration);
    
    if (currentTrack) {
      const formattedDuration = formatTime(duration);
      updateTrackDuration(currentTrack.id, formattedDuration);
      DurationCache.set(currentTrack.id, formattedDuration);
    }
  }, [currentTrack, formatTime, updateTrackDuration]);

  // ================================================================================
  // PROGRESS BAR HANDLERS WITH useCallback
  // ================================================================================

  const handleProgressClick = useCallback((e: AudioProgressEvent) => {
    const progressElement = progressRef.current;
    const audio = audioRef.current;
    
    if (!progressElement || !audio || actualDuration <= 0) return;

    const rect = progressElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((clickX / rect.width) * actualDuration, actualDuration));
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [actualDuration, setCurrentTime]);

  const handleProgressMouseDown = useCallback((e: AudioProgressEvent) => {
    setIsDragging(true);
    handleProgressClick(e);
  }, [handleProgressClick]);

  const handleProgressMouseMove = useCallback((e: AudioProgressEvent) => {
    if (isDragging) {
      handleProgressClick(e);
    }
  }, [isDragging, handleProgressClick]);

  const handleProgressMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ================================================================================
  // CONTROL HANDLERS WITH useCallback
  // ================================================================================

  const handlePlayPause = useCallback(() => {
    if (!currentTrack) return;
    
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  }, [currentTrack, isPlaying, pauseTrack, resumeTrack]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Math.max(0, Math.min(1, parseFloat(e.target.value)));
    setVolume(newVolume);
  }, [setVolume]);

  // ================================================================================
  // EFFECTS - OPTIMIZED WITH PROPER DEPENDENCIES
  // ================================================================================

  // Consolidated play/pause effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const playPromise = isPlaying ? audio.play() : Promise.resolve(audio.pause());
    
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(handleAudioError);
    }
  }, [isPlaying, handleAudioError]);

  // Volume control effect
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  // Current track loading effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const audioSrc = currentTrack.file.startsWith('/api/music/') 
      ? currentTrack.file 
      : `/api/music/${currentTrack.file}`;
    
    audio.src = audioSrc;
    audio.load();
    setActualDuration(0);

    if (isPlaying) {
      audio.play().catch(handleAudioError);
    }
  }, [currentTrack, isPlaying, handleAudioError]);

  // ================================================================================
  // COMPUTED VALUES WITH useMemo
  // ================================================================================

  const progressPercentage = useMemo(() => {
    return actualDuration > 0 ? Math.min((currentTime / actualDuration) * 100, 100) : 0;
  }, [currentTime, actualDuration]);

  const artistName = useMemo(() => getArtistName(), [getArtistName]);
  const albumName = useMemo(() => getAlbumName(), [getAlbumName]);

  const isControlsDisabled = useMemo(() => queue.length <= 1, [queue.length]);

  // ================================================================================
  // RENDER CONDITIONS
  // ================================================================================

  if (!currentTrack) return null;

  // ================================================================================
  // JSX RENDER
  // ================================================================================

  return (
    <div 
      className="fixed bottom-0 left-0 w-full h-[90px] z-50 border-t"
      style={{
        backgroundColor: COLORS.background,
        borderTopColor: COLORS.border
      }}
    >
      <div className="container mx-auto px-4 h-full flex items-center gap-4">
        
        {/* Track Info */}
        <div className="flex-1 min-w-0 max-w-xs">
          <h4 
            className="font-bold text-sm truncate mb-1" 
            style={{ color: COLORS.white }}
          >
            {currentTrack.title}
          </h4>
          <p 
            className="text-xs truncate mb-1" 
            style={{ color: COLORS.gray }}
          >
            {artistName}
          </p>
          <p 
            className="text-xs truncate opacity-70" 
            style={{ color: COLORS.gray }}
          >
            {albumName || 'Unknown Album'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={prevTrack}
            className="transition-colors text-xl disabled:opacity-50 p-2 hover:text-green-500"
            style={{ color: COLORS.white }}
            disabled={isControlsDisabled}
            title="Previous track"
            aria-label="Previous track"
          >
            ⏮
          </button>
          
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{ backgroundColor: COLORS.primary }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.primary}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
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
            className="transition-colors text-xl disabled:opacity-50 p-2 hover:text-green-500"
            style={{ color: COLORS.white }}
            disabled={isControlsDisabled}
            title="Next track"
            aria-label="Next track"
          >
            ⏭
          </button>
        </div>

        {/* Progress */}
        <div className="flex-1 min-w-0 max-w-md">
          <div className="flex items-center gap-3 text-xs" style={{ color: COLORS.gray }}>
            <span className="w-10 text-right">
              {formatTime(currentTime)}
            </span>
            
            <div 
              ref={progressRef}
              className="flex-1 rounded-full h-2 cursor-pointer relative group"
              style={{ backgroundColor: 'rgba(179, 179, 179, 0.2)' }}
              onMouseDown={handleProgressMouseDown}
              onMouseMove={handleProgressMouseMove}
              onMouseUp={handleProgressMouseUp}
              onMouseLeave={handleProgressMouseUp}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={actualDuration}
              aria-valuenow={currentTime}
              aria-label="Track progress"
            >
              <div
                className="h-2 rounded-full transition-all"
                style={{ 
                  width: `${progressPercentage}%`,
                  backgroundColor: COLORS.primary
                }}
              />
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ 
                  left: `calc(${progressPercentage}% - 6px)`,
                  backgroundColor: COLORS.primary
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
          <span className="text-sm" style={{ color: COLORS.white }}>🔊</span>
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
              accentColor: COLORS.primary
            }}
            aria-label="Volume control"
          />
          <span className="text-xs w-8" style={{ color: COLORS.gray }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={nextTrack}
        onError={handleAudioError}
        preload="metadata"
      />
    </div>
  );
}
