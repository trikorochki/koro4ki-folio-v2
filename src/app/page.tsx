// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import ArtistGrid from '@/components/ArtistGrid';
import { PlaylistData, Artist } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';

export default function HomePage() {
  const [playlistData, setPlaylistData] = useState<PlaylistData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaylistData = async () => {
      try {
        const response = await fetch('/api/playlist');
        if (response.ok) {
          const data = await response.json();
          
          const filteredData: PlaylistData = {};
          Object.keys(ARTIST_DATA).forEach(artistId => {
            if (data[artistId]) {
              filteredData[artistId] = data[artistId];
            } else {
              const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
              filteredData[artistId] = {
                id: artistId,
                name: artistInfo.name,
                avatar: artistInfo.avatar,
                descriptionLine1: artistInfo.descriptionLine1,
                descriptionLine2: artistInfo.descriptionLine2,
                socialLinks: artistInfo.socialLinks,
                Albums: [],
                EPs: [],
                Demos: [],
              };
            }
          });
          
          setPlaylistData(filteredData);
        }
      } catch (error) {
        console.error('Error fetching playlist data:', error);
        
        const fallbackData: PlaylistData = {};
        Object.keys(ARTIST_DATA).forEach(artistId => {
          const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
          fallbackData[artistId] = {
            id: artistId,
            name: artistInfo.name,
            avatar: artistInfo.avatar,
            descriptionLine1: artistInfo.descriptionLine1,
            descriptionLine2: artistInfo.descriptionLine2,
            socialLinks: artistInfo.socialLinks,
            Albums: [],
            EPs: [],
            Demos: [],
          };
        });
        
        setPlaylistData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylistData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-color mx-auto"></div>
          <div className="text-xl text-primary-text-color font-body">Loading...</div>
        </div>
      </div>
    );
  }

  const artists = Object.keys(ARTIST_DATA).map(artistId => 
    playlistData[artistId]
  ).filter(Boolean) as Artist[];

  return (
    <div className="min-h-screen">
      <div className="landing-container">
        <div className="main-title">
          <h1 className="text-5xl font-heading font-bold text-primary-text-color mb-2">
            Six worlds.
          </h1>
          <h2 className="text-3xl font-heading text-primary-text-color">
            One universe
          </h2>
        </div>

        <ArtistGrid artists={artists} />
      </div>
    </div>
  );
}
