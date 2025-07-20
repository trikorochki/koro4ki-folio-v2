// src/lib/blob-music-reader.ts
import { list } from '@vercel/blob';
import { PlaylistData, Artist, Album, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

interface BlobFile {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

interface ProcessingStats {
  totalFiles: number;
  audioFiles: number;
  coverFiles: number;
  processedArtists: number;
  processedReleases: number;
  processedTracks: number;
  skippedFiles: number;
  errors: string[];
}

// ================================================================================
// ENHANCED MAIN FUNCTION WITH BETTER ERROR HANDLING
// ================================================================================

export async function generateBlobPlaylistData(): Promise<PlaylistData> {
  const artists: Record<string, Artist> = {};
  const stats: ProcessingStats = {
    totalFiles: 0,
    audioFiles: 0,
    coverFiles: 0,
    processedArtists: 0,
    processedReleases: 0,
    processedTracks: 0,
    skippedFiles: 0,
    errors: []
  };
  
  try {
    console.log('🔍 Scanning Vercel Blob Storage...');
    
    const blobFiles = await listBlobFiles();
    
    if (!blobFiles || blobFiles.length === 0) {
      console.log('⚠️ No files found in Blob Storage, using fallback data');
      return generateEmptyPlaylistData();
    }

    stats.totalFiles = blobFiles.length;
    console.log(`📂 Found ${blobFiles.length} files in Blob Storage`);

    const artistFiles = groupFilesByArtist(blobFiles);
    
    for (const [artistId, files] of Object.entries(artistFiles)) {
      try {
        if (!ARTIST_DATA[artistId as keyof typeof ARTIST_DATA]) {
          console.log(`⚠️ Skipping unknown artist: ${artistId}`);
          stats.errors.push(`Unknown artist: ${artistId}`);
          continue;
        }

        const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
        
        artists[artistId] = {
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

        console.log(`🎤 Processing artist: ${artistInfo.name}`);
        stats.processedArtists++;

        const releaseFiles = groupFilesByRelease(files);

        for (const [releaseFolderName, releaseFilesList] of Object.entries(releaseFiles)) {
          try {
            console.log(`  📀 Processing release: ${releaseFolderName}`);
            
            const { releaseType, cleanName } = parseReleaseTypeAndName(releaseFolderName);
            
            if (!releaseType) {
              console.log(`    ⚠️ WARNING: Folder '${releaseFolderName}' doesn't have correct prefix. Skipped.`);
              stats.errors.push(`Invalid release folder: ${releaseFolderName}`);
              stats.skippedFiles++;
              continue;
            }

            const album: Album = {
              id: `${artistId}_${cleanName.replace(/\s+/g, '_')}`,
              title: cleanName,
              type: releaseType,
              cover: undefined,
              tracks: [],
              artistId: artistId,
            };

            const sortedFiles = releaseFilesList.sort((a, b) => 
              naturalCompare(a.pathname, b.pathname)
            );

            // Фильтрация аудиофайлов с расширенной поддержкой форматов
            const audioFiles = sortedFiles.filter(file => {
              const isAudio = /\.(mp3|wav|flac|m4a|ogg|aac|wma|opus|webm)$/i.test(file.pathname);
              if (isAudio) stats.audioFiles++;
              return isAudio;
            });

            // Улучшенный поиск обложек альбомов
            const coverFile = findAlbumCover(sortedFiles);

            if (coverFile) {
              album.cover = coverFile.url; // Используем прямой URL из Blob Storage
              stats.coverFiles++;
              console.log(`  🖼️ Found cover: ${coverFile.pathname}`);
            } else {
              console.log(`  ⚠️ No cover found for ${releaseFolderName}`);
            }

            // Обработка аудиофайлов с улучшенной логикой
            for (let i = 0; i < audioFiles.length; i++) {
              try {
                const file = audioFiles[i];
                const fileName = file.pathname.split('/').pop() || '';

                const { trackNumber, cleanTitle, originalTitle } = parseTrackNumberAndTitle(fileName);
                
                const finalTrackNumber = trackNumber !== null ? trackNumber : i + 1;

                // Создаем безопасный ID трека с поддержкой кириллицы
                const trackId = createSafeTrackId(artistId, cleanName, cleanTitle, finalTrackNumber);

                const track: Track = {
                  id: trackId,
                  title: cleanTitle,
                  file: file.url, // Прямой URL из Blob Storage
                  duration: '0:00', // Будет обновлено при воспроизведении
                  artistId: artistId,
                  albumName: cleanName,
                  number: finalTrackNumber,
                  originalTitle: originalTitle,
                  albumId: album.id,
                  metadata: {
                    pathname: file.pathname,
                    fileName: fileName,
                    size: file.size,
                    uploadedAt: file.uploadedAt.toISOString(),
                    number: finalTrackNumber,
                    originalTitle: originalTitle
                  }
                };

                album.tracks.push(track);
                stats.processedTracks++;
                console.log(`    🎵 Added track: ${cleanTitle} -> ${file.url}`);
              } catch (trackError) {
                console.error(`    ❌ Error processing track ${audioFiles[i].pathname}:`, trackError);
                stats.errors.push(`Track processing error: ${audioFiles[i].pathname}`);
              }
            }

            // Сортировка треков по номерам с безопасной обработкой
            album.tracks.sort((a, b) => {
              const aNumber = a.number || 0;
              const bNumber = b.number || 0;
              return aNumber - bNumber;
            });

            if (album.tracks.length > 0) {
              artists[artistId][releaseType].push(album);
              stats.processedReleases++;
              console.log(`  ✅ Added ${releaseType.toLowerCase()}: ${cleanName} (${album.tracks.length} tracks)`);
            } else {
              console.log(`  ⚠️ Skipped empty release: ${cleanName}`);
              stats.errors.push(`Empty release: ${cleanName}`);
            }
          } catch (releaseError) {
            console.error(`  ❌ Error processing release ${releaseFolderName}:`, releaseError);
            stats.errors.push(`Release processing error: ${releaseFolderName}`);
          }
        }
      } catch (artistError) {
        console.error(`❌ Error processing artist ${artistId}:`, artistError);
        stats.errors.push(`Artist processing error: ${artistId}`);
      }
    }

    // Детальная статистика
    console.log(`📊 Processing complete:`);
    console.log(`  📁 ${stats.totalFiles} total files`);
    console.log(`  🎵 ${stats.audioFiles} audio files`);
    console.log(`  🖼️ ${stats.coverFiles} cover files`);
    console.log(`  🎤 ${stats.processedArtists} artists processed`);
    console.log(`  💿 ${stats.processedReleases} releases processed`);
    console.log(`  🎧 ${stats.processedTracks} tracks processed`);
    console.log(`  ⚠️ ${stats.errors.length} errors/warnings`);
    
    if (stats.errors.length > 0) {
      console.log(`📝 Error summary:`, stats.errors.slice(0, 10));
    }
    
    return artists;
    
  } catch (error) {
    console.error('❌ Critical error reading from Blob Storage:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack available');
    return generateEmptyPlaylistData();
  }
}

// ================================================================================
// ENHANCED UTILITY FUNCTIONS
// ================================================================================

/**
 * Улучшенная функция получения списка файлов из Blob Storage
 */
async function listBlobFiles(): Promise<BlobFile[]> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    }

    const { blobs } = await list({
      prefix: 'music/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      limit: 2000, // Увеличиваем лимит для больших коллекций
    });

    return blobs.map(blob => ({
      pathname: blob.pathname,
      url: blob.url, // Прямые URL из Blob Storage
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }));
    
  } catch (error) {
    console.error('❌ Error listing blob files:', error);
    throw error;
  }
}

/**
 * Создание безопасного ID трека с поддержкой кириллицы
 */
function createSafeTrackId(
  artistId: string, 
  albumName: string, 
  trackTitle: string, 
  trackNumber: number
): string {
  const safeArtist = artistId.replace(/[^\w\u0400-\u04FF]/g, '_');
  const safeAlbum = albumName
    .replace(/[^\w\u0400-\u04FF\s]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const safeTitle = trackTitle
    .replace(/[^\w\u0400-\u04FF\s]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  
  return `${safeArtist}_${safeAlbum}_${trackNumber.toString().padStart(2, '0')}_${safeTitle}`;
}

/**
 * Улучшенный поиск обложек альбомов
 */
function findAlbumCover(files: BlobFile[]): BlobFile | undefined {
  const coverPatterns = [
    'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp',
    'folder.jpg', 'folder.jpeg', 'folder.png',
    'albumart.jpg', 'albumart.jpeg', 'albumart.png',
    'front.jpg', 'front.jpeg', 'front.png',
    'artwork.jpg', 'artwork.jpeg', 'artwork.png'
  ];

  // Сначала ищем точные совпадения
  for (const pattern of coverPatterns) {
    const coverFile = files.find(file => {
      const fileName = file.pathname.split('/').pop()?.toLowerCase() || '';
      return fileName === pattern;
    });
    
    if (coverFile) {
      return coverFile;
    }
  }

  // Если не найдено, ищем первое изображение в папке
  const imageFile = files.find(file => {
    const fileName = file.pathname.split('/').pop()?.toLowerCase() || '';
    return /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(fileName);
  });

  return imageFile;
}

function groupFilesByArtist(files: BlobFile[]): Record<string, BlobFile[]> {
  const artistFiles: Record<string, BlobFile[]> = {};
  
  files.forEach(file => {
    const pathParts = file.pathname.split('/');
    
    if (pathParts.length >= 4 && pathParts[0] === 'music') {
      const artistName = pathParts[1];
      
      if (!artistFiles[artistName]) {
        artistFiles[artistName] = [];
      }
      
      artistFiles[artistName].push(file);
    } else {
      console.warn(`⚠️ Invalid file path structure: ${file.pathname}`);
    }
  });
  
  return artistFiles;
}

function groupFilesByRelease(files: BlobFile[]): Record<string, BlobFile[]> {
  const releaseFiles: Record<string, BlobFile[]> = {};
  
  files.forEach(file => {
    const pathParts = file.pathname.split('/');
    
    if (pathParts.length >= 4) {
      const releaseName = pathParts[2];
      
      if (!releaseFiles[releaseName]) {
        releaseFiles[releaseName] = [];
      }
      
      releaseFiles[releaseName].push(file);
    }
  });
  
  return releaseFiles;
}

/**
 * Улучшенная функция парсинга типа релиза
 */
function parseReleaseTypeAndName(releaseFolderName: string): {
  releaseType: 'Albums' | 'EPs' | 'Demos' | null;
  cleanName: string;
} {
  const lowerName = releaseFolderName.toLowerCase().trim();
  
  const patterns = [
    { prefix: 'album.', type: 'Albums' as const },
    { prefix: 'ep.', type: 'EPs' as const },
    { prefix: 'demo.', type: 'Demos' as const },
    // Дополнительные варианты
    { prefix: 'альбом.', type: 'Albums' as const },
    { prefix: 'мини-альбом.', type: 'EPs' as const },
    { prefix: 'демо.', type: 'Demos' as const }
  ];
  
  for (const pattern of patterns) {
    if (lowerName.startsWith(pattern.prefix)) {
      const cleanName = releaseFolderName
        .substring(pattern.prefix.length)
        .trim()
        .replace(/^[\d\s\-_]+/, '') // Убираем годы и разделители в начале
        .trim();
      
      return {
        releaseType: pattern.type,
        cleanName: cleanName || releaseFolderName
      };
    }
  }
  
  return {
    releaseType: null,
    cleanName: releaseFolderName
  };
}

/**
 * Улучшенная функция парсинга номера трека и названия
 */
function parseTrackNumberAndTitle(filename: string): {
  trackNumber: number | null;
  cleanTitle: string;
  originalTitle: string;
} {
  const title = filename.replace(/\.[^.]+$/, '');
  const originalTitle = title;
  
  // Расширенные паттерны для разных форматов номеров треков
  const patterns = [
    /^(\d{1,2})[\s\.\-_]+(.+)$/,                    // "01. Track Name"
    /^Track[\s]*(\d{1,2})[\s\.\-_]*(.*)$/i,        // "Track 1 Name"
    /^(\d{1,2})([A-Za-zА-Яа-я].+)$/,               // "01TrackName" (с кириллицей)
    /^(\d{1,2})$/,                                  // Только номер
    /^V(\d+)[_\s]+(.+)$/i,                         // "V1_название"
    /^\[(\d{1,2})\][\s]*(.+)$/,                    // "[01] Track Name"
    /^(\d{1,2})\)[\s]*(.+)$/,                      // "1) Track Name"
    /^Трек[\s]*(\d{1,2})[\s\.\-_]*(.*)$/i,        // "Трек 1 Name"
  ];
  
  for (const pattern of patterns) {
    const match = title.trim().match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      let cleanTitle = match[2]?.trim() || '';
      
      // Дополнительная очистка названия
      cleanTitle = cleanTitle
        .replace(/^[\s\.\-_\[\]\(\)]+/, '') // Убираем лишние символы в начале
        .replace(/[\s\.\-_\[\]\(\)]+$/, '') // Убираем лишние символы в конце
        .trim();
      
      if (!cleanTitle) {
        cleanTitle = `Track ${num}`;
      }
      
      return {
        trackNumber: !isNaN(num) ? num : null,
        cleanTitle,
        originalTitle
      };
    }
  }
  
  // Если паттерны не сработали, возвращаем как есть
  return {
    trackNumber: null,
    cleanTitle: title.trim() || 'Unknown Track',
    originalTitle
  };
}

/**
 * Улучшенная функция естественной сортировки с поддержкой кириллицы
 */
function naturalCompare(a: string, b: string): number {
  const parseNatural = (str: string) => {
    return str.split(/(\d+)/).map(part => 
      /^\d+$/.test(part) ? parseInt(part, 10) : part.toLowerCase()
    );
  };
  
  const aParts = parseNatural(a);
  const bParts = parseNatural(b);
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    
    if (typeof aPart === 'number' && typeof bPart === 'number') {
      if (aPart !== bPart) return aPart - bPart;
    } else {
      const aStr = String(aPart);
      const bStr = String(bPart);
      if (aStr !== bStr) {
        // Используем localeCompare с поддержкой кириллицы
        return aStr.localeCompare(bStr, ['ru', 'en'], { 
          numeric: true, 
          sensitivity: 'base' 
        });
      }
    }
  }
  
  return 0;
}

/**
 * Генерация пустых данных плейлиста как fallback
 */
function generateEmptyPlaylistData(): PlaylistData {
  const fallbackData: PlaylistData = {};
  
  try {
    Object.keys(ARTIST_DATA).forEach(artistId => {
      const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
      
      if (artistInfo) {
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
      }
    });
    
    console.log(`📝 Created fallback structure for ${Object.keys(fallbackData).length} artists with 0 tracks`);
  } catch (error) {
    console.error('❌ Error creating fallback data:', error);
  }
  
  return fallbackData;
}
