// src/components/ArtistGrid.tsx
'use client';

import { Artist } from '@/types/music';
import Link from 'next/link';
import Image from 'next/image';
import PlayButton from './PlayButton';
import { useMusicPlayer } from '@/lib/music-player';

interface ArtistGridProps {
  artists: Artist[];
}

function hasValidAvatar(artist: Artist): boolean {
  return artist.avatar !== undefined && 
         artist.avatar !== null && 
         artist.avatar.trim() !== '';
}

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

const ArtistAvatarPlaceholder = ({ name }: { name: string }) => {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500', 
    'from-green-500 to-teal-500',
    'from-yellow-500 to-orange-500',
    'from-red-500 to-pink-500',
    'from-indigo-500 to-purple-500'
  ];
  
  const colorIndex = name.charCodeAt(0) % colors.length;
  const bgGradient = colors[colorIndex];
  
  return (
    <div className={`w-full h-full bg-gradient-to-br ${bgGradient} flex items-center justify-center`}>
      <div className="text-white text-4xl font-bold drop-shadow-lg">
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
};

const ArtistAvatar = ({ 
  artist, 
  className,
  priority = false 
}: { 
  artist: Artist; 
  className?: string;
  priority?: boolean;
}) => {
  const avatarSrc = getArtistAvatar(artist);
  const isDefaultAvatar = !hasValidAvatar(artist);

  if (isDefaultAvatar) {
    return (
      <div className={className}>
        <ArtistAvatarPlaceholder name={artist.name} />
      </div>
    );
  }

  return (
    <Image
      src={avatarSrc}
      alt={`Аватар ${artist.name}`}
      width={192}
      height={192}
      className={className}
      priority={priority}
      onError={(e) => {
        console.warn(`Failed to load avatar for ${artist.name}: ${avatarSrc}`);
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const placeholder = target.parentElement?.querySelector('.avatar-placeholder');
        if (placeholder) {
          placeholder.classList.remove('hidden');
        }
      }}
    />
  );
};

export default function ArtistGrid({ artists }: ArtistGridProps) {
  const { currentTrack, isPlaying } = useMusicPlayer();

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

  return (
    <div className="artist-choice-container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {artists.map((artist) => {
        const albums = artist.Albums || [];
        const eps = artist.EPs || [];
        const demos = artist.Demos || [];
        
        const allTracks = [...albums, ...eps, ...demos]
          .flatMap(album => album.tracks || []);
        
        const isCurrentArtistPlaying = currentTrack && allTracks.some(track => 
          track.id === currentTrack.id
        ) && isPlaying;

        return (
          <Link
            key={artist.id}
            href={`/artist/${artist.id}`}
            className="artist-choice-card bg-card-bg-color rounded-lg p-6 hover:bg-card-hover-bg-color transition-all duration-300 group hover:transform hover:scale-[1.02] block cursor-pointer relative overflow-hidden"
          >
            <div className="flex flex-col items-center text-center h-full justify-center">
              <div className="artist-image-container relative w-48 h-48 mb-4 rounded-full overflow-hidden flex-shrink-0">
                
                <ArtistAvatar
                  artist={artist}
                  className="w-full h-full object-cover"
                  priority={artists.indexOf(artist) < 3}
                />
                
                <div className="avatar-placeholder hidden absolute inset-0">
                  <ArtistAvatarPlaceholder name={artist.name} />
                </div>
                
                <div 
                  className="hover-overlay absolute inset-0 flex items-center justify-center rounded-full overflow-hidden transition-colors duration-300"
                  style={{
                    backgroundColor: 'transparent'
                  }}
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <PlayButton
                      tracks={allTracks}
                      size="large"
                      variant="default"
                      className="shadow-none"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-center max-w-full">
                <h3 className="text-xl font-heading font-bold mb-2 text-primary-text-color group-hover:text-accent-color transition-colors leading-tight text-center">
                  {artist.name}
                </h3>
                
                {artist.descriptionLine1 && (
                  <p className={`text-secondary-text-color text-sm line-clamp-3 leading-relaxed text-center ${
                    detectCyrillic(artist.descriptionLine1) ? 'font-cyrillic' : 'font-body'
                  }`}>
                    {artist.descriptionLine1}
                  </p>
                )}
                
                {!artist.descriptionLine1 && (
                  <p className="text-secondary-text-color text-sm line-clamp-3 leading-relaxed text-center font-body opacity-70">
                    Musical artist
                  </p>
                )}
              </div>
            </div>

            <style jsx>{`
              .artist-choice-card:hover .hover-overlay {
                background-color: rgba(0, 0, 0, 0.4) !important;
              }
            `}</style>
          </Link>
        );
      })}
    </div>
  );
}
