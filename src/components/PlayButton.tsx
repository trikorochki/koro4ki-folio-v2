// src/components/PlayButton.tsx
'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/lib/music-player';
import { cn } from '@/lib/utils';

// ================================================================================
// TYPES & INTERFACES
// ================================================================================

interface PlayButtonProps {
  tracks: Track[];
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'header' | 'artist' | 'album';
  className?: string;
  disabled?: boolean;
  showText?: boolean;
}

type IconSize = 'small' | 'medium' | 'large';

// ================================================================================
// CONSTANTS
// ================================================================================

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
// MEMOIZED COMPONENTS
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
// MAIN COMPONENT
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
    resumeTrack
  } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED VALUES
  // ================================================================================

  const isCurrentTrackInList = useMemo(() => {
    return currentTrack && tracks.some(track => track.id === currentTrack.id);
  }, [currentTrack, tracks]);

  const showPause = useMemo(() => {
    return isCurrentTrackInList && isPlaying;
  }, [isCurrentTrackInList, isPlaying]);

  const shouldRemoveShadow = useMemo(() => {
    return variant === 'default' && className?.includes('shadow-none');
  }, [variant, className]);

  // Валидация треков
  const validTracks = useMemo(() => {
    return tracks.filter(track => 
      track && track.id && track.file && track.title
    );
  }, [tracks]);

  const hasValidTracks = validTracks.length > 0;

  // ================================================================================
  // EVENT HANDLERS WITH useCallback
  // ================================================================================

  const handlePlay = useCallback((e?: React.MouseEvent) => {
    // Предотвращаем всплытие события
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!hasValidTracks || disabled) {
      console.warn('PlayButton: No valid tracks or button is disabled');
      return;
    }

    try {
      if (isCurrentTrackInList && isPlaying) {
        pauseTrack();
      } else if (isCurrentTrackInList && !isPlaying) {
        resumeTrack();
      } else {
        // Начинаем воспроизведение с shuffle
        shuffleAndPlay(validTracks);
      }
    } catch (error) {
      console.error('PlayButton: Error handling play action:', error);
    }
  }, [
    hasValidTracks,
    disabled,
    isCurrentTrackInList,
    isPlaying,
    pauseTrack,
    resumeTrack,
    shuffleAndPlay,
    validTracks
  ]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  // ================================================================================
  // COMPUTED CLASSES WITH useMemo
  // ================================================================================

  const buttonClasses = useMemo(() => {
    const sizeClass = SIZE_CLASSES[size];
    const shadowClass = shouldRemoveShadow ? '' : 'shadow-lg hover:shadow-xl';
    const colorClass = 'bg-accent-color hover:bg-accent-color/90 text-black';
    
    return cn(BASE_CLASSES, sizeClass, shadowClass, colorClass, className);
  }, [size, shouldRemoveShadow, className]);

  const ariaLabel = useMemo(() => {
    if (variant === 'header') {
      return showPause ? 'Pause music' : 'Play random music';
    }
    return showPause ? 'Pause music' : 'Play music';
  }, [variant, showPause]);

  // ================================================================================
  // RENDER CONDITIONS
  // ================================================================================

  if (!hasValidTracks && !disabled) {
    console.warn('PlayButton: No valid tracks provided');
  }

  // ================================================================================
  // VARIANT RENDERERS
  // ================================================================================

  // Header variant
  if (variant === 'header') {
    return (
      <button
        className={cn(HEADER_CLASSES, className)}
        onClick={handlePlay}
        disabled={disabled || !hasValidTracks}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={ariaLabel}
        type="button"
      >
        <div className="w-5 h-5 flex items-center justify-center">
          {showPause ? (
            <PauseIcon iconSize="small" />
          ) : (
            <div className="w-0 h-0 border-l-[8px] border-l-black border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5" />
          )}
        </div>
        <span className="font-medium">
          {showPause ? 'Pause' : 'Play Random'}
        </span>
      </button>
    );
  }

  // Artist and Album variants
  if (variant === 'artist' || variant === 'album') {
    return (
      <button
        className={buttonClasses}
        onClick={handlePlay}
        disabled={disabled || !hasValidTracks}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={ariaLabel}
        type="button"
      >
        {showPause ? (
          <PauseIcon iconSize={size} />
        ) : (
          <PlayIcon iconSize={size} />
        )}
      </button>
    );
  }

  // Default variant - overlay button
  return (
    <button
      className={buttonClasses}
      onClick={handlePlay}
      disabled={disabled || !hasValidTracks}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={ariaLabel}
      type="button"
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
