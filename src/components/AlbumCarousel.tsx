// src/components/AlbumCarousel.tsx
'use client';

import { useState, useCallback, useMemo, memo } from 'react';
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

// ================================================================================
// UTILITY FUNCTIONS WITH ENHANCED VALIDATION
// ================================================================================

function detectCyrillic(text?: string): boolean {
  if (!text) return false;
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Безопасная проверка наличия валидной обложки альбома
 */
function hasValidCover(album: Album): boolean {
  if (!album?.cover) return false;
  
  const cover = album.cover;
  return typeof cover === 'string' && 
         cover.trim() !== '' && 
         (cover.startsWith('http') || cover.startsWith('/') || cover.startsWith('blob:'));
}

/**
 * Вычисление общей длительности альбома в минутах
 */
function calculateAlbumDuration(tracks: any[]): number {
  return Math.floor(tracks.reduce((total, track) => {
    if (!track?.duration) return total;
    
    try {
      const [minutes, seconds] = track.duration.split(':').map(Number);
      if (isNaN(minutes) || isNaN(seconds)) return total;
      return total + minutes + (seconds / 60);
    } catch {
      return total;
    }
  }, 0));
}

// ================================================================================
// MEMOIZED COMPONENTS
// ================================================================================

const AlbumCoverPlaceholder = memo<{ title: string }>(({ title }) => (
  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
    <div className="text-center text-gray-400">
      <div className="text-4xl mb-2 opacity-60">🎵</div>
      <div className="text-xs px-2 font-medium truncate max-w-full">
        {title || 'Unknown Album'}
      </div>
    </div>
  </div>
));

AlbumCoverPlaceholder.displayName = 'AlbumCoverPlaceholder';

const AlbumCover = memo<{ 
  album: Album; 
  className?: string;
  width?: number;
  height?: number;
  onError: (albumId: string, coverUrl: string) => void;
  failedImages: Set<string>;
}>(({ 
  album, 
  className, 
  width = 200, 
  height = 200,
  onError,
  failedImages
}) => {
  const hasCover = hasValidCover(album) && !failedImages.has(album.id);
  
  if (!hasCover || !album.cover) {
    return (
      <div className={className}>
        <AlbumCoverPlaceholder title={album.title} />
      </div>
    );
  }

  return (
    <Image
      src={album.cover}
      alt={`${album.title || 'Unknown Album'} album cover`}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      onError={() => onError(album.id, album.cover || '')}  // ✅ Исправлено
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
});

AlbumCover.displayName = 'AlbumCover';

// ================================================================================
// MAIN COMPONENT WITH ENHANCED OPTIMIZATION
// ================================================================================

export default function AlbumCarousel({ 
  albums, 
  layout = 'vertical',
  showFullTrackList = true,
  maxTracksPreview = 5
}: AlbumCarouselProps) {
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { currentTrack, isPlaying } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED VALUES AND HANDLERS
  // ================================================================================

  const validAlbums = useMemo(() => {
    return albums.filter(album => album && album.id && album.title && Array.isArray(album.tracks));
  }, [albums]);

  const toggleAlbumExpansion = useCallback((albumId: string) => {
    setExpandedAlbums(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(albumId)) {
        newExpanded.delete(albumId);
      } else {
        newExpanded.add(albumId);
      }
      return newExpanded;
    });
  }, []);

  const handleImageError = useCallback((albumId: string, coverUrl: string) => {
    console.warn(`Failed to load album cover for ${albumId}: ${coverUrl}`);
    setFailedImages(prev => new Set(prev).add(albumId));
  }, []);

  const isCurrentAlbumPlaying = useCallback((album: Album) => {
    return album.tracks.some(track => 
      currentTrack?.id === track.id && isPlaying
    );
  }, [currentTrack, isPlaying]);

  // ================================================================================
  // RENDER CONDITIONS
  // ================================================================================

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

  if (validAlbums.length === 0) {
    return (
      <div className="text-center py-12 text-secondary-text-color">
        <div className="space-y-2">
          <div className="text-4xl opacity-50">⚠️</div>
          <p className="font-body text-lg">No valid albums found</p>
          <p className="font-body text-sm opacity-70">
            {albums.length} album{albums.length !== 1 ? 's' : ''} provided, but none are valid
          </p>
        </div>
      </div>
    );
  }

  // ================================================================================
  // HORIZONTAL LAYOUT
  // ================================================================================

  if (layout === 'horizontal') {
    return (
      <div className="overflow-x-auto pb-4" role="region" aria-label="Albums carousel">
        <div className="flex gap-6 min-w-max">
          {validAlbums.map((album) => {
            const isPlaying = isCurrentAlbumPlaying(album);
            const albumDuration = calculateAlbumDuration(album.tracks);

            return (
              <div 
                key={album.id} 
                className="bg-card-bg-color hover:bg-card-hover-bg-color rounded-lg p-4 transition-all duration-200 hover:scale-105 group min-w-[280px] max-w-[280px]"
                role="article"
                aria-label={`Album: ${album.title}`}
              >
                <div className="relative mb-4">
                  <AlbumCover
                    album={album}
                    className="w-full h-48 rounded-lg object-cover"
                    width={280}
                    height={192}
                    onError={handleImageError}
                    failedImages={failedImages}
                  />
                  
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayButton
                      tracks={album.tracks}
                      size="large"
                      variant="album"
                      className="shadow-lg"
                    />
                  </div>
                  
                  {isPlaying && (
                    <div className="absolute top-2 right-2 bg-accent-color text-black px-2 py-1 rounded text-xs font-bold animate-pulse">
                      PLAYING
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h3 className={`text-lg font-heading font-bold truncate ${
                    detectCyrillic(album.title) ? 'font-cyrillic' : ''
                  }`} title={album.title}>
                    {album.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-secondary-text-color text-xs font-body">
                    <span className="bg-accent-color/20 text-accent-color px-2 py-1 rounded text-xs font-bold">
                      {album.type || 'Album'}
                    </span>
                    <span>{album.tracks.length} track{album.tracks.length !== 1 ? 's' : ''}</span>
                    {albumDuration > 0 && (
                      <>
                        <span>•</span>
                        <span>{albumDuration} min</span>
                      </>
                    )}
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

  // ================================================================================
  // VERTICAL LAYOUT
  // ================================================================================

  return (
    <div className="space-y-8" role="region" aria-label="Albums list">
      {validAlbums.map((album) => {
        const isExpanded = expandedAlbums.has(album.id);
        const tracksToShow = isExpanded || showFullTrackList 
          ? album.tracks 
          : album.tracks.slice(0, maxTracksPreview);
        
        const isPlaying = isCurrentAlbumPlaying(album);
        const albumDuration = calculateAlbumDuration(album.tracks);

        return (
          <article 
            key={album.id} 
            className="bg-card-bg-color hover:bg-card-hover-bg-color rounded-lg p-6 transition-all duration-200 border border-transparent hover:border-accent-color/30"
            aria-label={`Album: ${album.title}`}
          >
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Album Cover */}
              <div className="flex-shrink-0 relative group">
                <AlbumCover
                  album={album}
                  className="w-48 h-48 rounded-lg object-cover shadow-lg"
                  width={200}
                  height={200}
                  onError={handleImageError}
                  failedImages={failedImages}
                />
                
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayButton
                    tracks={album.tracks}
                    size="large"
                    variant="album"
                    className="shadow-lg"
                  />
                </div>
                
                {isPlaying && (
                  <div className="absolute -top-2 -right-2 bg-accent-color text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                    PLAYING
                  </div>
                )}
              </div>
              
              {/* Album Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <h2 className={`text-2xl font-heading font-bold ${
                    detectCyrillic(album.title) ? 'font-cyrillic' : ''
                  }`}>
                    {album.title}
                  </h2>
                  
                  <div className="flex items-center gap-3">
                    <PlayButton
                      tracks={album.tracks}
                      size="medium"
                      variant="album"
                      className="flex-shrink-0"
                    />
                    
                    {!showFullTrackList && album.tracks.length > maxTracksPreview && (
                      <button
                        onClick={() => toggleAlbumExpansion(album.id)}
                        className="text-accent-color hover:text-green-400 font-bold text-sm transition-colors"
                        title={isExpanded ? "Show less tracks" : "Show all tracks"}
                        type="button"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "Show Less" : "Show All"}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Album Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-secondary-text-color text-sm mb-6 font-body">
                  <span className="bg-accent-color/20 text-accent-color px-3 py-1 rounded-full text-xs font-bold">
                    {album.type || 'Album'}
                  </span>
                  <span>{album.tracks.length} track{album.tracks.length !== 1 ? 's' : ''}</span>
                  {albumDuration > 0 && (
                    <>
                      <span>•</span>
                      <span>{albumDuration} min</span>
                    </>
                  )}
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
                      type="button"
                      aria-label={`Show ${album.tracks.length - maxTracksPreview} more tracks from ${album.title}`}
                    >
                      Show {album.tracks.length - maxTracksPreview} more track{(album.tracks.length - maxTracksPreview) !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
