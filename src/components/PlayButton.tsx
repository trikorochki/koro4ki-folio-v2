// src/components/PlayButton.tsx
'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/lib/music-player';
import { cn } from '@/lib/utils';

interface PlayButtonProps {
  tracks: Track[];
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'header' | 'artist' | 'album';
  className?: string;
  disabled?: boolean;
  showText?: boolean;
}

type IconSize = 'small' | 'medium' | 'large';

const SIZE_CLASSES = {
  small: 'w-8 h-8 text-xs',
  medium: 'w-12 h-12 text-sm',
  large: 'w-16 h-16 text-base'
} as const;

const ICON_SIZES = {
  small: {
    play: 'border-l-[4px] border-l-black border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent',
    pauseHeight: '10px',
    pauseWidth: '2px'
  },
  medium: {
    play: 'border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent',
    pauseHeight: '12px',
    pauseWidth: '2px'
  },
  large: {
    play: 'border-l-[8px] border-l-black border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent',
    pauseHeight: '14px',
    pauseWidth: '2px'
  }
} as const;

const BASE_CLASSES = "rounded-full flex items-center justify-center transition-all duration-150 font-bold";

const HEADER_CLASSES = [
  "flex items-center gap-3 bg-accent-color hover:bg-accent-color/90",
  "border-none rounded-full px-6 py-3 text-black font-bold text-base",
  "cursor-pointer transition-all duration-150 hover:scale-105",
  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
].join(' ');

// ================================================================================
// MEMOIZED ICON COMPONENTS
// ================================================================================

const PauseIcon = memo<{ iconSize: IconSize }>(({ iconSize }) => {
  const iconConfig = ICON_SIZES[iconSize];
  
  return (
    <div className="flex items-center justify-center gap-0.5">
      <div 
        className="bg-black rounded-sm"
        style={{
          width: iconConfig.pauseWidth,
          height: iconConfig.pauseHeight
        }}
      />
      <div 
        className="bg-black rounded-sm"
        style={{
          width: iconConfig.pauseWidth,
          height: iconConfig.pauseHeight
        }}
      />
    </div>
  );
});

PauseIcon.displayName = 'PauseIcon';

const PlayIcon = memo<{ iconSize: IconSize; className?: string }>(({ iconSize, className }) => {
  const playClasses = ICON_SIZES[iconSize].play;
  
  return (
    <div className={cn('ml-1', playClasses, className)} />
  );
});

PlayIcon.displayName = 'PlayIcon';

// ================================================================================
// ENHANCED TRACK VALIDATION FUNCTIONS
// ================================================================================

/**
 * Улучшенная валидация треков с проверкой всех обязательных полей
 */
const validateTrack = (track: Track): boolean => {
  if (!track) {
    console.warn('PlayButton: Track is null or undefined');
    return false;
  }

  if (!track.id || typeof track.id !== 'string') {
    console.warn('PlayButton: Track missing valid ID:', track);
    return false;
  }

  if (!track.file || typeof track.file !== 'string') {
    console.warn('PlayButton: Track missing valid file URL:', track.id);
    return false;
  }

  if (!track.title || typeof track.title !== 'string') {
    console.warn('PlayButton: Track missing valid title:', track.id);
    return false;
  }

  // Валидация URL для Blob Storage
  const isValidUrl = track.file.startsWith('https://') || 
                     track.file.startsWith('http://') || 
                     track.file.startsWith('blob:') ||
                     track.file.startsWith('/api/music/');

  if (!isValidUrl) {
    console.warn('PlayButton: Track has invalid file URL format:', track.file);
    return false;
  }

  return true;
};

/**
 * Валидация списка треков перед воспроизведением
 */
const validateTrackList = (tracks: Track[]): Track[] => {
  if (!Array.isArray(tracks)) {
    console.warn('PlayButton: Tracks is not an array:', tracks);
    return [];
  }

  const validTracks = tracks.filter(validateTrack);
  
  if (validTracks.length !== tracks.length) {
    console.warn(`PlayButton: Filtered ${tracks.length - validTracks.length} invalid tracks from list`);
  }

  return validTracks;
};

// ================================================================================
// MAIN COMPONENT WITH ENHANCED OPTIMIZATION
// ================================================================================

const PlayButton = memo<PlayButtonProps>(({
  tracks,
  size = 'medium',
  variant = 'default',
  className,
  disabled = false,
  showText = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    shuffleAndPlay,
    isPlaying,
    currentTrack,
    pauseTrack,
    resumeTrack,
    setQueue,
    playTrack
  } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED COMPUTATIONS
  // ================================================================================

  const validTracks = useMemo(() => {
    return validateTrackList(tracks);
  }, [tracks]);

  const hasValidTracks = useMemo(() => {
    return validTracks.length > 0;
  }, [validTracks]);

  const isCurrentTrackInList = useMemo(() => {
    return currentTrack && validTracks.some(track => track.id === currentTrack.id);
  }, [currentTrack, validTracks]);

  const showPause = useMemo(() => {
    return isCurrentTrackInList && isPlaying;
  }, [isCurrentTrackInList, isPlaying]);

  const shouldRemoveShadow = useMemo(() => {
    return variant === 'default' && className?.includes('shadow-none');
  }, [variant, className]);

  const buttonClasses = useMemo(() => {
    const sizeClass = SIZE_CLASSES[size];
    const shadowClass = shouldRemoveShadow ? '' : 'shadow-lg hover:shadow-xl';
    const colorClass = 'bg-accent-color hover:bg-accent-color/90 text-black';
    
    return cn(BASE_CLASSES, sizeClass, shadowClass, colorClass, className);
  }, [size, shouldRemoveShadow, className]);

  const ariaLabel = useMemo(() => {
    const trackCount = validTracks.length;
    
    if (variant === 'header') {
      return showPause 
        ? 'Pause current music' 
        : `Play random music (${trackCount} track${trackCount !== 1 ? 's' : ''} available)`;
    }
    
    return showPause 
      ? 'Pause current track' 
      : `Play music (${trackCount} track${trackCount !== 1 ? 's' : ''})`;
  }, [variant, showPause, validTracks.length]);

  // ================================================================================
  // OPTIMIZED EVENT HANDLERS
  // ================================================================================

  const handlePlay = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!hasValidTracks || disabled) {
      console.warn('PlayButton: Cannot play - no valid tracks or button disabled', {
        hasValidTracks,
        disabled,
        trackCount: validTracks.length
      });
      return;
    }

    try {
      if (isCurrentTrackInList && isPlaying) {
        console.log('PlayButton: Pausing current track');
        pauseTrack();
      } else if (isCurrentTrackInList && !isPlaying && currentTrack) {
        console.log('PlayButton: Resuming current track');
        resumeTrack();
      } else {
        // Определяем тип воспроизведения в зависимости от варианта
        if (variant === 'header' || variant === 'default') {
          console.log(`PlayButton: Starting shuffle play with ${validTracks.length} tracks`);
          shuffleAndPlay(validTracks);
        } else {
          // Для artist/album - играем первый трек и устанавливаем очередь
          console.log(`PlayButton: Playing first track and setting queue (${validTracks.length} tracks)`);
          setQueue(validTracks);
          playTrack(validTracks[0]);
        }
      }
    } catch (error) {
      console.error('PlayButton: Error handling play action:', error);
    }
  }, [
    hasValidTracks,
    disabled,
    isCurrentTrackInList,
    isPlaying,
    currentTrack,
    pauseTrack,
    resumeTrack,
    shuffleAndPlay,
    setQueue,
    playTrack,
    validTracks,
    variant
  ]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // ================================================================================
  // ACCESSIBILITY ENHANCEMENTS
  // ================================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePlay();
    }
  }, [handlePlay]);

  // ================================================================================
  // EARLY RETURNS AND WARNINGS
  // ================================================================================

  if (!hasValidTracks && !disabled) {
    console.warn('PlayButton: No valid tracks provided', { 
      totalTracks: tracks.length,
      validTracks: validTracks.length 
    });
  }

  // ================================================================================
  // VARIANT RENDERS
  // ================================================================================

  if (variant === 'header') {
    return (
      <button
        className={cn(HEADER_CLASSES, className)}
        onClick={handlePlay}
        onKeyDown={handleKeyDown}
        disabled={disabled || !hasValidTracks}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={ariaLabel}
        aria-pressed={showPause ? "true" : "false"}  // ✅ Исправлено
        type="button"
        tabIndex={0}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          {showPause ? (
            <PauseIcon iconSize="small" />
          ) : (
            <PlayIcon iconSize="small" />
          )}
        </div>
        <span className="font-medium">
          {showPause ? 'Pause' : 'Play Random'}
        </span>
      </button>
    );
  }

  if (variant === 'artist' || variant === 'album') {
    return (
      <button
        className={buttonClasses}
        onClick={handlePlay}
        onKeyDown={handleKeyDown}
        disabled={disabled || !hasValidTracks}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={ariaLabel}
        aria-pressed={showPause ? "true" : "false"}  // ✅ Исправлено
        type="button"
        tabIndex={0}
        title={ariaLabel}
      >
        {showPause ? (
          <PauseIcon iconSize={size} />
        ) : (
          <PlayIcon iconSize={size} />
        )}
      </button>
    );
  }

  // Default variant
  return (
    <button
      className={buttonClasses}
      onClick={handlePlay}
      onKeyDown={handleKeyDown}
      disabled={disabled || !hasValidTracks}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={ariaLabel}
      aria-pressed={showPause ? "true" : "false"}  // ✅ Исправлено
      type="button"
      tabIndex={0}
      title={ariaLabel}
    >
      {showPause ? (
        <PauseIcon iconSize={size} />
      ) : (
        <PlayIcon iconSize={size} />
      )}
      
      {showText && (
        <span className="ml-2 font-medium">
          {showPause ? 'Pause' : 'Play'}
        </span>
      )}
    </button>
  );
});

PlayButton.displayName = 'PlayButton';

export default PlayButton;
