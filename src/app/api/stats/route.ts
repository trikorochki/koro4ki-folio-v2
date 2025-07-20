// src/app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

let redis: Redis | null = null;

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

interface AllDataResponse {
  listen_counts: Record<string, number>;
  browsers: Record<string, number>;
  os: Record<string, number>;
  devices: Record<string, number>;
  countries: Record<string, number>;
  diagnostic_logs: any[];
  events: Record<string, Record<string, number>>;
  _debug_info: {
    raw_listen_count_keys: string[];
    raw_diagnostic_logs: string[];
  };
}

interface TrackStats {
  total_plays: number;
  albums: Record<string, {
    total_plays: number;
    tracks: Array<{
      title: string;
      plays: number;
      events: Record<string, number>;
    }>;
  }>;
}

interface StatsAPIResponse {
  success: boolean;
  track_stats: Record<string, TrackStats>;
  audience_stats: {
    browsers: Record<string, number>;
    os: Record<string, number>;
    devices: Record<string, number>;
    countries: Record<string, number>;
  };
  diagnostic_logs: any[];
  _debug_info: {
    raw_listen_count_keys: string[];
    raw_diagnostic_logs: string[];
    processing_time?: number;
  };
}

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

/**
 * Безопасная функция sanitizePath с поддержкой кириллицы
 */
function sanitizePath(path: string): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  let sanitized = path;
  
  // Убираем возможный leading slash
  if (sanitized.startsWith('/')) {
    sanitized = sanitized.substring(1);
  }
  
  // Если это полный URL, извлекаем path
  try {
    if (sanitized.startsWith('http')) {
      const url = new URL(path);
      sanitized = url.pathname.substring(1); // убираем leading slash
    }
  } catch (error) {
    console.warn(`Invalid URL format: ${path}`);
    return '';
  }

  // Декодируем URI компоненты для поддержки кириллицы
  try {
    sanitized = decodeURIComponent(sanitized);
  } catch (error) {
    console.warn(`Failed to decode URI: ${sanitized}`);
  }

  return sanitized;
}

/**
 * Извлечение компонентов пути трека с поддержкой кириллицы
 */
function parseTrackPath(fullUrl: string): {
  artistName: string;
  albumName: string;
  trackName: string;
} | null {
  try {
    const path = sanitizePath(fullUrl);
    const parts = path.split('/');
    
    if (parts.length !== 4 || parts[0] !== 'music') {
      console.warn(`Invalid track URL structure: '${fullUrl}' | Expected: music/artist/album/track.mp3 | Got parts:`, parts);
      return null;
    }

    const [, artistName, albumRaw, trackFile] = parts;
    
    // Улучшенная очистка названия альбома
    const albumName = albumRaw
      .replace(/^(Album|EP|Demo)\.\s*/i, '') // Убираем префиксы
      .replace(/^\d{4}[\s\-_]*/, '') // Убираем год
      .trim() || 'Unknown Album';
    
    // Улучшенная очистка названия трека
    const trackNameWithExt = trackFile.replace(/^\d{1,2}[\s.\-_]*/, ''); // Убираем номер трека
    const trackName = trackNameWithExt
      .replace(/\.[^.]+$/, '') // Убираем расширение
      .replace(/[\[\(].*?[\]\)]/g, '') // Убираем содержимое в скобках
      .trim() || 'Unknown Track';

    return {
      artistName: artistName.trim(),
      albumName,
      trackName
    };
  } catch (error) {
    console.error(`Error parsing track path '${fullUrl}':`, error);
    return null;
  }
}

// ================================================================================
// REDIS CLIENT MANAGEMENT
// ================================================================================

const getRedisClient = (): Redis | null => {
  if (!redis && process.env.REDIS_URL) {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is not defined');
      }

      redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        enableReadyCheck: false,
        // maxLoadingTimeout: 1000, ❌ УБРАТЬ - не поддерживается
        commandTimeout: 5000,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error);
      });

      redis.on('connect', () => {
        console.log('✅ Connected to Redis for stats');
      });

      redis.on('reconnecting', () => {
        console.log('🔄 Reconnecting to Redis...');
      });

    } catch (error) {
      console.error('💥 Failed to create Redis client:', error);
      redis = null;
    }
  }
  return redis;
};



// ================================================================================
// AUTHORIZATION
// ================================================================================

/**
 * Улучшенная авторизация пользователя
 */
function authorize(request: NextRequest): boolean {
  const expectedToken = process.env.ANALYTICS_TOKEN || process.env.STATS_API_SECRET;
  
  if (!expectedToken) {
    console.error('⚠️ ANALYTICS_TOKEN/STATS_API_SECRET не установлен на сервере');
    return false;
  }

  const authHeader = request.headers.get('authorization') || '';
  
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('⚠️ Missing or invalid Authorization header format');
    return false;
  }

  const token = authHeader.split(' ')[1];
  const isValid = token === expectedToken;
  
  if (!isValid) {
    console.warn('⚠️ Invalid authentication token provided');
  }
  
  return isValid;
}

// ================================================================================
// DATA PROCESSING FUNCTIONS
// ================================================================================

/**
 * Безопасная конвертация строковых значений в числа
 */
function convertToNumbers(obj: Record<string, string> | null | undefined): Record<string, number> {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      result[key] = isNaN(num) ? 0 : num;
    } else {
      result[key] = 0;
    }
  }
  return result;
}

/**
 * Извлечение всех данных из Redis с улучшенной обработкой ошибок
 */
async function fetchAllData(redisClient: Redis): Promise<AllDataResponse> {
  const pipe = redisClient.pipeline();
  
  // Основные счетчики и статистика
  pipe.hgetall('v2:listen_counts');
  pipe.hgetall('v2:stats:browsers');
  pipe.hgetall('v2:stats:os');
  pipe.hgetall('v2:stats:devices');
  pipe.hgetall('v2:stats:countries');
  pipe.hgetall('v2:diagnostic_logs');
  
  // Получаем все ключи событий
  let eventKeys: string[] = [];
  try {
    eventKeys = await redisClient.keys('v2:events:*');
    console.log(`📊 Found ${eventKeys.length} event keys`);
  } catch (error) {
    console.warn('⚠️ Failed to fetch event keys:', error);
  }
  
  // Добавляем запросы для всех событий
  if (eventKeys.length > 0) {
    for (const key of eventKeys) {
      pipe.hgetall(key);
    }
  }
  
  const results = await pipe.exec();
  
  if (!results) {
    throw new Error('Redis pipeline execution failed');
  }

  // Обработка диагностических логов с улучшенной валидацией
  const rawLogs = (results[5]?.[1] as Record<string, string>) || {};
  const diagnosticLogs: any[] = [];
  
  for (const [logKey, logJson] of Object.entries(rawLogs)) {
    if (!logJson || typeof logJson !== 'string') continue;
    
    try {
      const record = JSON.parse(logJson);
      if (record && typeof record === 'object' && record.timestamp) {
        diagnosticLogs.push({
          ...record,
          _key: logKey // Добавляем ключ для отладки
        });
      }
    } catch (error) {
      console.warn(`Invalid JSON in diagnostic log ${logKey}:`, error);
      continue;
    }
  }
  
  // Сортируем логи по времени (новые сначала) с безопасной обработкой
  const sortedLogs = diagnosticLogs.sort((a, b) => {
    try {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    } catch (error) {
      return 0;
    }
  });

  // Обработка событий с улучшенной валидацией
  const eventData: Record<string, Record<string, number>> = {};
  if (eventKeys.length > 0) {
    const eventResults = results.slice(6);
    for (let i = 0; i < eventKeys.length; i++) {
      const eventResult = eventResults[i];
      if (eventResult && eventResult[0] === null && eventResult[1]) {
        const eventCounts = convertToNumbers(eventResult[1] as Record<string, string>);
        if (Object.keys(eventCounts).length > 0) {
          eventData[eventKeys[i]] = eventCounts;
        }
      }
    }
  }

  // Формируем структуру данных с безопасной обработкой
  return {
    listen_counts: convertToNumbers(results[0]?.[1] as Record<string, string>),
    browsers: convertToNumbers(results[1]?.[1] as Record<string, string>),
    os: convertToNumbers(results[2]?.[1] as Record<string, string>),
    devices: convertToNumbers(results[3]?.[1] as Record<string, string>),
    countries: convertToNumbers(results[4]?.[1] as Record<string, string>),
    diagnostic_logs: sortedLogs.slice(0, 100), // Ограничиваем количество логов
    events: eventData,
    _debug_info: {
      raw_listen_count_keys: Object.keys(results[0]?.[1] as Record<string, string> || {}),
      raw_diagnostic_logs: Object.keys(rawLogs).slice(0, 5)
    }
  };
}

/**
 * Улучшенная обработка статистики по трекам с поддержкой кириллицы
 */
function processTrackStats(
  listenCounts: Record<string, number>, 
  allEvents: Record<string, Record<string, number>>
): Record<string, TrackStats> {
  const groupedStats: Record<string, TrackStats> = {};
  let processedCount = 0;
  let skippedCount = 0;

  for (const [fullUrl, plays] of Object.entries(listenCounts)) {
    if (!fullUrl || typeof plays !== 'number' || plays <= 0) {
      skippedCount++;
      continue;
    }

    const trackInfo = parseTrackPath(fullUrl);
    if (!trackInfo) {
      skippedCount++;
      continue;
    }

    const { artistName, albumName, trackName } = trackInfo;
    
    // Получение событий для этого трека
    const eventKey = `v2:events:${fullUrl}`;
    const eventDetails = allEvents[eventKey] || {};

    // Инициализация структуры данных для артиста
    if (!groupedStats[artistName]) {
      groupedStats[artistName] = {
        total_plays: 0,
        albums: {}
      };
    }

    // Инициализация структуры данных для альбома
    if (!groupedStats[artistName].albums[albumName]) {
      groupedStats[artistName].albums[albumName] = {
        total_plays: 0,
        tracks: []
      };
    }

    // Агрегация статистики
    const artistStats = groupedStats[artistName];
    const albumStats = artistStats.albums[albumName];
    
    artistStats.total_plays += plays;
    albumStats.total_plays += plays;
    albumStats.tracks.push({
      title: trackName,
      plays: plays,
      events: eventDetails
    });

    processedCount++;
  }

  console.log(`📊 Track stats processing: ${processedCount} processed, ${skippedCount} skipped`);
  
  // Сортируем треки в каждом альбоме по количеству прослушиваний
  for (const artistStats of Object.values(groupedStats)) {
    for (const albumStats of Object.values(artistStats.albums)) {
      albumStats.tracks.sort((a, b) => b.plays - a.plays);
    }
  }
  
  return groupedStats;
}

// ================================================================================
// MAIN API ROUTE
// ================================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('📊 Stats API request started');

    // Авторизация
    if (!authorize(request)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized access. Valid token required.' 
        },
        { status: 401 }
      );
    }

    // Подключение к Redis
    const redisClient = getRedisClient();
    if (!redisClient) {
      console.error('❌ Redis client not available');
      return NextResponse.json(
        { 
          success: false,
          error: 'Database configuration is missing. Please check Redis connection.' 
        },
        { status: 500 }
      );
    }

    // Проверка соединения с Redis
    try {
      await redisClient.ping();
      console.log('✅ Redis connection verified');
    } catch (error) {
      console.error('❌ Redis ping failed:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Database connection failed.' 
        },
        { status: 503 }
      );
    }

    // Получение всех данных
    console.log('🔍 Fetching data from Redis...');
    const allData = await fetchAllData(redisClient);
    
    // Обработка статистики по трекам
    console.log('🔄 Processing track statistics...');
    const trackStats = processTrackStats(allData.listen_counts, allData.events);
    
    const processingTime = Date.now() - startTime;
    
    // Формирование финального ответа
    const finalResponse: StatsAPIResponse = {
      success: true,
      track_stats: trackStats,
      audience_stats: {
        browsers: allData.browsers,
        os: allData.os,
        devices: allData.devices,
        countries: allData.countries,
      },
      diagnostic_logs: allData.diagnostic_logs,
      _debug_info: {
        ...allData._debug_info,
        processing_time: processingTime
      }
    };

    console.log(`✅ Stats API completed in ${processingTime}ms`);
    console.log(`📈 Summary: ${Object.keys(trackStats).length} artists, ${allData.diagnostic_logs.length} logs`);
    
    return NextResponse.json(finalResponse, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-cache',
        'X-Processing-Time': `${processingTime}ms`,
        'X-Artists-Count': Object.keys(trackStats).length.toString(),
      }
    });

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    
    console.error('💥 Critical error in stats handler:', error);
    
    // Детальная обработка различных типов ошибок
    let errorMessage = 'An internal server error occurred.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
      
      if (error.message?.includes('Redis') || error.message?.includes('connect')) {
        errorMessage = 'Database connection failed. Please try again later.';
        statusCode = 503;
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timeout. Please try again.';
        statusCode = 504;
      } else if (error.message?.includes('unauthorized') || error.message?.includes('auth')) {
        errorMessage = 'Authentication failed.';
        statusCode = 401;
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        processing_time: processingTime
      },
      { 
        status: statusCode,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Error': 'true',
          'X-Processing-Time': `${processingTime}ms`
        }
      }
    );
  }
}

// ================================================================================
// GRACEFUL SHUTDOWN HANDLERS
// ================================================================================

const gracefulShutdown = () => {
  console.log('🔄 Graceful shutdown initiated...');
  if (redis) {
    redis.disconnect();
    console.log('✅ Redis connection closed');
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
