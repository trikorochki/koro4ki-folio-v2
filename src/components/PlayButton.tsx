// src/components/PlayButton.tsx

'use client';

import { useState } from 'react';
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

export default function PlayButton({
  tracks,
  size = 'medium',
  variant = 'default',
  className,
  disabled = false,
  showText = false
}: PlayButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const {
    setQueue,
    playTrack,
    shuffleAndPlay,
    isPlaying,
    currentTrack,
    pauseTrack,
    resumeTrack
  } = useMusicPlayer();

  const handlePlay = (e?: React.MouseEvent) => {
    // Предотвращаем всплытие события для карточек артистов
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (tracks.length === 0 || disabled) return;

    // Проверяем, играет ли уже один из треков из этого списка
    const isCurrentTrackInList = currentTrack && tracks.some(track => track.id === currentTrack.id);

    if (isCurrentTrackInList && isPlaying) {
      pauseTrack();
    } else if (isCurrentTrackInList && !isPlaying) {
      resumeTrack();
    } else {
      // Начинаем воспроизведение с shuffle
      shuffleAndPlay(tracks);
    }
  };

  const sizeClasses = {
    small: 'w-8 h-8 text-xs',
    medium: 'w-12 h-12 text-sm',
    large: 'w-16 h-16 text-base'
  };

  // ✅ ИСПРАВЛЕНО: Унифицированные стили pause полос
  const iconSizes = {
    small: {
      play: 'border-l-[4px] border-l-black border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent',
      pauseHeight: '10px'
    },
    medium: {
      play: 'border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent',
      pauseHeight: '12px'
    },
    large: {
      play: 'border-l-[8px] border-l-black border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent',
      pauseHeight: '14px'
    }
  };

  // ✅ ДОБАВЛЕНО: Унифицированный компонент pause иконки
  const PauseIcon = ({ iconSize }: { iconSize: 'small' | 'medium' | 'large' }) => (
    <div className="flex items-center justify-center gap-0.5">
      <div 
        className="bg-black rounded-sm"
        style={{
          width: '2px',  // Унифицированная толщина для всех размеров
          height: iconSizes[iconSize].pauseHeight
        }}
      />
      <div 
        className="bg-black rounded-sm"
        style={{
          width: '2px',  // Унифицированная толщина для всех размеров
          height: iconSizes[iconSize].pauseHeight
        }}
      />
    </div>
  );

  // ✅ ИСПРАВЛЕНО: Улучшенные стили и transitions
  const baseClasses = "rounded-full flex items-center justify-center transition-all duration-150 font-bold";

  // Определяем, показывать ли иконку паузы
  const isCurrentTrackInList = currentTrack && tracks.some(track => track.id === currentTrack.id);
  const showPause = isCurrentTrackInList && isPlaying;

  // Определяем, нужно ли убирать тень для карточек артистов
  const shouldRemoveShadow = variant === 'default' && className?.includes('shadow-none');

  // Различные варианты кнопки

  if (variant === 'header') {
    return (
      <button
        className={cn(
          "flex items-center gap-3 bg-accent-color hover:bg-accent-color/90 border-none rounded-full px-6 py-3 text-black font-bold text-base cursor-pointer transition-all duration-150",
          "hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
          className
        )}
        onClick={handlePlay}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={showPause ? 'Pause music' : 'Play random music'}
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

  if (variant === 'artist' || variant === 'album') {
    return (
      <button
        className={cn(
          baseClasses,
          sizeClasses[size],
          shouldRemoveShadow ? '' : 'shadow-lg hover:shadow-xl',
          'bg-accent-color hover:bg-accent-color/90 text-black',
          className
        )}
        onClick={handlePlay}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={showPause ? 'Pause music' : 'Play music'}
      >
        {showPause ? (
          <PauseIcon iconSize={size} />
        ) : (
          <div className={cn('ml-1', iconSizes[size].play)} />
        )}
      </button>
    );
  }

  // Default variant - overlay button для карточек артистов
  return (
    <button
      className={cn(
        baseClasses,
        sizeClasses[size],
        shouldRemoveShadow ? '' : 'shadow-lg hover:shadow-xl',
        'bg-accent-color hover:bg-accent-color/90 text-black',
        className
      )}
      onClick={handlePlay}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={showPause ? 'Pause music' : 'Play music'}
    >
      {showPause ? (
        <PauseIcon iconSize={size} />
      ) : (
        <div className={cn('ml-1', iconSizes[size].play)} />
      )}
      
      {showText && (
        <span className="ml-2 font-medium">
          {showPause ? 'Pause' : 'Play'}
        </span>
      )}
    </button>
  );
}
