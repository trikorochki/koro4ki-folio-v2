// src/components/TrackList.tsx
'use client';

import { Track } from '@/types/music';
import { useMusicPlayer } from '@/lib/music-player';

interface TrackListProps {
  tracks: Track[];
  showAlbumInfo?: boolean;
  compact?: boolean;
}

// Функция для определения кириллицы
function detectCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export default function TrackList({ tracks, showAlbumInfo = false, compact = false }: TrackListProps) {
  const { currentTrack, isPlaying, playTrack, pauseTrack, setQueue } = useMusicPlayer();

  const handleTrackClick = (track: Track) => {
    // Устанавливаем очередь из текущего списка треков
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
  };

  const handleDoubleClick = (track: Track) => {
    // При двойном клике всегда начинаем воспроизведение
    setQueue(tracks);
    playTrack(track);
  };

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 text-secondary-text-color">
        <p className="font-body">No tracks available</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tracks.map((track, index) => {
        const isActive = currentTrack?.id === track.id;
        const isCurrentlyPlaying = isActive && isPlaying;

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
            title={`${track.title} - ${track.duration}`}
          >
            {/* Track Number / Play State */}
            <div className="w-8 h-8 flex items-center justify-center text-sm font-bold">
              {isCurrentlyPlaying ? (
                <div className="flex gap-0.5 items-end">
                  <div className="w-0.5 h-3 bg-current equalizer-bar animation-delay-0" />
                  <div className="w-0.5 h-4 bg-current equalizer-bar animation-delay-100" />
                  <div className="w-0.5 h-2 bg-current equalizer-bar animation-delay-200" />
                  <div className="w-0.5 h-3 bg-current equalizer-bar animation-delay-300" />
                </div>
              ) : isActive ? (
                <div className="w-0 h-0 border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
              ) : (
                <span className={`transition-colors ${
                  isActive ? 'text-black' : 'text-secondary-text-color group-hover:text-primary-text-color'
                }`}>
                  {track.number}
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
                {track.title}
              </h4>
              
              {!compact && (
                <p className={`text-xs truncate transition-colors ${
                  isActive ? 'text-black/70' : 'text-secondary-text-color'
                } ${
                  detectCyrillic(track.originalTitle) ? 'font-cyrillic' : 'font-body'
                }`}>
                  {track.originalTitle !== track.title ? track.originalTitle : `Track ${track.number}`}
                </p>
              )}
              
              {showAlbumInfo && (
                <p className={`text-xs truncate transition-colors ${
                  isActive ? 'text-black/50' : 'text-secondary-text-color/70'
                } font-body`}>
                  Album • {track.albumId}
                </p>
              )}
            </div>

            {/* Duration */}
            <div className={`text-sm font-mono transition-colors ${
              isActive ? 'text-black/70' : 'text-secondary-text-color group-hover:text-primary-text-color'
            }`}>
              {track.duration}
            </div>

            {/* Hover Play Button */}
            {!isActive && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDoubleClick(track);
                  }}
                  className="w-8 h-8 bg-accent-color hover:bg-green-400 text-black rounded-full flex items-center justify-center transition-all hover:scale-110"
                  title="Play track"
                >
                  <div className="w-0 h-0 border-l-[6px] border-l-black border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent ml-0.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
