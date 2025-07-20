// src/app/api/music/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export const dynamic = 'force-dynamic';

// ================================================================================
// CONSTANTS
// ================================================================================

const MIME_TYPES: Record<string, string> = {
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'webm': 'audio/webm',
  'opus': 'audio/opus',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
} as const;

const SUPPORTED_AUDIO_FORMATS = [
  'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'webm', 'opus'
];

const CACHE_CONTROL_HEADERS = {
  AUDIO: 'public, max-age=31536000, immutable', // 1 год для аудио
  IMAGE: 'public, max-age=2592000', // 30 дней для изображений
  DEFAULT: 'public, max-age=3600', // 1 час по умолчанию
} as const;

// ================================================================================
// UTILITY FUNCTIONS WITH ENHANCED CYRILLIC SUPPORT
// ================================================================================

/**
 * Получение MIME типа по расширению файла
 */
function getMimeType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() || '';
  return MIME_TYPES[extension] || 'application/octet-stream';
}

/**
 * Проверка, является ли файл аудио форматом
 */
function isAudioFile(filename: string): boolean {
  const extension = filename.toLowerCase().split('.').pop() || '';
  return SUPPORTED_AUDIO_FORMATS.includes(extension);
}

/**
 * Получение подходящих Cache-Control заголовков
 */
function getCacheControl(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() || '';
  
  if (SUPPORTED_AUDIO_FORMATS.includes(extension)) {
    return CACHE_CONTROL_HEADERS.AUDIO;
  }
  
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension)) {
    return CACHE_CONTROL_HEADERS.IMAGE;
  }
  
  return CACHE_CONTROL_HEADERS.DEFAULT;
}

/**
 * Улучшенная функция sanitizePath с поддержкой кириллицы
 */
function sanitizePath(rawPath: string[]): string | null {
  try {
    const filePath = rawPath.join('/');
    
    // Декодируем URI компоненты для поддержки кириллицы
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(filePath);
    } catch (decodeError) {
      console.warn('[MUSIC API] Failed to decode URI:', filePath);
      // Пробуем без декодирования
      decodedPath = filePath;
    }
    
    console.log(`[MUSIC API] Processing path: ${decodedPath}`);
    
    // Расширенные проверки безопасности
    if (decodedPath.includes('..') || 
        decodedPath.includes('\0') || 
        decodedPath.includes('\\') ||
        decodedPath.startsWith('/') ||
        decodedPath.includes('//')) {
      console.warn('[MUSIC API] Security violation detected:', decodedPath);
      return null;
    }
    
    // Ограничиваем длину пути
    if (decodedPath.length > 1000) {
      console.warn('[MUSIC API] Path too long:', decodedPath.length);
      return null;
    }
    
    // Проверяем на пустые сегменты пути
    const pathSegments = decodedPath.split('/').filter(segment => segment.trim() !== '');
    if (pathSegments.length === 0) {
      console.warn('[MUSIC API] Empty path after filtering');
      return null;
    }
    
    // Проверяем каждый сегмент на валидность
    for (const segment of pathSegments) {
      if (segment.length > 255) { // Максимальная длина имени файла
        console.warn('[MUSIC API] Path segment too long:', segment.length);
        return null;
      }
    }
    
    const cleanedPath = pathSegments.join('/');
    console.log(`[MUSIC API] Cleaned path: ${cleanedPath}`);
    
    return cleanedPath;
  } catch (error) {
    console.error('[MUSIC API] Path sanitization error:', error);
    return null;
  }
}

/**
 * Точный поиск файла в Blob Storage
 */
async function findExactFile(targetPath: string, token: string) {
  try {
    // Сначала пробуем точное совпадение
    const exactMatch = await list({
      prefix: targetPath,
      limit: 10,
      token,
    });
    
    // Фильтруем результаты для точного совпадения
    const exactFile = exactMatch.blobs.find(blob => blob.pathname === targetPath);
    
    if (exactFile) {
      console.log(`[MUSIC API] Exact match found: ${exactFile.pathname}`);
      return exactFile;
    }
    
    // Если точного совпадения нет, ищем файлы с похожими путями
    const similarFiles = exactMatch.blobs.filter(blob => 
      blob.pathname.toLowerCase().includes(targetPath.toLowerCase()) ||
      targetPath.toLowerCase().includes(blob.pathname.toLowerCase())
    );
    
    if (similarFiles.length > 0) {
      console.log(`[MUSIC API] Similar file found: ${similarFiles[0].pathname}`);
      return similarFiles[0];
    }
    
    return null;
  } catch (error) {
    console.error('[MUSIC API] File search error:', error);
    throw error;
  }
}

// ================================================================================
// ENHANCED MAIN HANDLER WITH PROXY FUNCTIONALITY
// ================================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    console.log(`[MUSIC API] Request started for:`, params.path);
    
    // 1. Валидация входных данных
    if (!params?.path || !Array.isArray(params.path) || params.path.length === 0) {
      console.warn('[MUSIC API] Invalid path parameters');
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid file path',
          details: 'Path parameters are required'
        },
        { status: 400 }
      );
    }
    
    const sanitizedPath = sanitizePath(params.path);
    if (!sanitizedPath) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid file path format',
          details: 'Path contains invalid characters or structure'
        },
        { status: 400 }
      );
    }
    
    // 2. Проверка конфигурации сервера
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[MUSIC API] BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { 
          success: false,
          error: 'Server configuration error',
          details: 'Blob storage not configured'
        },
        { status: 500 }
      );
    }
    
    // 3. Поиск файла в Blob Storage
    const targetPath = `music/${sanitizedPath}`;
    console.log(`[MUSIC API] Looking for blob: ${targetPath}`);
    
    try {
      const blob = await findExactFile(targetPath, process.env.BLOB_READ_WRITE_TOKEN);
      
      if (!blob) {
        console.warn(`[MUSIC API] File not found: ${targetPath}`);
        return NextResponse.json(
          { 
            success: false,
            error: 'File not found',
            details: `No file found at path: ${sanitizedPath}`,
            searchedPath: targetPath
          },
          { 
            status: 404,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            }
          }
        );
      }
      
      console.log(`[MUSIC API] Found blob: ${blob.pathname} -> ${blob.url}`);
      
      // 4. Определяем стратегию ответа
      const fileName = blob.pathname.split('/').pop() || 'file';
      const mimeType = getMimeType(fileName);
      const cacheControl = getCacheControl(fileName);
      const isAudio = isAudioFile(fileName);
      
      // Проверяем параметры запроса
      const url = new URL(request.url);
      const forceProxy = url.searchParams.get('proxy') === 'true';
      const directAccess = url.searchParams.get('direct') === 'true';
      
      // 5a. Прямая ссылка (предпочтительно для производительности)
      if (directAccess || (!forceProxy && isAudio)) {
        console.log(`[MUSIC API] Redirecting to direct URL: ${blob.url}`);
        
        return NextResponse.redirect(blob.url, {
          status: 302,
          headers: {
            'Cache-Control': cacheControl,
            'X-Content-Type': mimeType,
            'X-File-Size': blob.size?.toString() || '0',
            'X-Processing-Time': `${Date.now() - startTime}ms`,
          }
        });
      }
      
      // 5b. Proxy режим (для дополнительной обработки или аналитики)
      console.log(`[MUSIC API] Proxying file: ${blob.pathname}`);
      
      const fileResponse = await fetch(blob.url);
      
      if (!fileResponse.ok) {
        console.error(`[MUSIC API] Failed to fetch from blob: ${fileResponse.status}`);
        return NextResponse.json(
          { 
            success: false,
            error: 'File fetch error',
            details: 'Unable to retrieve file from storage'
          },
          { status: 503 }
        );
      }
      
      const fileBuffer = await fileResponse.arrayBuffer();
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.byteLength.toString(),
          'Cache-Control': cacheControl,
          'Accept-Ranges': 'bytes',
          'X-File-Name': fileName,
          'X-File-Size': blob.size?.toString() || fileBuffer.byteLength.toString(),
          'X-Processing-Time': `${Date.now() - startTime}ms`,
          // CORS заголовки для аудио
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Accept-Ranges, Content-Range',
        }
      });
      
    } catch (blobError: unknown) {
      console.error('[MUSIC API] Blob storage error:', blobError);
      
      const errorMessage = blobError instanceof Error ? blobError.message : 'Unknown blob error';
      
      return NextResponse.json(
        { 
          success: false,
          error: 'File storage error',
          details: errorMessage,
          searchedPath: targetPath
        },
        { 
          status: 503,
          headers: {
            'Retry-After': '10', // Предлагаем повторить через 10 секунд
          }
        }
      );
    }
    
  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    console.error('[MUSIC API] Unexpected error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[MUSIC API] Error stack:', errorStack);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: errorMessage,
        timestamp: new Date().toISOString(),
        processingTime
      },
      { 
        status: 500,
        headers: {
          'X-Error': 'true',
          'X-Processing-Time': `${processingTime}ms`,
        }
      }
    );
  }
}

// ================================================================================
// ENHANCED CORS SUPPORT
// ================================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      // Основные CORS заголовки
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization, X-Requested-With',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, X-File-Size, X-Processing-Time',
      'Access-Control-Max-Age': '86400',
      
      // Дополнительные заголовки для аудио стриминга
      'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ================================================================================
// HEAD SUPPORT FOR RANGE REQUESTS
// ================================================================================

export async function HEAD(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  try {
    // Используем ту же логику что и в GET, но возвращаем только заголовки
    const sanitizedPath = sanitizePath(params.path || []);
    if (!sanitizedPath) {
      return new NextResponse(null, { status: 400 });
    }
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return new NextResponse(null, { status: 500 });
    }
    
    const targetPath = `music/${sanitizedPath}`;
    const blob = await findExactFile(targetPath, process.env.BLOB_READ_WRITE_TOKEN);
    
    if (!blob) {
      return new NextResponse(null, { status: 404 });
    }
    
    const fileName = blob.pathname.split('/').pop() || 'file';
    const mimeType = getMimeType(fileName);
    const cacheControl = getCacheControl(fileName);
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': blob.size?.toString() || '0',
        'Cache-Control': cacheControl,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'X-File-Name': fileName,
        'X-File-Size': blob.size?.toString() || '0',
      }
    });
    
  } catch (error) {
    console.error('[MUSIC API] HEAD request error:', error);
    return new NextResponse(null, { status: 500 });
  }
}
