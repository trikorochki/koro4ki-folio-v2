// src/components/AlbumCarousel.tsx
'use client';

import { useState } from 'react';
import { Album } from '@/types/music';
import Image from 'next/image';
import TrackList from './TrackList';
import PlayButton from './PlayButton';
import { useMusicPlayer } from '@/lib/music-player';

interface AlbumCarouselProps {
  albums: Album[];
  layout?: 'vertical' | 'horizontal';
  showFullTrackList?: boolean;
  maxTracksPreview?: number;
}

// Функция для определения кириллицы
function detectCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

// ✅ ДОБАВЛЕНО: Функция для проверки валидности обложки
function hasValidCover(album: Album): boolean {
  return album.cover !== undefined && 
         album.cover !== null && 
         album.cover.trim() !== '';
}

// ✅ ДОБАВЛЕНО: Компонент placeholder для отсутствующих обложек
const AlbumCoverPlaceholder = ({ title }: { title: string }) => (
  <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
    <div className="text-center text-gray-400">
      <div className="text-4xl mb-2">🎵</div>
      <div className="text-xs px-2">{title}</div>
    </div>
  </div>
);

export default function AlbumCarousel({ 
  albums, 
  layout = 'vertical',
  showFullTrackList = true,
  maxTracksPreview = 5
}: AlbumCarouselProps) {
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { currentTrack, isPlaying } = useMusicPlayer();

  const toggleAlbumExpansion = (albumId: string) => {
    const newExpanded = new Set(expandedAlbums);
    if (newExpanded.has(albumId)) {
      newExpanded.delete(albumId);
    } else {
      newExpanded.add(albumId);
    }
    setExpandedAlbums(newExpanded);
  };

  // ✅ ДОБАВЛЕНО: Обработчик ошибок загрузки изображений
  const handleImageError = (albumId: string, coverUrl: string) => {
    console.warn(`Failed to load album cover for ${albumId}: ${coverUrl}`);
    setFailedImages(prev => new Set(prev).add(albumId));
  };

  // ✅ ДОБАВЛЕНО: Компонент обложки альбома с fallback логикой
  const AlbumCover = ({ 
    album, 
    className, 
    width = 200, 
    height = 200 
  }: { 
    album: Album; 
    className?: string;
    width?: number;
    height?: number;
  }) => {
    const hasCover = hasValidCover(album) && !failedImages.has(album.id);
    
    if (!hasCover) {
      return (
        <div className={className}>
          <AlbumCoverPlaceholder title={album.title} />
        </div>
      );
    }

    return (
      <Image
        src={album.cover!} // Используем ! так как проверили выше
        alt={`${album.title} album cover`}
        width={width}
        height={height}
        className={className}
        loading="lazy"
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
        onError={() => handleImageError(album.id, album.cover!)}
      />
    );
  };

  if (albums.length === 0) {
    return (
      <div className="text-center py-12 text-secondary-text-color">
        <div className="space-y-2">
          <div className="text-4xl opacity-50">🎵</div>
          <p className="font-body text-lg">No albums available</p>
          <p className="font-body text-sm opacity-70">Check back later for new releases</p>
        </div>
      </div>
    );
  }

  if (layout === 'horizontal') {
    return (
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {albums.map((album) => {
            const isCurrentAlbumPlaying = album.tracks.some(track => 
              currentTrack?.id === track.id && isPlaying
            );

            return (
              <div 
                key={album.id} 
                className="bg-card-bg-color hover:bg-card-hover-bg-color rounded-lg p-4 transition-all duration-200 hover:scale-105 group min-w-[280px] max-w-[280px]"
              >
                <div className="relative mb-4">
                  {/* ✅ ИСПРАВЛЕНО: Используем компонент AlbumCover */}
                  <AlbumCover
                    album={album}
                    className="w-full h-48 rounded-lg object-cover"
                    width={280}
                    height={192}
                  />
                  
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayButton
                      tracks={album.tracks}
                      size="large"
                      variant="album"
                      className="shadow-lg"
                    />
                  </div>
                  {isCurrentAlbumPlaying && (
                    <div className="absolute top-2 right-2 bg-accent-color text-black px-2 py-1 rounded text-xs font-bold">
                      PLAYING
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className={`text-lg font-heading font-bold truncate ${
                    detectCyrillic(album.title) ? 'font-cyrillic' : ''
                  }`}>
                    {album.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-secondary-text-color text-xs font-body">
                    <span className="bg-accent-color/20 text-accent-color px-2 py-1 rounded text-xs font-bold">
                      {album.type}
                    </span>
                    <span>{album.tracks.length} tracks</span>
                  </div>
                  
                  <div className="text-secondary-text-color text-xs font-body">
                    {album.tracks.slice(0, 3).map(track => track.title).join(' • ')}
                    {album.tracks.length > 3 && '...'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vertical layout (default)
  return (
    <div className="space-y-8">
      {albums.map((album) => {
        const isExpanded = expandedAlbums.has(album.id);
        const tracksToShow = isExpanded || showFullTrackList 
          ? album.tracks 
          : album.tracks.slice(0, maxTracksPreview);
        
        const isCurrentAlbumPlaying = album.tracks.some(track => 
          currentTrack?.id === track.id && isPlaying
        );

        return (
          <div 
            key={album.id} 
            className="bg-card-bg-color hover:bg-card-hover-bg-color rounded-lg p-6 transition-all duration-200 border border-transparent hover:border-accent-color/30"
          >
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Album Cover */}
              <div className="flex-shrink-0 relative group">
                {/* ✅ ИСПРАВЛЕНО: Используем компонент AlbumCover */}
                <AlbumCover
                  album={album}
                  className="w-48 h-48 rounded-lg object-cover shadow-lg"
                  width={200}
                  height={200}
                />
                
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayButton
                    tracks={album.tracks}
                    size="large"
                    variant="album"
                    className="shadow-lg"
                  />
                </div>
                {isCurrentAlbumPlaying && (
                  <div className="absolute -top-2 -right-2 bg-accent-color text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    PLAYING
                  </div>
                )}
              </div>
              
              {/* Album Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <h3 className={`text-2xl font-heading font-bold ${
                    detectCyrillic(album.title) ? 'font-cyrillic' : ''
                  }`}>
                    {album.title}
                  </h3>
                  
                  <div className="flex items-center gap-3">
                    <PlayButton
                      tracks={album.tracks}
                      size="medium"
                      variant="album"
                      className="flex-shrink-0"
                    />
                    
                    <button
                      onClick={() => toggleAlbumExpansion(album.id)}
                      className="text-accent-color hover:text-green-400 font-bold text-sm transition-colors"
                      title={isExpanded ? "Show less" : "Show all tracks"}
                    >
                      {isExpanded ? "Show Less" : "Show All"}
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-secondary-text-color text-sm mb-6 font-body">
                  <span className="bg-accent-color/20 text-accent-color px-3 py-1 rounded-full text-xs font-bold">
                    {album.type}
                  </span>
                  <span>{album.tracks.length} tracks</span>
                  <span>•</span>
                  <span>
                    {Math.floor(album.tracks.reduce((total, track) => {
                      const [minutes, seconds] = track.duration.split(':').map(Number);
                      return total + minutes + (seconds / 60);
                    }, 0))} min
                  </span>
                </div>
                
                {/* Track List */}
                <div className="space-y-2">
                  <TrackList 
                    tracks={tracksToShow} 
                    compact={!showFullTrackList}
                  />
                  
                  {!showFullTrackList && album.tracks.length > maxTracksPreview && !isExpanded && (
                    <button
                      onClick={() => toggleAlbumExpansion(album.id)}
                      className="w-full py-3 text-accent-color hover:text-green-400 hover:bg-card-hover-bg-color rounded transition-colors font-bold"
                    >
                      Show {album.tracks.length - maxTracksPreview} more tracks
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
