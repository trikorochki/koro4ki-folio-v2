// src/components/MusicPlayer.tsx
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMusicPlayer } from '@/lib/music-player';
import { DurationCache } from '@/lib/duration-cache';

// ================================================================================
// CONSTANTS
// ================================================================================

const COLORS = {
  background: '#181818',
  border: '#282828', 
  primary: '#1DB954',
  primaryHover: '#1ed760',
  white: '#ffffff',
  gray: '#b3b3b3'
} as const;

const ARTIST_MAP: Record<string, string> = {
  'flowkorochki': 'FLOWKORO4KI',
  'psykorochki': 'PSYKORO4KI', 
  'riffkorochki': 'RIFFKORO4KI',
  'trapkorochki': 'TRAPKORO4KI',
  'streetkorochki': 'STREETKORO4KI',
  'nukorochki': 'NÜKORO4KI'
} as const;

// ================================================================================
// MAIN COMPONENT
// ================================================================================

export default function MusicPlayer() {
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const currentPlayPromiseRef = useRef<Promise<void> | null>(null);
  
  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [actualDuration, setActualDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
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
    if (currentTrack.albumName) return currentTrack.albumName;
    
    const parts = currentTrack.id.split('_');
    return parts.slice(1, -1).join(' ').replace(/_/g, ' ');
  }, [currentTrack]);

  // ================================================================================
  // ENHANCED ERROR HANDLING WITH RETRY LOGIC
  // ================================================================================

  const handleAudioError = useCallback((event: any) => {
    const error = event?.target?.error || event;
    console.error('🚫 Audio error:', error);
    
    setIsLoading(false);
    currentPlayPromiseRef.current = null;
    
    // Handle different error types
    if (error?.code) {
      switch (error.code) {
        case 1: // MEDIA_ERR_ABORTED
          console.log('⏸️ Audio playback aborted (normal during track switching)');
          setHasError(false);
          return;
          
        case 2: // MEDIA_ERR_NETWORK
          console.warn('🌐 Network error loading audio');
          if (retryCount < 3) {
            console.log(`🔄 Retrying... (${retryCount + 1}/3)`);
            setRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (audioRef.current && currentTrack) {
                audioRef.current.load();
              }
            }, 1000 * (retryCount + 1));
            return;
          }
          break;
          
        case 3: // MEDIA_ERR_DECODE
          console.error('🔇 Audio decode error - corrupted file');
          break;
          
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          console.error('🚫 Audio format not supported');
          break;
          
        default:
          console.error('💥 Unknown audio error:', error);
      }
    }
    
    setHasError(true);
    setRetryCount(0);
    
    // Auto-skip to next track after error
    setTimeout(() => {
      if (queue.length > 1) {
        setHasError(false);
        nextTrack();
      }
    }, 2000);
  }, [nextTrack, currentTrack, queue.length, retryCount]);

  // ================================================================================
  // OPTIMIZED AUDIO PLAYBACK MANAGEMENT
  // ================================================================================

  const safePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || hasError) return;

    try {
      // Cancel previous play promise
      if (currentPlayPromiseRef.current) {
        currentPlayPromiseRef.current = null;
      }

      setIsLoading(true);
      console.log('▶️ Starting playback for:', currentTrack.title);
      
      // Ensure audio is ready
      if (audio.readyState < 2) {
        console.log('⏳ Waiting for audio to load...');
        return;
      }
      
      const playPromise = audio.play();
      currentPlayPromiseRef.current = playPromise;
      
      await playPromise;
      
      // Check if promise wasn't cancelled
      if (currentPlayPromiseRef.current === playPromise) {
        console.log('✅ Playback started successfully');
        setIsLoading(false);
        setHasError(false);
        setRetryCount(0);
      }
      
    } catch (error: unknown) {
      console.error('Play error:', error);
      setIsLoading(false);
      
      // Type guard для безопасной проверки свойства name
      const hasName = error && typeof error === 'object' && 'name' in error;
      const errorName = hasName ? (error as { name: string }).name : '';
      
      // Don't treat AbortError as real error
      if (errorName !== 'AbortError') {
        handleAudioError(error);
      }
    }
  }, [currentTrack, hasError, handleAudioError]);


  const safePause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      currentPlayPromiseRef.current = null;
      audio.pause();
      setIsLoading(false);
      console.log('⏸️ Playback paused');
    } catch (error) {
      console.warn('Error pausing audio:', error);
    }
  }, []);

  // ================================================================================
  // OPTIMIZED AUDIO EVENT HANDLERS
  // ================================================================================

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !isDragging && !isNaN(audio.currentTime)) {
      setCurrentTime(audio.currentTime);
    }
  }, [isDragging, setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || isNaN(audio.duration) || audio.duration <= 0) return;

    const duration = audio.duration;
    setActualDuration(duration);
    setIsLoading(false);
    setHasError(false);
    setRetryCount(0);
    
    console.log(`⏱️ Loaded duration: ${formatTime(duration)} for ${currentTrack?.title}`);
    
    if (currentTrack) {
      const formattedDuration = formatTime(duration);
      updateTrackDuration(currentTrack.id, formattedDuration);
      DurationCache.set(currentTrack.id, formattedDuration);
    }

    // Start playback if needed
    if (isPlaying && !hasError) {
      safePlay();
    }
  }, [currentTrack, formatTime, updateTrackDuration, isPlaying, hasError, safePlay]);

  const handleCanPlay = useCallback(() => {
    console.log('🔄 Audio can start playing');
    setIsLoading(false);
    setHasError(false);
    
    // Auto-play if should be playing
    if (isPlaying && !hasError) {
      safePlay();
    }
  }, [isPlaying, hasError, safePlay]);

  const handleWaiting = useCallback(() => {
    console.log('⏳ Audio buffering...');
    setIsLoading(true);
  }, []);

  const handleLoadStart = useCallback(() => {
    console.log('🔄 Audio loading started...');
    setIsLoading(true);
    setHasError(false);
  }, []);

  const handleLoadedData = useCallback(() => {
    console.log('📊 Audio data loaded');
    setIsLoading(false);
  }, []);

  const handleEnded = useCallback(() => {
    console.log('🔚 Track ended');
    setIsLoading(false);
    setHasError(false);
    nextTrack();
  }, [nextTrack]);

  // ================================================================================
  // PROGRESS BAR HANDLERS WITH useCallback
  // ================================================================================

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const progressElement = progressRef.current;
    const audio = audioRef.current;
    
    if (!progressElement || !audio || actualDuration <= 0) return;

    const rect = progressElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((clickX / rect.width) * actualDuration, actualDuration));
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [actualDuration, setCurrentTime]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);
  }, [handleProgressClick]);

  const handleProgressMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
    
    // Reset error state when user manually tries to play
    if (hasError) {
      setHasError(false);
      setRetryCount(0);
    }
    
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  }, [currentTrack, isPlaying, pauseTrack, resumeTrack, hasError]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Math.max(0, Math.min(1, parseFloat(e.target.value)));
    setVolume(newVolume);
  }, [setVolume]);

  // ================================================================================
  // EFFECTS - OPTIMIZED WITH PROPER DEPENDENCIES
  // ================================================================================

  // Play/pause control effect
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying && !isLoading && !hasError) {
      safePlay();
    } else if (!isPlaying) {
      safePause();
    }
  }, [isPlaying, safePlay, safePause, isLoading, hasError]);

  // Volume control effect
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !isNaN(volume)) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Current track loading effect with enhanced URL validation
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    console.log(`🎵 Loading track: ${currentTrack.title}`);
    console.log(`🔗 URL: ${currentTrack.file}`);

    // Reset states
    setIsLoading(true);
    setActualDuration(0);
    setHasError(false);
    setRetryCount(0);
    currentPlayPromiseRef.current = null;

    // Enhanced URL validation for Blob Storage
    const isValidUrl = currentTrack.file && (
      currentTrack.file.startsWith('https://') || 
      currentTrack.file.startsWith('http://') ||
      currentTrack.file.startsWith('blob:')
    );

    if (!isValidUrl) {
      console.error('❌ Invalid audio URL:', currentTrack.file);
      setIsLoading(false);
      setHasError(true);
      return;
    }

    // Set new source and load
    try {
      audio.src = currentTrack.file;
      audio.load();
    } catch (error) {
      console.error('Error setting audio source:', error);
      setIsLoading(false);
      setHasError(true);
    }

  }, [currentTrack]);

  // ================================================================================
  // MEMOIZED VALUES FOR PERFORMANCE
  // ================================================================================

  const progressPercentage = useMemo(() => {
    return actualDuration > 0 ? Math.min((currentTime / actualDuration) * 100, 100) : 0;
  }, [currentTime, actualDuration]);

  const artistName = useMemo(() => getArtistName(), [getArtistName]);
  const albumName = useMemo(() => getAlbumName(), [getAlbumName]);

  const isControlsDisabled = useMemo(() => queue.length <= 1, [queue.length]);

  const playButtonContent = useMemo(() => {
    if (hasError) {
      return <span className="text-xs">⚠️</span>;
    }
    if (isLoading) {
      return <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />;
    }
    if (isPlaying) {
      return (
        <div className="flex gap-1">
          <div className="w-0.5 h-3 bg-black rounded-sm" />
          <div className="w-0.5 h-3 bg-black rounded-sm" />
        </div>
      );
    }
    return (
      <div className="w-0 h-0 border-l-[8px] border-l-black border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-0.5" />
    );
  }, [hasError, isLoading, isPlaying]);

  const playButtonTitle = useMemo(() => {
    if (hasError) return 'Error - click to retry';
    if (isLoading) return 'Loading...';
    return isPlaying ? 'Pause' : 'Play';
  }, [hasError, isLoading, isPlaying]);

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
            title={currentTrack.title}
          >
            {currentTrack.title}
            {isLoading && <span className="ml-2 text-xs opacity-70">🔄</span>}
            {hasError && <span className="ml-2 text-xs text-red-400">⚠️</span>}
          </h4>
          <p 
            className="text-xs truncate mb-1" 
            style={{ color: COLORS.gray }}
            title={artistName}
          >
            {artistName}
          </p>
          <p 
            className="text-xs truncate opacity-70" 
            style={{ color: COLORS.gray }}
            title={albumName || 'Unknown Album'}
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
            disabled={isLoading && !hasError}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-70"
            style={{ backgroundColor: COLORS.primary }}
            onMouseEnter={(e) => !isLoading && !hasError && (e.currentTarget.style.backgroundColor = COLORS.primaryHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.primary)}
            title={playButtonTitle}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {playButtonContent}
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
              tabIndex={0}
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

      {/* Enhanced Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onLoadStart={handleLoadStart}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  );
}
