// src/app/api/music/[...path]/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Принудительно делаем route динамическим для Vercel
export const dynamic = 'force-dynamic';

// ================================================================================
// TYPES & INTERFACES
// ================================================================================

interface MimeTypeMap {
  [key: string]: string;
}

interface CacheConfig {
  maxAge: number;
  public: boolean;
  immutable: boolean;
}

interface FileMetadata {
  mimeType: string;
  isAudio: boolean;
  isImage: boolean;
  extension: string;
}

// ================================================================================
// CONSTANTS
// ================================================================================

const MIME_TYPES: MimeTypeMap = {
  // Audio files
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  'wma': 'audio/x-ms-wma',
  
  // Image files
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  
  // Default
  'default': 'application/octet-stream'
} as const;

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg']);

const CACHE_CONFIG: CacheConfig = {
  maxAge: 31536000, // 1 год
  public: true,
  immutable: true
};

const SECURITY_CONFIG = {
  maxPathLength: 500,
  allowedPathPattern: /^[a-zA-Z0-9\s\.\-_\/\(\)]+$/,
  blockedPatterns: [
    /\.\./,           // Directory traversal
    /\/\//,           // Double slashes
    /^\//,            // Leading slash
    /\/$/,            // Trailing slash
    /__/,             // Double underscores
    /\0/              // Null bytes
  ]
};

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

// Более гибкая валидация путей с поддержкой кириллицы
function sanitizePath(rawPath: string[]): string | null {
  try {
    const filePath = rawPath.join('/');
    const decodedPath = decodeURIComponent(filePath);
    
    // Увеличиваем лимит длины для длинных названий
    if (decodedPath.length > 800) {
      console.warn('Path too long:', decodedPath.length);
      return null;
    }
    
    // Разрешаем кириллицу и больше символов
    const allowedPattern = /^[a-zA-Z0-9а-яА-ЯёЁ\s\.\-_\/\(\)\[\]№&]+$/u;
    if (!allowedPattern.test(decodedPath)) {
      console.warn('Invalid characters in path:', decodedPath);
      return null;
    }
    
    // Проверяем только критичные паттерны
    const blockedPatterns = [
      /\.\./,     // Directory traversal  
      /\/\//,     // Double slashes
      /\0/        // Null bytes
    ];
    
    for (const pattern of blockedPatterns) {
      if (pattern.test(decodedPath)) {
        console.warn('Blocked pattern detected:', pattern, decodedPath);
        return null;
      }
    }
    
    return decodedPath.trim();
  } catch (error) {
    console.error('Path sanitization error:', error);
    return null;
  }
}


function getFileMetadata(filePath: string): FileMetadata {
  const extension = filePath.toLowerCase().split('.').pop() || '';
  const mimeType = MIME_TYPES[extension] || MIME_TYPES.default;
  
  return {
    mimeType,
    isAudio: AUDIO_EXTENSIONS.has(extension),
    isImage: IMAGE_EXTENSIONS.has(extension),
    extension
  };
}

function buildBlobUrl(baseUrl: string, filePath: string): string {
  // Убираем trailing slash из baseUrl и leading slash из filePath
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const cleanFilePath = filePath.replace(/^\//, '');
  
  return `${cleanBaseUrl}/music/${cleanFilePath}`;
}

function createCacheHeaders(metadata: FileMetadata): Record<string, string> {
  const cacheControl = [
    CACHE_CONFIG.public ? 'public' : 'private',
    `max-age=${CACHE_CONFIG.maxAge}`,
    CACHE_CONFIG.immutable ? 'immutable' : ''
  ].filter(Boolean).join(', ');
  
  return {
    'Cache-Control': cacheControl,
    'Vary': 'Accept-Encoding',
    'X-Content-Type-Options': 'nosniff'
  };
}

function createResponseHeaders(
  metadata: FileMetadata,
  contentLength: number
): Record<string, string> {
  const baseHeaders = {
    'Content-Type': metadata.mimeType,
    'Content-Length': contentLength.toString(),
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
  };
  
  const cacheHeaders = createCacheHeaders(metadata);
  
  // Дополнительные заголовки для аудио файлов
  if (metadata.isAudio) {
    return {
      ...baseHeaders,
      ...cacheHeaders,
      'X-Content-Duration': 'unknown', // Можно добавить реальную длительность
      'Content-Disposition': 'inline'
    };
  }
  
  return {
    ...baseHeaders,
    ...cacheHeaders
  };
}

// ================================================================================
// ERROR HANDLERS
// ================================================================================

function createErrorResponse(message: string, status: number, details?: any): NextResponse {
  console.error(`API Error [${status}]:`, message, details || '');
  
  return NextResponse.json(
    { 
      error: message,
      status,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

// ================================================================================
// BLOB STORAGE OPERATIONS
// ================================================================================

async function fetchFromBlobStorage(blobUrl: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд timeout
  
  try {
    const response = await fetch(blobUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'kr4-music-api/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ================================================================================
// MAIN API HANDLERS
// ================================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  try {
    // 1. Проверка и санитизация входных данных
    if (!params?.path || !Array.isArray(params.path) || params.path.length === 0) {
      return createErrorResponse('Invalid or missing file path', 400);
    }
    
    const sanitizedPath = sanitizePath(params.path);
    if (!sanitizedPath) {
      return createErrorResponse('Invalid file path format', 400);
    }
    
    // 2. Проверка переменных окружения
    const blobBaseUrl = process.env.BLOB_URL;
    if (!blobBaseUrl) {
      return createErrorResponse('Server configuration error', 500, 'BLOB_URL not configured');
    }
    
    // 3. Получение метаданных файла
    const fileMetadata = getFileMetadata(sanitizedPath);
    const blobUrl = buildBlobUrl(blobBaseUrl, sanitizedPath);
    
    console.log(`[MUSIC API] Fetching: ${sanitizedPath} (${fileMetadata.mimeType})`);
    
    // 4. Загрузка файла из Blob Storage
    let blobResponse: Response;
    try {
      blobResponse = await fetchFromBlobStorage(blobUrl);
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        return createErrorResponse('Request timeout', 408);
      }
      throw fetchError;
    }
    
    // 5. Проверка статуса ответа от Blob Storage
    if (!blobResponse.ok) {
      const statusText = blobResponse.statusText || 'Unknown error';
      
      if (blobResponse.status === 404) {
        return createErrorResponse('File not found', 404, `Blob: ${blobUrl}`);
      }
      
      if (blobResponse.status >= 500) {
        return createErrorResponse('Blob storage unavailable', 503, statusText);
      }
      
      return createErrorResponse('Failed to retrieve file', blobResponse.status, statusText);
    }
    
    // 6. Получение содержимого файла
    const arrayBuffer = await blobResponse.arrayBuffer();
    
    if (arrayBuffer.byteLength === 0) {
      return createErrorResponse('Empty file', 204);
    }
    
    // 7. Создание ответа с правильными заголовками
    const responseHeaders = createResponseHeaders(fileMetadata, arrayBuffer.byteLength);
    
    console.log(`[MUSIC API] Successfully served: ${sanitizedPath} (${arrayBuffer.byteLength} bytes)`);
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error: any) {
    console.error('[MUSIC API] Unexpected error:', error);
    
    // Специальная обработка различных типов ошибок
    if (error.name === 'TypeError' && error.message?.includes('fetch')) {
      return createErrorResponse('Network error accessing file storage', 502);
    }
    
    if (error.name === 'URIError') {
      return createErrorResponse('Invalid file path encoding', 400);
    }
    
    return createErrorResponse('Internal server error', 500);
  }
}

// HEAD метод для получения метаданных без тела ответа
export async function HEAD(
  request: NextRequest,
  { params }: { params: { path: string[] } }
): Promise<NextResponse> {
  try {
    const sanitizedPath = sanitizePath(params.path);
    if (!sanitizedPath) {
      return new NextResponse(null, { status: 400 });
    }
    
    const blobBaseUrl = process.env.BLOB_URL;
    if (!blobBaseUrl) {
      return new NextResponse(null, { status: 500 });
    }
    
    const fileMetadata = getFileMetadata(sanitizedPath);
    const blobUrl = buildBlobUrl(blobBaseUrl, sanitizedPath);
    
    const blobResponse = await fetch(blobUrl, { method: 'HEAD' });
    
    if (!blobResponse.ok) {
      return new NextResponse(null, { status: blobResponse.status });
    }
    
    const contentLength = blobResponse.headers.get('content-length') || '0';
    const responseHeaders = createResponseHeaders(fileMetadata, parseInt(contentLength));
    
    return new NextResponse(null, {
      status: 200,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('[MUSIC API] HEAD error:', error);
    return new NextResponse(null, { status: 500 });
  }
}

// CORS поддержка для префlight запросов
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    },
  });
}
