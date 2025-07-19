// src/app/api/playlist/route.ts
import { NextResponse } from 'next/server';
import { PlaylistData } from '@/types/music';

export async function GET() {
  try {
    console.log('🎵 Generating playlist from Vercel Blob Storage...');
    
    let playlistData: PlaylistData | null = null;
    let dataSource = 'fallback';

    // Пытаемся загрузить данные из Blob Storage
    try {
      const { generateBlobPlaylistData } = await import('@/lib/blob-music-reader');
      playlistData = await generateBlobPlaylistData();
      
      // Проверяем, есть ли реальные данные
      const hasData = playlistData
        ? Object.values(playlistData).some((artist) => 
            (artist.Albums?.length > 0) || 
            (artist.EPs?.length > 0) || 
            (artist.Demos?.length > 0)
          )
        : false;
      
      if (hasData) {
        dataSource = 'blob';
        console.log('✅ Successfully loaded playlist from Vercel Blob Storage');
      } else {
        console.log('⚠️ Blob Storage source has no music data');
        playlistData = null;
      }
    } catch (blobError) {
      console.log('❌ Blob Storage source failed:', blobError instanceof Error ? blobError.message : String(blobError));
      playlistData = null;
    }
    
    // Fallback: создаем пустую структуру артистов
    if (!playlistData) {
      console.log('📝 Creating fallback artist structure...');
      playlistData = await createFallbackData();
      dataSource = 'fallback';
    }

    // Подсчет статистики
    const stats = calculatePlaylistStats(playlistData);
    console.log(`📊 Loaded ${stats.artists} artists, ${stats.releases} releases, ${stats.tracks} tracks`);
    
    return NextResponse.json(playlistData, {
      headers: {
        'Cache-Control': process.env.NODE_ENV === 'development' 
          ? 'no-cache, no-store, must-revalidate' 
          : 'public, s-maxage=300, stale-while-revalidate=900',
        'Content-Type': 'application/json',
        'X-Data-Source': dataSource,
        'X-Stats': `${stats.artists} artists, ${stats.tracks} tracks`,
      },
    });

  } catch (error) {
    console.error('💥 Critical error in playlist API:', error);
    
    // В случае критической ошибки возвращаем emergency fallback
    const emergencyData = await createEmergencyFallback();
    
    return NextResponse.json(emergencyData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Data-Source': 'emergency-fallback',
        'X-Error': 'true',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

// Создание fallback данных с правильной структурой
async function createFallbackData(): Promise<PlaylistData> {
  try {
    const { ARTIST_DATA } = await import('@/data/artists');
    const fallbackData: PlaylistData = {};
    
    Object.keys(ARTIST_DATA).forEach(artistId => {
      const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
      fallbackData[artistId] = {
        id: artistId,
        name: artistInfo.name,
        avatar: artistInfo.avatar,
        descriptionLine1: artistInfo.descriptionLine1,
        descriptionLine2: artistInfo.descriptionLine2,
        socialLinks: artistInfo.socialLinks || {},
        Albums: [],
        EPs: [],
        Demos: [],
      };
    });
    
    return fallbackData;
  } catch (error) {
    console.error('❌ Error creating fallback data:', error);
    return createEmergencyFallback();
  }
}

// Минимальная аварийная структура
async function createEmergencyFallback(): Promise<PlaylistData> {
  return {
    flowkorochki: {
      id: 'flowkorochki',
      name: 'FLOWKORO4KI',
      avatar: '/images/flowkorochki.jpg',
      descriptionLine1: 'Sarcastic and philosophical hip-hop.',
      descriptionLine2: 'Exploring the boundaries of reality and absurdity.',
      socialLinks: {},
      Albums: [],
      EPs: [],
      Demos: [],
    },
    streetkorochki: {
      id: 'streetkorochki',
      name: 'STREETKORO4KI',
      avatar: '/images/streetkorochki.jpg',
      descriptionLine1: 'Street wisdom and urban poetry.',
      descriptionLine2: 'Raw emotions from the concrete jungle.',
      socialLinks: {},
      Albums: [],
      EPs: [],
      Demos: [],
    },
    trapkorochki: {
      id: 'trapkorochki',
      name: 'TRAPKORO4KI',
      avatar: '/images/trapkorochki.jpg',
      descriptionLine1: 'Dark trap vibes and heavy beats.',
      descriptionLine2: 'Synthetic soundscapes of modern isolation.',
      socialLinks: {},
      Albums: [],
      EPs: [],
      Demos: [],
    }
  };
}

// Подсчет статистики
function calculatePlaylistStats(data: PlaylistData) {
  const artists = Object.keys(data).length;
  let releases = 0;
  let tracks = 0;
  
  Object.values(data).forEach((artist) => {
    const albumCount = artist.Albums?.length || 0;
    const epCount = artist.EPs?.length || 0;
    const demoCount = artist.Demos?.length || 0;
    
    releases += albumCount + epCount + demoCount;
    
    [...(artist.Albums || []), ...(artist.EPs || []), ...(artist.Demos || [])]
      .forEach((album) => {
        tracks += album.tracks?.length || 0;
      });
  });
  
  return { artists, releases, tracks };
}

// POST метод для принудительного обновления данных из Blob Storage
export async function POST() {
  try {
    console.log('🔄 Force refreshing playlist data from Blob Storage...');
    
    const { generateBlobPlaylistData } = await import('@/lib/blob-music-reader');
    const data = await generateBlobPlaylistData();
    
    const stats = calculatePlaylistStats(data);
    
    return NextResponse.json({
      success: true,
      message: 'Playlist data refreshed from Vercel Blob Storage',
      stats,
      timestamp: new Date().toISOString(),
      dataSource: 'blob'
    });
  } catch (error) {
    console.error('❌ Error refreshing playlist:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh playlist',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
