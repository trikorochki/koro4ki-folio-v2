// src/lib/playlist-generator.ts
import { list } from '@vercel/blob';
import { PlaylistData, Artist, Album, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';

export async function generatePlaylistData(): Promise<PlaylistData> {
  try {
    console.log('🔗 Connecting to Vercel Blob Storage...');
    
    const { blobs } = await list({
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    console.log(`📁 Found ${blobs.length} files in Vercel Blob`);
    
    const artists: Record<string, Artist> = {};
    
    // Инициализируем всех артистов из статических данных
    Object.keys(ARTIST_DATA).forEach(artistId => {
      const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
      artists[artistId] = {
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
    
    // Обрабатываем файлы из Vercel Blob
    for (const blob of blobs) {
      try {
        // Парсим путь файла: artist/album/track.mp3 или artist/album/cover.jpg
        const pathParts = blob.pathname.split('/');
        if (pathParts.length < 3) continue;
        
        const artistName = pathParts[0];
        const albumName = pathParts[1];
        const fileName = pathParts[2];
        
        // Проверяем, что артист существует в наших данных
        if (!artists[artistName]) {
          console.log(`⚠️ Unknown artist in blob: ${artistName}`);
          continue;
        }
        
        // Определяем тип релиза по префиксу папки
        let releaseType: 'Albums' | 'EPs' | 'Demos' = 'Albums';
        if (albumName.toLowerCase().includes('ep')) {
          releaseType = 'EPs';
        } else if (albumName.toLowerCase().includes('demo')) {
          releaseType = 'Demos';
        }
        
        // Ищем или создаем альбом
        let album = artists[artistName][releaseType].find(a => a.title === albumName);
        if (!album) {
          album = {
            id: `${artistName}_${albumName.replace(/\s+/g, '_')}`,
            title: albumName,
            type: releaseType,
            cover: blob.pathname.endsWith('/cover.jpg') ? blob.url : `/images/covers/default.jpg`,
            tracks: [],
            artistId: artistName,
          };
          artists[artistName][releaseType].push(album);
        }
        
        // Если это обложка альбома, обновляем URL
        if (fileName === 'cover.jpg') {
          album.cover = blob.url;
          continue;
        }
        
        // Обрабатываем аудиофайлы
        if (fileName.match(/\.(mp3|wav|flac|m4a|aac)$/i)) {
          const trackMatch = fileName.match(/^(\d+)[\s\-\.]*(.+)\.[^.]+$/);
          const trackNumber = trackMatch ? parseInt(trackMatch[1]) : album.tracks.length + 1;
          const trackTitle = trackMatch 
            ? trackMatch[2].trim() 
            : fileName.replace(/\.[^.]+$/, '');
          
          // Проверяем, не добавлен ли уже этот трек
          const existingTrack = album.tracks.find(t => t.number === trackNumber);
          if (!existingTrack) {
            const track: Track = {
              id: `${artistName}_${albumName}_${trackNumber}`,
              number: trackNumber,
              title: trackTitle,
              originalTitle: trackTitle,
              file: blob.url,
              duration: '3:00', // Placeholder, можно добавить реальное определение
              albumId: album.id,
              artistId: artistName,
            };
            
            album.tracks.push(track);
          }
        }
      } catch (error) {
        console.error(`Error processing blob ${blob.pathname}:`, error);
      }
    }
    
    // Сортируем треки и очищаем пустые альбомы
    Object.values(artists).forEach(artist => {
      ['Albums', 'EPs', 'Demos'].forEach(releaseType => {
        const releases = artist[releaseType as keyof Pick<Artist, 'Albums' | 'EPs' | 'Demos'>] as Album[];
        
        // Сортируем треки в каждом альбоме
        releases.forEach(album => {
          album.tracks.sort((a, b) => a.number - b.number);
        });
        
        // Удаляем альбомы без треков
        const filteredReleases = releases.filter(album => album.tracks.length > 0);
        (artist as any)[releaseType] = filteredReleases;
      });
    });
    
    const totalTracks = Object.values(artists).reduce((sum, artist) => {
      return sum + [...artist.Albums, ...artist.EPs, ...artist.Demos]
        .reduce((albumSum, album) => albumSum + album.tracks.length, 0);
    }, 0);
    
    console.log(`✅ Generated playlist: ${Object.keys(artists).length} artists, ${totalTracks} tracks`);
    
    return artists;
  } catch (error) {
    console.error('💥 Error generating playlist from Vercel Blob:', error);
    throw error;
  }
}
