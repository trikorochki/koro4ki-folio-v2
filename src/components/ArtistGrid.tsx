// src/components/ArtistGrid.tsx
'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { Artist } from '@/types/music';
import Link from 'next/link';
import Image from 'next/image';
import PlayButton from './PlayButton';
import { useMusicPlayer } from '@/lib/music-player';

interface ArtistGridProps {
  artists: Artist[];
}

// ================================================================================
// UTILITY FUNCTIONS WITH ENHANCED VALIDATION
// ================================================================================

/**
 * Безопасная проверка наличия валидного аватара артиста
 */
function hasValidAvatar(artist: Artist): boolean {
  if (!artist?.avatar) return false;
  
  const avatar = artist.avatar;
  return typeof avatar === 'string' && 
         avatar.trim() !== '' && 
         (avatar.startsWith('http') || avatar.startsWith('/') || avatar.startsWith('blob:'));
}

/**
 * Получение URL аватара с fallback на default изображение
 */
function getArtistAvatar(artist: Artist): string {
  if (hasValidAvatar(artist)) {
    return artist.avatar!;
  }
  return '/images/default-artist-avatar.jpg';
}

function detectCyrillic(text?: string): boolean {
  if (!text) return false;
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Безопасное получение описания артиста
 */
function getArtistDescription(artist: Artist): string | null {
  // Проверяем artist.descriptionLine1 (может отсутствовать в типе)
  if (artist.descriptionLine1) {
    return artist.descriptionLine1;
  }
  
  // Fallback к другим возможным полям описания
  if ('description' in artist && artist.description) {
    return artist.description as string;
  }
  
  if ('bio' in artist && artist.bio) {
    return artist.bio as string;
  }
  
  return null;
}

// ================================================================================
// MEMOIZED COMPONENTS
// ================================================================================

const ArtistAvatarPlaceholder = memo<{ name: string }>(({ name }) => {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500', 
    'from-green-500 to-teal-500',
    'from-yellow-500 to-orange-500',
    'from-red-500 to-pink-500',
    'from-indigo-500 to-purple-500'
  ];
  
  const colorIndex = (name || 'A').charCodeAt(0) % colors.length;
  const bgGradient = colors[colorIndex];
  const initial = (name || 'A').charAt(0).toUpperCase();
  
  return (
    <div className={`w-full h-full bg-gradient-to-br ${bgGradient} flex items-center justify-center rounded-full`}>
      <div className="text-white text-4xl font-bold drop-shadow-lg">
        {initial}
      </div>
    </div>
  );
});

ArtistAvatarPlaceholder.displayName = 'ArtistAvatarPlaceholder';

const ArtistAvatar = memo<{ 
  artist: Artist; 
  className?: string;
  priority?: boolean;
  onError: (artistId: string, avatarUrl: string) => void;
  failedImages: Set<string>;
}>(({ 
  artist, 
  className,
  priority = false,
  onError,
  failedImages
}) => {
  const avatarSrc = getArtistAvatar(artist);
  const hasAvatar = hasValidAvatar(artist) && !failedImages.has(artist.id);

  if (!hasAvatar || !artist.avatar) {
    return (
      <div className={className}>
        <ArtistAvatarPlaceholder name={artist.name} />
      </div>
    );
  }

  return (
    <Image
      src={avatarSrc}
      alt={`${artist.name || 'Unknown Artist'} avatar`}
      width={192}
      height={192}
      className={className}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      onError={() => artist.avatar && onError(artist.id, artist.avatar)}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
});

ArtistAvatar.displayName = 'ArtistAvatar';

// ================================================================================
// MAIN COMPONENT WITH ENHANCED OPTIMIZATION
// ================================================================================

export default function ArtistGrid({ artists }: ArtistGridProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { currentTrack, isPlaying } = useMusicPlayer();

  // ================================================================================
  // MEMOIZED VALUES AND HANDLERS
  // ================================================================================

  const validArtists = useMemo(() => {
    return artists.filter(artist => artist && artist.id && artist.name);
  }, [artists]);

  const handleImageError = useCallback((artistId: string, avatarUrl: string) => {
    console.warn(`Failed to load avatar for artist ${artistId}: ${avatarUrl}`);
    setFailedImages(prev => new Set(prev).add(artistId));
  }, []);

  const isCurrentArtistPlaying = useCallback((artist: Artist) => {
    if (!currentTrack || !isPlaying) return false;
    
    const albums = artist.Albums || [];
    const eps = artist.EPs || [];
    const demos = artist.Demos || [];
    
    const allTracks = [...albums, ...eps, ...demos]
      .flatMap(album => album?.tracks || []);
    
    return allTracks.some(track => track?.id === currentTrack.id);
  }, [currentTrack, isPlaying]);

  const artistElements = useMemo(() => {
    return validArtists.map((artist, index) => {
      const albums = artist.Albums || [];
      const eps = artist.EPs || [];
      const demos = artist.Demos || [];
      
      const allTracks = [...albums, ...eps, ...demos]
        .flatMap(album => album?.tracks || [])
        .filter(track => track && track.id && track.title);
      
      const isPlaying = isCurrentArtistPlaying(artist);
      const description = getArtistDescription(artist);

      return (
        <Link
          key={artist.id}
          href={`/artist/${artist.id}`}
          className="artist-choice-card bg-card-bg-color rounded-lg p-6 hover:bg-card-hover-bg-color transition-all duration-300 group hover:transform hover:scale-[1.02] block cursor-pointer relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent-color focus:ring-offset-2 focus:ring-offset-background-color"
          aria-label={`View ${artist.name} artist page`}
        >
          <article className="flex flex-col items-center text-center h-full justify-center">
            {/* Artist Avatar Section */}
            <div className="artist-image-container relative w-48 h-48 mb-4 rounded-full overflow-hidden flex-shrink-0">
              <ArtistAvatar
                artist={artist}
                className="w-full h-full object-cover rounded-full"
                priority={index < 3}
                onError={handleImageError}
                failedImages={failedImages}
              />
              
              {/* Hover Overlay with Play Button */}
              <div className="hover-overlay absolute inset-0 flex items-center justify-center rounded-full overflow-hidden transition-all duration-300 bg-transparent group-hover:bg-black/40">
                {allTracks.length > 0 && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <PlayButton
                      tracks={allTracks}
                      size="large"
                      variant="artist"
                      className="shadow-lg"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Artist Info */}
            <div className="flex flex-col items-center max-w-full">
              <h3 className="text-xl font-heading font-bold mb-2 text-primary-text-color group-hover:text-accent-color transition-colors leading-tight text-center">
                {artist.name}
              </h3>
              
              {description ? (
                <p className={`text-secondary-text-color text-sm line-clamp-3 leading-relaxed text-center ${
                  detectCyrillic(description) ? 'font-cyrillic' : 'font-body'
                }`}>
                  {description}
                </p>
              ) : (
                <p className="text-secondary-text-color text-sm line-clamp-3 leading-relaxed text-center font-body opacity-70">
                  Musical artist
                </p>
              )}
            </div>
          </article>
        </Link>
      );
    });
  }, [validArtists, isCurrentArtistPlaying, handleImageError, failedImages]);

  // ================================================================================
  // RENDER CONDITIONS
  // ================================================================================

  if (artists.length === 0) {
    return (
      <div className="text-center py-12 text-secondary-text-color">
        <div className="space-y-4">
          <div className="text-6xl opacity-50">🎵</div>
          <h3 className="text-xl font-heading font-bold">No Artists Available</h3>
          <p className="font-body">Check back later for new artists and music</p>
        </div>
      </div>
    );
  }

  if (validArtists.length === 0) {
    return (
      <div className="text-center py-12 text-secondary-text-color">
        <div className="space-y-4">
          <div className="text-6xl opacity-50">⚠️</div>
          <h3 className="text-xl font-heading font-bold">No Valid Artists Found</h3>
          <p className="font-body">
            {artists.length} artist{artists.length !== 1 ? 's' : ''} provided, but none are valid
          </p>
        </div>
      </div>
    );
  }

  // ================================================================================
  // MAIN RENDER
  // ================================================================================

  return (
    <div 
      className="artist-choice-container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
      role="grid" 
      aria-label="Artist grid"
    >
      {artistElements}
    </div>
  );
}
