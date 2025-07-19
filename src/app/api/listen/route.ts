// src/app/api/listen/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { UAParser } from 'ua-parser-js';

let redis: Redis | null = null;

const getRedisClient = () => {
  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      redis.on('connect', () => {
        console.log('Connected to Redis for analytics');
      });

    } catch (error) {
      console.error('Failed to create Redis client:', error);
      redis = null;
    }
  }
  return redis;
};

// Парсинг User-Agent (упрощенная версия)
function parseUserAgent(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    isMobile: result.device.type === 'mobile',
    deviceType: result.device.type === 'mobile' ? 'Mobile' : 'Desktop'
  };
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
    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId is required.' },
        { status: 400 }
      );
    }

    const eventType = data.event || data.eventType || 'unknown';

    // 4. Извлечение метаданных запроса
    const userAgentString = request.headers.get('user-agent') || 'Unknown';
    const userAgent = parseUserAgent(userAgentString);
    
    // Vercel предоставляет эти заголовки автоматически
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'Not Found';
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

    // 6. Атомарные операции Redis (эквивалент pipeline)
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
    const logKey = `${timestamp}-${ipAddress}`;
    
    const logPayload = JSON.stringify({
      ip: ipAddress,
      country: countryCode,
      userAgent: userAgentString,
      trackId: trackId,
      eventType: eventType,
      timestamp: timestamp
    });
    
    pipe.hset('v2:diagnostic_logs', logKey, logPayload);

    // 7. Выполнение всех команд
    await pipe.exec();

    console.log(`Successfully processed event '${eventType}' for track '${trackId}'.`);
    
    // 8. Возврат успешного ответа (статус 204 No Content)
    return new NextResponse(null, { status: 204 });

  } catch (error: any) {
    console.error('An unexpected error occurred in listen handler:', error);
    
    // Проверка на ошибки подключения к Redis
    if (error.message?.includes('Redis') || error.message?.includes('connect')) {
      return NextResponse.json(
        { error: 'Service Unavailable: Cannot connect to the database.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// Опциональный GET метод для проверки состояния
export async function GET() {
  return NextResponse.json({
    status: 'Analytics endpoint is running',
    timestamp: new Date().toISOString()
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
