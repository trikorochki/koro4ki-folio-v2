// src/app/api/blob/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

interface ProcessedTrack {
  id: string;
  pathname: string;
  url: string;
  artistId: string;
  albumName: string;
  fileName: string;
  title: string;
  size: number;
  uploadedAt: string;
  // Добавляем новые поля согласно интерфейсу Track
  number?: number;
  originalTitle?: string;
  duration?: string;
  metadata: {
    pathname: string;
    fileName: string;
    size: number;
    uploadedAt: string;
    number?: number;
    originalTitle?: string;
  };
}

interface BlobListResponse {
  success: boolean;
  total: number;
  tracks: ProcessedTrack[];
  debug?: {
    totalBlobs: number;
    audioFiles: number;
    validTracks: number;
    processingTime: number;
  };
}

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

/**
 * Извлекает номер трека из имени файла
 */
function extractTrackNumber(fileName: string): number | undefined {
  const match = fileName.match(/^(\d{1,2})\./);
  if (match) {
    const num = parseInt(match[1], 10);
    return !isNaN(num) ? num : undefined;
  }
  return undefined;
}

/**
 * Извлекает оригинальное название трека без номера
 */
function extractOriginalTitle(fileName: string): string | undefined {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const cleaned = withoutExtension.replace(/^\d{1,2}[\s.\-_]*/, '').trim();
  
  if (cleaned !== withoutExtension && cleaned.length > 0) {
    return cleaned;
  }
  
  return undefined;
}

/**
 * Создает безопасный ID трека с поддержкой кириллицы
 */
function createTrackId(artistId: string, albumName: string, title: string): string {
  const safeArtist = artistId.replace(/[^\w\u0400-\u04FF]/g, '_');
  const safeAlbum = albumName.replace(/[^\w\u0400-\u04FF\s]/g, '_').replace(/\s+/g, '_');
  const safeTitle = title.replace(/[^\w\u0400-\u04FF\s]/g, '_').replace(/\s+/g, '_');
  
  return `${safeArtist}_${safeAlbum}_${safeTitle}`;
}

/**
 * Безопасная обработка uploadedAt поля
 */
function processUploadedAt(uploadedAt: unknown): string {
  if (typeof uploadedAt === 'string') {
    return uploadedAt;
  }
  
  if (uploadedAt instanceof Date) {
    return uploadedAt.toISOString();
  }
  
  if (typeof uploadedAt === 'number') {
    return new Date(uploadedAt).toISOString();
  }
  
  // Fallback для неизвестных типов
  return new Date().toISOString();
}

/**
 * Валидация аудио файла
 */
function isValidAudioFile(blob: any): boolean {
  if (!blob || !blob.pathname || blob.size <= 0) {
    return false;
  }
  
  const supportedFormats = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'];
  return supportedFormats.some(format => 
    blob.pathname.toLowerCase().endsWith(format)
  );
}

// ================================================================================
// MAIN API ROUTE
// ================================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Environment validation
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { 
          success: false,
          error: 'BLOB_READ_WRITE_TOKEN not configured',
          details: 'Server configuration error'
        },
        { status: 500 }
      );
    }

    console.log('🔍 Starting blob listing process...');

    // List blobs from Vercel Blob Storage
    const { blobs } = await list({
      prefix: 'music/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      limit: 1000, // Добавляем лимит для производительности
    });

    console.log(`📂 Found ${blobs.length} total files in Blob Storage`);

    // Filter and process audio files
    const audioFiles = blobs
      .filter(blob => {
        const isValid = isValidAudioFile(blob);
        if (!isValid) {
          console.debug(`⏩ Skipping non-audio or invalid file: ${blob.pathname}`);
        }
        return isValid;
      })
      .map((blob, index) => {
        try {
          const pathWithoutPrefix = blob.pathname.replace('music/', '');
          const pathParts = pathWithoutPrefix.split('/');
          
          // Enhanced path validation
          if (pathParts.length < 3) {
            console.warn(`⚠️ Invalid path structure (need artist/album/file): ${blob.pathname}`);
            return null;
          }

          const [artistId, albumRaw, ...fileNameParts] = pathParts;
          const fileName = fileNameParts.join('/');
          
          // Enhanced album name processing
          const albumName = albumRaw
            .replace(/^(Album|EP|Demo)\.\s*/i, '')
            .replace(/^\d{4}[\s\-_]*/, '') // Remove year prefix
            .trim() || 'Unknown Album';
          
          // Enhanced title extraction
          const title = fileName
            .replace(/^\d{1,2}[\s.\-_]*/, '') // Remove track number
            .replace(/\.[^.]+$/, '') // Remove extension
            .replace(/[\[\(].*?[\]\)]/g, '') // Remove brackets content
            .trim() || `Track ${index + 1}`;
          
          // Extract metadata
          const trackNumber = extractTrackNumber(fileName);
          const originalTitle = extractOriginalTitle(fileName);
          const trackId = createTrackId(artistId, albumName, title);
          const uploadedAt = processUploadedAt(blob.uploadedAt);

          const processedTrack: ProcessedTrack = {
            id: trackId,
            pathname: blob.pathname,
            url: blob.url, // Прямой URL из Blob Storage
            artistId: artistId.trim(),
            albumName,
            fileName,
            title,
            size: blob.size,
            uploadedAt,
            number: trackNumber,
            originalTitle,
            metadata: {
              pathname: blob.pathname,
              fileName,
              size: blob.size,
              uploadedAt,
              number: trackNumber,
              originalTitle,
            }
          };

          console.debug(`✅ Processed: ${trackId}`);
          return processedTrack;
          
        } catch (error) {
          console.error(`💥 Error processing blob ${blob.pathname}:`, error);
          return null;
        }
      })
      .filter((track): track is ProcessedTrack => track !== null)
      .sort((a, b) => {
        // Enhanced sorting with Cyrillic support
        const artistCompare = a.artistId.localeCompare(b.artistId, 'ru', { numeric: true });
        if (artistCompare !== 0) return artistCompare;
        
        const albumCompare = a.albumName.localeCompare(b.albumName, 'ru', { numeric: true });
        if (albumCompare !== 0) return albumCompare;
        
        // Sort by track number if available, then by title
        if (a.number !== undefined && b.number !== undefined) {
          return a.number - b.number;
        }
        
        return a.title.localeCompare(b.title, 'ru', { numeric: true });
      });

    const processingTime = Date.now() - startTime;

    console.log(`✅ Successfully processed ${audioFiles.length} valid audio tracks in ${processingTime}ms`);
    console.log(`📊 Stats: ${blobs.length} total → ${audioFiles.length} valid tracks`);

    // Enhanced response with debug info
    const response: BlobListResponse = {
      success: true,
      total: audioFiles.length,
      tracks: audioFiles,
      debug: {
        totalBlobs: blobs.length,
        audioFiles: blobs.filter(isValidAudioFile).length,
        validTracks: audioFiles.length,
        processingTime
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Processing-Time': `${processingTime}ms`,
        'X-Total-Tracks': audioFiles.length.toString()
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error('💥 Critical error in blob listing:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to list blob files',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        processingTime
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Error': 'true',
          'X-Processing-Time': `${processingTime}ms`
        }
      }
    );
  }
}
