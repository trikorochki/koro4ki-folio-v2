// src/components/TrackList.tsx
'use client';

import { useMemo, useCallback } from 'react';
import { Track } from '@/types/music';
import { useMusicPlayer } from '@/lib/music-player';

interface TrackListProps {
  tracks: Track[];
  showAlbumInfo?: boolean;
  compact?: boolean;
  showArtist?: boolean;
}

// ================================================================================
// UTILITY FUNCTIONS WITH SAFE DATA HANDLING
// ================================================================================

function detectCyrillic(text?: string): boolean {
  if (!text) return false;
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Безопасное получение номера трека с обработкой опциональных данных
 */
function getTrackNumber(track: Track, index: number): string {
  // Проверяем track.number (новое поле из интерфейса)
  if (track.number !== undefined && track.number !== null) {
    return track.number.toString();
  }
  
  // Проверяем metadata.number
  if (track.metadata?.number !== undefined && track.metadata?.number !== null) {
    return track.metadata.number.toString();
  }
  
  // Пытаемся извлечь из имени файла
  if (track.metadata?.fileName) {
    const numberMatch = track.metadata.fileName.match(/^(\d{1,2})\./);
    if (numberMatch) {
      return numberMatch[1];
    }
  }
  
  // Пытаемся извлечь из заголовка
  const titleNumberMatch = track.title?.match(/^(\d{1,2})\.\s*/);
  if (titleNumberMatch) {
    return titleNumberMatch[1];
  }
  
  // Fallback к индексу
  return (index + 1).toString();
}

/**
 * Безопасное получение оригинального названия трека
 */
function getOriginalTitle(track: Track): string | undefined {
  // Проверяем track.originalTitle (новое поле из интерфейса)
  if (track.originalTitle) {
    return track.originalTitle;
  }
  
  // Проверяем metadata.originalTitle
  if (track.metadata?.originalTitle) {
    return track.metadata.originalTitle;
  }
  
  // Пытаемся очистить название от номера
  if (!track.title) return undefined;
  
  const cleanTitle = track.title.replace(/^\d{1,2}[\s.\-_]*/, '').trim();
  if (cleanTitle !== track.title && cleanTitle.length > 0) {
    return cleanTitle;
  }
  
  return undefined;
}

/**
 * Безопасное получение названия альбома
 */
function getAlbumName(track: Track): string {
  // Проверяем прямое поле albumName
  if (track.albumName) {
    return track.albumName;
  }
  
  // ❌ УБРАТЬ: Это поле не существует в типе metadata
  // if (track.metadata?.album) {
  //   return track.metadata.album;
  // }
  
  // ✅ ЗАМЕНИТЬ: Пытаемся извлечь из имени файла
  if (track.metadata?.fileName) {
    // Извлекаем название альбома из пути файла
    const pathParts = track.metadata.fileName.split('/');
    if (pathParts.length > 1) {
      // Берем предпоследнюю часть пути как название альбома
      const albumFromPath = pathParts[pathParts.length - 2];
      if (albumFromPath && albumFromPath !== '') {
        return albumFromPath.replace(/_/g, ' ');
      }
    }
  }
  
  // Извлекаем из ID трека
  if (track.id) {
    const parts = track.id.split('_');
    if (parts.length >= 3) {
      return parts.slice(1, -1).join(' ').replace(/_/g, ' ');
    }
  }
  
  return 'Unknown Album';
}


// ================================================================================
// MAIN COMPONENT
// ================================================================================

export default function TrackList({ 
  tracks, 
  showAlbumInfo = false, 
  compact = false,
  showArtist = false 
}: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, pauseTrack, setQueue } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED HANDLERS
  // ================================================================================

  const handleTrackClick = useCallback((track: Track) => {
    if (!track?.id) {
      console.warn('TrackList: Invalid track for click handler', track);
      return;
    }

    try {
      setQueue(tracks);
      
      if (currentTrack?.id === track.id) {
        if (isPlaying) {
          pauseTrack();
        } else {
          playTrack(track);
        }
      } else {
        playTrack(track);
      }
    } catch (error) {
      console.error('TrackList: Error handling track click:', error);
    }
  }, [tracks, currentTrack, isPlaying, playTrack, pauseTrack, setQueue]);

  const handleDoubleClick = useCallback((track: Track) => {
    if (!track?.id) {
      console.warn('TrackList: Invalid track for double click handler', track);
      return;
    }

    try {
      setQueue(tracks);
      playTrack(track);
    } catch (error) {
      console.error('TrackList: Error handling track double click:', error);
    }
  }, [tracks, playTrack, setQueue]);

  const handlePlayButtonClick = useCallback((e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    handleDoubleClick(track);
  }, [handleDoubleClick]);

  // ================================================================================
  // MEMOIZED VALUES
  // ================================================================================

  const validTracks = useMemo(() => {
    return tracks.filter(track => track && track.id && track.title);
  }, [tracks]);

  const trackElements = useMemo(() => {
    return validTracks.map((track, index) => {
      const isActive = currentTrack?.id === track.id;
      const isCurrentlyPlaying = isActive && isPlaying;
      const trackNumber = getTrackNumber(track, index);
      const originalTitle = getOriginalTitle(track);
      const albumName = getAlbumName(track);

      return (
        <div
          key={track.id}
          onClick={() => handleTrackClick(track)}
          onDoubleClick={() => handleDoubleClick(track)}
          className={`group flex items-center gap-4 ${compact ? 'p-2' : 'p-3'} rounded cursor-pointer transition-all duration-200 ${
            isActive
              ? 'bg-accent-color text-black shadow-lg'
              : 'hover:bg-card-hover-bg-color hover:scale-[1.01]'
          }`}
          title={`${track.title}${track.duration ? ` - ${track.duration}` : ''}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTrackClick(track);
            }
          }}
          aria-label={`${isCurrentlyPlaying ? 'Pause' : 'Play'} track: ${track.title}`}
        >
          {/* Track Number / Play Indicator */}
          <div className="w-8 h-8 flex items-center justify-center text-sm font-bold">
            {isCurrentlyPlaying ? (
              <div className="flex gap-0.5 items-end" aria-label="Playing">
                <div className="w-0.5 h-3 bg-current equalizer-bar" style={{ animationDelay: '0s' }} />
                <div className="w-0.5 h-4 bg-current equalizer-bar" style={{ animationDelay: '0.1s' }} />
                <div className="w-0.5 h-2 bg-current equalizer-bar" style={{ animationDelay: '0.2s' }} />
                <div className="w-0.5 h-3 bg-current equalizer-bar" style={{ animationDelay: '0.3s' }} />
              </div>
            ) : isActive ? (
              <div 
                className="w-0 h-0 border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5"
                aria-label="Paused"
              />
            ) : (
              <span className={`transition-colors ${
                isActive ? 'text-black' : 'text-secondary-text-color group-hover:text-primary-text-color'
              }`}>
                {trackNumber}
              </span>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h4 className={`font-bold truncate transition-colors ${
              compact ? 'text-sm' : 'text-base'
            } ${
              detectCyrillic(track.title) ? 'font-cyrillic' : 'font-body'
            }`}>
              {track.title || 'Unknown Track'}
            </h4>
            
            {!compact && (
              <p className={`text-xs truncate transition-colors ${
                isActive ? 'text-black/70' : 'text-secondary-text-color'
              } ${
                detectCyrillic(originalTitle || '') ? 'font-cyrillic' : 'font-body'
              }`}>
                {originalTitle || `Track ${trackNumber}`}
              </p>
            )}
            
            {showArtist && (
              <p className={`text-xs truncate transition-colors ${
                isActive ? 'text-black/50' : 'text-secondary-text-color/70'
              } font-body`}>
                {track.artistId || 'Unknown Artist'}
              </p>
            )}
            
            {showAlbumInfo && (
              <p className={`text-xs truncate transition-colors ${
                isActive ? 'text-black/50' : 'text-secondary-text-color/70'
              } font-body`}>
                {albumName}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className={`text-sm font-mono transition-colors ${
            isActive ? 'text-black/70' : 'text-secondary-text-color group-hover:text-primary-text-color'
          }`}>
            {track.duration || '--:--'}
          </div>

          {/* Hover Play Button */}
          {!isActive && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handlePlayButtonClick(e, track)}
                className="w-8 h-8 bg-accent-color hover:bg-green-400 text-black rounded-full flex items-center justify-center transition-all hover:scale-110"
                title="Play track"
                aria-label={`Play ${track.title}`}
                type="button"
              >
                <div className="w-0 h-0 border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
              </button>
            </div>
          )}
        </div>
      );
    });
  }, [
    validTracks, 
    currentTrack, 
    isPlaying, 
    compact, 
    showArtist, 
    showAlbumInfo, 
    handleTrackClick, 
    handleDoubleClick, 
    handlePlayButtonClick
  ]);

  // ================================================================================
  // RENDER CONDITIONS
  // ================================================================================

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 text-secondary-text-color">
        <div className="space-y-2">
          <div className="text-4xl opacity-50">🎵</div>
          <p className="font-body">No tracks available</p>
        </div>
      </div>
    );
  }

  if (validTracks.length === 0) {
    return (
      <div className="text-center py-8 text-secondary-text-color">
        <div className="space-y-2">
          <div className="text-4xl opacity-50">⚠️</div>
          <p className="font-body">No valid tracks found</p>
          <p className="text-xs opacity-70">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} provided, but none are valid
          </p>
        </div>
      </div>
    );
  }

  // ================================================================================
  // MAIN RENDER
  // ================================================================================

  return (
    <>
      <div className="space-y-1" role="list" aria-label="Track list">
        {trackElements}
      </div>

      {/* Enhanced CSS Animation Styles */}
      <style jsx>{`
        .equalizer-bar {
          animation: equalizer 1.2s ease-in-out infinite;
          transform-origin: bottom;
        }
        
        @keyframes equalizer {
          0%, 100% {
            transform: scaleY(1);
          }
          25% {
            transform: scaleY(0.3);
          }
          50% {
            transform: scaleY(0.8);
          }
          75% {
            transform: scaleY(0.6);
          }
        }

        /* Улучшенная анимация для более реалистичного эквалайзера */
        @media (prefers-reduced-motion: no-preference) {
          .equalizer-bar:nth-child(1) {
            animation-duration: 1s;
          }
          .equalizer-bar:nth-child(2) {
            animation-duration: 1.3s;
          }
          .equalizer-bar:nth-child(3) {
            animation-duration: 0.9s;
          }
          .equalizer-bar:nth-child(4) {
            animation-duration: 1.1s;
          }
        }

        /* Остановка анимации при предпочтении уменьшенного движения */
        @media (prefers-reduced-motion: reduce) {
          .equalizer-bar {
            animation: none;
            transform: scaleY(0.8);
          }
        }
      `}</style>
    </>
  );
}
