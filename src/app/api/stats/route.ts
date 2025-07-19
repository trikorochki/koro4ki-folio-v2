// src/app/api/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

let redis: Redis | null = null;

// Интерфейс для возвращаемых данных
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
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      redis.on('connect', () => {
        console.log('Connected to Redis for stats');
      });

    } catch (error) {
      console.error('Failed to create Redis client:', error);
      redis = null;
    }
  }
  return redis;
};

// Авторизация пользователя
function authorize(request: NextRequest): boolean {
  const expectedToken = process.env.ANALYTICS_TOKEN || process.env.STATS_API_SECRET;
  
  if (!expectedToken) {
    console.error('ANALYTICS_TOKEN не установлен на сервере.');
    return false;
  }

  const authHeader = request.headers.get('authorization') || '';
  
  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  return token === expectedToken;
}

// Конвертация строковых значений в числа
function convertToNumbers(obj: Record<string, string>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = parseInt(value, 10) || 0;
  }
  return result;
}

// Извлечение всех данных из Redis
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
  const eventKeys = await redisClient.keys('v2:events:*');
  
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

  // Обработка диагностических логов
  const rawLogs = (results[5]?.[1] as Record<string, string>) || {};
  const diagnosticLogs: any[] = [];
  
  for (const logJson of Object.values(rawLogs)) {
    try {
      const record = JSON.parse(logJson);
      if (record.timestamp) {
        diagnosticLogs.push(record);
      }
    } catch (error) {
      // Игнорируем невалидные JSON записи
      continue;
    }
  }
  
  // Сортируем логи по времени (новые сначала)
  const sortedLogs = diagnosticLogs.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Обработка событий
  const eventData: Record<string, Record<string, number>> = {};
  if (eventKeys.length > 0) {
    const eventResults = results.slice(6);
    for (let i = 0; i < eventKeys.length; i++) {
      const eventResult = eventResults[i];
      if (eventResult && eventResult[1]) {
        eventData[eventKeys[i]] = convertToNumbers(eventResult[1] as Record<string, string>);
      }
    }
  }

  // Формируем и возвращаем структуру данных с правильными типами
  return {
    listen_counts: convertToNumbers(results[0]?.[1] as Record<string, string> || {}),
    browsers: convertToNumbers(results[1]?.[1] as Record<string, string> || {}),
    os: convertToNumbers(results[2]?.[1] as Record<string, string> || {}),
    devices: convertToNumbers(results[3]?.[1] as Record<string, string> || {}),
    countries: convertToNumbers(results[4]?.[1] as Record<string, string> || {}),
    diagnostic_logs: sortedLogs,
    events: eventData,
    _debug_info: {
      raw_listen_count_keys: Object.keys(results[0]?.[1] as Record<string, string> || {}),
      raw_diagnostic_logs: Object.values(rawLogs).slice(0, 5)
    }
  };
}

// Обработка статистики по трекам
function processTrackStats(
  listenCounts: Record<string, number>, 
  allEvents: Record<string, Record<string, number>>
) {
  const groupedStats: Record<string, {
    total_plays: number;
    albums: Record<string, {
      total_plays: number;
      tracks: Array<{
        title: string;
        plays: number;
        events: Record<string, number>;
      }>;
    }>;
  }> = {};

  for (const [fullUrl, plays] of Object.entries(listenCounts)) {
    try {
      // Парсинг URL трека: /music/artist/album/track.mp3
      let path = fullUrl;
      
      // Убираем возможный leading slash
      if (path.startsWith('/')) {
        path = path.substring(1);
      }
      
      // Если это полный URL, извлекаем path
      if (path.startsWith('http')) {
        const url = new URL(fullUrl);
        path = url.pathname.substring(1); // убираем leading slash
      }
      
      const parts = path.split('/');
      
      if (parts.length !== 4 || parts[0] !== 'music') {
        console.warn(`Skipping malformed track URL: '${fullUrl}' | Parts:`, parts);
        continue;
      }

      const [, artistName, albumRaw, trackFile] = parts;
      
      // Очистка названия альбома от префиксов (Album./EP./Demo.)
      const albumName = albumRaw.replace(/^(Album|EP|Demo)\.\s*/i, '').trim();
      
      // Очистка названия трека от номера и расширения
      const trackNameWithExt = trackFile.replace(/^\d{1,2}[\s.\-_]*/, '');
      const trackName = trackNameWithExt.replace(/\.[^.]+$/, '').trim();
      
      // Получение событий для этого трека
      const eventKey = `v2:events:${fullUrl}`;
      const eventDetails = allEvents[eventKey] || {};

      // Инициализация структуры данных
      if (!groupedStats[artistName]) {
        groupedStats[artistName] = {
          total_plays: 0,
          albums: {}
        };
      }

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

    } catch (error) {
      console.error(`Failed to process track stat for URL '${fullUrl}':`, error);
      continue;
    }
  }
  
  return groupedStats;
}

export async function GET(request: NextRequest) {
  try {
    // Авторизация
    if (!authorize(request)) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    // Подключение к Redis
    const redisClient = getRedisClient();
    if (!redisClient) {
      console.error('Redis client not available');
      return NextResponse.json(
        { error: 'Database configuration is missing.' },
        { status: 500 }
      );
    }

    // Получение всех данных
    const allData = await fetchAllData(redisClient);
    
    // Обработка статистики по трекам
    const trackStats = processTrackStats(allData.listen_counts, allData.events);
    
    // Формирование финального ответа
    const finalResponse = {
      track_stats: trackStats,
      audience_stats: {
        browsers: allData.browsers,
        os: allData.os,
        devices: allData.devices,
        countries: allData.countries,
      },
      diagnostic_logs: allData.diagnostic_logs,
      _debug_info: allData._debug_info
    };
    
    return NextResponse.json(finalResponse, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

  } catch (error: any) {
    console.error('An unexpected error occurred in stats handler:', error);
    
    // Специальная обработка ошибок подключения к Redis
    if (error.message?.includes('Redis') || error.message?.includes('connect')) {
      return NextResponse.json(
        { error: 'Database configuration is missing.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  if (redis) {
    redis.disconnect();
  }
});

process.on('SIGINT', () => {
  if (redis) {
    redis.disconnect();
  }
});
