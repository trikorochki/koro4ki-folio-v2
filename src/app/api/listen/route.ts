// src/app/api/listen/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { UAParser } from 'ua-parser-js';

export const dynamic = 'force-dynamic';

let redis: Redis | null = null;

const getRedisClient = () => {
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
        // Добавляем стратегию повтора вместо кластерных опций
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      redis.on('connect', () => {
        console.log('Connected to Redis for analytics');
      });

      redis.on('reconnecting', () => {
        console.log('Reconnecting to Redis...');
      });

    } catch (error) {
      console.error('Failed to create Redis client:', error);
      redis = null;
    }
  }
  return redis;
};


// Улучшенный парсинг User-Agent
function parseUserAgent(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || '',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || '',
    device: result.device.model || '',
    isMobile: result.device.type === 'mobile' || result.device.type === 'tablet',
    deviceType: result.device.type === 'mobile' || result.device.type === 'tablet' ? 'Mobile' : 'Desktop'
  };
}

// Улучшенное извлечение IP адреса для Vercel
function extractIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  
  if (realIp) {
    return realIp.trim();
  }
  
  return 'Not Found';
}

// Валидация входных данных
function validateTrackId(trackId: string): boolean {
  if (!trackId || typeof trackId !== 'string') return false;
  if (trackId.length > 200) return false;
  if (trackId.includes('<') || trackId.includes('>')) return false;
  return true;
}

function validateEventType(eventType: string): boolean {
  const allowedEvents = [
    '30s_listen',
    'track_start', 
    'track_complete',
    'track_skip',
    'playlist_add',
    'download_attempt',
    'unknown'
  ];
  return allowedEvents.includes(eventType);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Валидация Content-Length
    const contentLength = request.headers.get('content-length');
    if (!contentLength || parseInt(contentLength) === 0) {
      return NextResponse.json(
        { error: 'Request body is empty.' },
        { status: 400 }
      );
    }

    // Защита от слишком больших запросов
    if (parseInt(contentLength) > 10000) {
      return NextResponse.json(
        { error: 'Request body too large.' },
        { status: 413 }
      );
    }

    // 2. Парсинг JSON данных
    let data: any;
    try {
      data = await request.json();
    } catch (error) {
      console.warn('Failed to decode JSON from request body.');
      return NextResponse.json(
        { error: 'Invalid JSON format.' },
        { status: 400 }
      );
    }

    // 3. Валидация обязательных полей
    const trackId = data.trackId;
    if (!validateTrackId(trackId)) {
      return NextResponse.json(
        { error: 'trackId is required and must be valid.' },
        { status: 400 }
      );
    }

    const eventType = data.event || data.eventType || 'unknown';
    
    if (!validateEventType(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type.' },
        { status: 400 }
      );
    }

    // 4. Извлечение метаданных запроса
    const userAgentString = request.headers.get('user-agent') || 'Unknown';
    const userAgent = parseUserAgent(userAgentString);
    const ipAddress = extractIpAddress(request);
    const countryCode = request.headers.get('x-vercel-ip-country') || 'XX';

    // 5. Подключение к Redis
    const redisClient = getRedisClient();
    if (!redisClient) {
      console.error('Redis client not available');
      return NextResponse.json(
        { error: 'Service Unavailable: Cannot connect to the database.' },
        { status: 503 }
      );
    }

    // 6. Атомарные операции Redis
    const pipe = redisClient.pipeline();

    // Основные счетчики прослушиваний
    if (eventType === '30s_listen') {
      pipe.hincrby('v2:listen_counts', trackId, 1);
    }

    // События по трекам
    pipe.hincrby(`v2:events:${trackId}`, eventType, 1);

    // Статистика по браузерам, ОС, устройствам, странам
    pipe.hincrby('v2:stats:browsers', userAgent.browser, 1);
    pipe.hincrby('v2:stats:os', userAgent.os, 1);
    pipe.hincrby('v2:stats:devices', userAgent.deviceType, 1);
    pipe.hincrby('v2:stats:countries', countryCode, 1);

    // Диагностические логи
    const timestamp = new Date().toISOString();
    const logKey = `${timestamp}-${ipAddress.substring(0, 15)}`; // Ограничиваем длину
    
    const logPayload = JSON.stringify({
      ip: ipAddress,
      country: countryCode,
      userAgent: userAgentString.substring(0, 500), // Ограничиваем длину
      trackId: trackId,
      eventType: eventType,
      timestamp: timestamp,
      browser: userAgent.browser,
      os: userAgent.os,
      device: userAgent.deviceType
    });
    
    pipe.hset('v2:diagnostic_logs', logKey, logPayload);

    // Ограничиваем размер логов (оставляем последние 10000 записей)
    pipe.hlen('v2:diagnostic_logs');

    // 7. Выполнение всех команд
    const results = await pipe.exec();
    
    if (!results) {
      throw new Error('Redis pipeline execution failed');
    }

    // Проверяем размер логов и очищаем при необходимости
    const logCount = results[results.length - 1]?.[1] as number;
    if (logCount && logCount > 10000) {
      // Асинхронно очищаем старые логи
      setImmediate(async () => {
        try {
          const allLogs = await redisClient.hgetall('v2:diagnostic_logs');
          const sortedEntries = Object.entries(allLogs)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 5000);
          
          await redisClient.del('v2:diagnostic_logs');
          if (sortedEntries.length > 0) {
            await redisClient.hset('v2:diagnostic_logs', Object.fromEntries(sortedEntries));
          }
        } catch (cleanupError) {
          console.error('Failed to cleanup logs:', cleanupError);
        }
      });
    }

    console.log(`Successfully processed event '${eventType}' for track '${trackId}' from ${countryCode}.`);
    
    // 8. Возврат успешного ответа (статус 204 No Content)
    return new NextResponse(null, { status: 204 });

  } catch (error: any) {
    console.error('An unexpected error occurred in listen handler:', error);
    
    // Специальная обработка разных типов ошибок
    if (error.message?.includes('Redis') || error.message?.includes('connect')) {
      return NextResponse.json(
        { error: 'Service Unavailable: Cannot connect to the database.' },
        { status: 503 }
      );
    }
    
    if (error.message?.includes('JSON') || error.name === 'SyntaxError') {
      return NextResponse.json(
        { error: 'Invalid JSON format.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// GET метод для проверки состояния и статистики
export async function GET(request: NextRequest) {
  try {
    const redisClient = getRedisClient();
    
    if (!redisClient) {
      return NextResponse.json({
        status: 'Analytics endpoint is running',
        redis: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }

    // Получаем базовую статистику
    const totalListens = await redisClient.hlen('v2:listen_counts');
    const totalLogs = await redisClient.hlen('v2:diagnostic_logs');

    return NextResponse.json({
      status: 'Analytics endpoint is running',
      redis: 'connected',
      stats: {
        totalTracksWithListens: totalListens,
        totalDiagnosticLogs: totalLogs
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      status: 'Analytics endpoint is running',
      redis: 'error',
      error: 'Failed to get stats',
      timestamp: new Date().toISOString()
    });
  }
}

// CORS поддержка
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
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
