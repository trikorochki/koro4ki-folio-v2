// src/app/api/listen/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { UAParser } from 'ua-parser-js';

// Принудительно делаем route динамическим для Vercel
export const dynamic = 'force-dynamic';

// ================================================================================
// TYPES & INTERFACES
// ================================================================================

interface UserAgentInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  isMobile: boolean;
  deviceType: 'Mobile' | 'Desktop';
}

interface AnalyticsPayload {
  ip: string;
  country: string;
  userAgent: string;
  trackId: string;
  eventType: string;
  timestamp: string;
  browser: string;
  os: string;
  device: string;
}

// ================================================================================
// CONSTANTS
// ================================================================================

const ALLOWED_EVENT_TYPES = [
  '30s_listen',
  'track_start',
  'track_complete',
  'track_skip',
  'playlist_add',
  'download_attempt',
  'unknown'
] as const;

const REDIS_KEYS = {
  LISTEN_COUNTS: 'v2:listen_counts',
  EVENTS: 'v2:events',
  STATS_BROWSERS: 'v2:stats:browsers',
  STATS_OS: 'v2:stats:os',
  STATS_DEVICES: 'v2:stats:devices',
  STATS_COUNTRIES: 'v2:stats:countries',
  DIAGNOSTIC_LOGS: 'v2:diagnostic_logs'
} as const;

const LIMITS = {
  MAX_REQUEST_SIZE: 10000,
  MAX_TRACK_ID_LENGTH: 200,
  MAX_USER_AGENT_LENGTH: 500,
  MAX_IP_LENGTH: 15,
  MAX_LOG_ENTRIES: 10000,
  CLEANUP_LOG_ENTRIES: 5000
} as const;

// ================================================================================
// REDIS CLIENT SINGLETON
// ================================================================================

let redis: Redis | null = null;

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
        retryStrategy: (times: number): number | void => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err: Error): boolean => {
          const targetErrors = ['READONLY', 'ECONNRESET'];
          return targetErrors.some(targetError => err.message.includes(targetError));
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

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

function parseUserAgent(userAgent: string): UserAgentInfo {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  const isMobileDevice = result.device.type === 'mobile' || result.device.type === 'tablet';
  
  return {
    browser: result.browser.name || 'Unknown',
    browserVersion: result.browser.version || '',
    os: result.os.name || 'Unknown',
    osVersion: result.os.version || '',
    device: result.device.model || '',
    isMobile: isMobileDevice,
    deviceType: isMobileDevice ? 'Mobile' : 'Desktop'
  };
}

function extractIpAddress(request: NextRequest): string {
  const headers = [
    'x-forwarded-for',
    'cf-connecting-ip',
    'x-real-ip'
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      return value.split(',')[0].trim();
    }
  }

  return 'Unknown';
}

function validateTrackId(trackId: unknown): trackId is string {
  if (!trackId || typeof trackId !== 'string') return false;
  if (trackId.length > LIMITS.MAX_TRACK_ID_LENGTH) return false;
  if (/<|>/.test(trackId)) return false;
  return true;
}

function validateEventType(eventType: string): eventType is typeof ALLOWED_EVENT_TYPES[number] {
  return ALLOWED_EVENT_TYPES.includes(eventType as any);
}

function sanitizeString(input: string, maxLength: number): string {
  return input.substring(0, maxLength);
}

function createLogKey(timestamp: string, ipAddress: string): string {
  const sanitizedIp = sanitizeString(ipAddress, LIMITS.MAX_IP_LENGTH);
  return `${timestamp}-${sanitizedIp}`;
}

function createAnalyticsPayload(
  trackId: string,
  eventType: string,
  userAgent: UserAgentInfo,
  userAgentString: string,
  ipAddress: string,
  countryCode: string,
  timestamp: string
): AnalyticsPayload {
  return {
    ip: ipAddress,
    country: countryCode,
    userAgent: sanitizeString(userAgentString, LIMITS.MAX_USER_AGENT_LENGTH),
    trackId,
    eventType,
    timestamp,
    browser: userAgent.browser,
    os: userAgent.os,
    device: userAgent.deviceType
  };
}

// ================================================================================
// REDIS OPERATIONS
// ================================================================================

async function executeAnalyticsOperations(
  redisClient: Redis,
  trackId: string,
  eventType: string,
  userAgent: UserAgentInfo,
  countryCode: string,
  logPayload: string,
  logKey: string
): Promise<number> {
  const pipe = redisClient.pipeline();

  // Основные счетчики прослушиваний
  if (eventType === '30s_listen') {
    pipe.hincrby(REDIS_KEYS.LISTEN_COUNTS, trackId, 1);
  }

  // События по трекам
  pipe.hincrby(`${REDIS_KEYS.EVENTS}:${trackId}`, eventType, 1);

  // Статистика по браузерам, ОС, устройствам, странам
  pipe.hincrby(REDIS_KEYS.STATS_BROWSERS, userAgent.browser, 1);
  pipe.hincrby(REDIS_KEYS.STATS_OS, userAgent.os, 1);
  pipe.hincrby(REDIS_KEYS.STATS_DEVICES, userAgent.deviceType, 1);
  pipe.hincrby(REDIS_KEYS.STATS_COUNTRIES, countryCode, 1);

  // Диагностические логи
  pipe.hset(REDIS_KEYS.DIAGNOSTIC_LOGS, logKey, logPayload);
  pipe.hlen(REDIS_KEYS.DIAGNOSTIC_LOGS);

  const results = await pipe.exec();
  
  if (!results) {
    throw new Error('Redis pipeline execution failed');
  }

  // Возвращаем количество логов для проверки необходимости очистки
  return (results[results.length - 1]?.[1] as number) || 0;
}

async function cleanupOldLogs(redisClient: Redis): Promise<void> {
  try {
    const allLogs = await redisClient.hgetall(REDIS_KEYS.DIAGNOSTIC_LOGS);
    const sortedEntries = Object.entries(allLogs)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, LIMITS.CLEANUP_LOG_ENTRIES);
    
    await redisClient.del(REDIS_KEYS.DIAGNOSTIC_LOGS);
    
    if (sortedEntries.length > 0) {
      await redisClient.hset(REDIS_KEYS.DIAGNOSTIC_LOGS, Object.fromEntries(sortedEntries));
    }
  } catch (cleanupError) {
    console.error('Failed to cleanup logs:', cleanupError);
  }
}

// ================================================================================
// API ROUTE HANDLERS
// ================================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Валидация размера запроса
    const contentLength = request.headers.get('content-length');
    const requestSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (requestSize === 0) {
      return NextResponse.json(
        { error: 'Request body is empty.' },
        { status: 400 }
      );
    }

    if (requestSize > LIMITS.MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large.' },
        { status: 413 }
      );
    }

    // 2. Парсинг и валидация JSON данных
    let requestData: any;
    try {
      requestData = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON format.' },
        { status: 400 }
      );
    }

    // 3. Валидация обязательных полей
    const { trackId } = requestData;
    if (!validateTrackId(trackId)) {
      return NextResponse.json(
        { error: 'trackId is required and must be valid.' },
        { status: 400 }
      );
    }

    const eventType = requestData.event || requestData.eventType || 'unknown';
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

    // 6. Подготовка данных для логирования
    const timestamp = new Date().toISOString();
    const logKey = createLogKey(timestamp, ipAddress);
    const analyticsPayload = createAnalyticsPayload(
      trackId,
      eventType,
      userAgent,
      userAgentString,
      ipAddress,
      countryCode,
      timestamp
    );
    const logPayload = JSON.stringify(analyticsPayload);

    // 7. Выполнение операций с Redis
    const logCount = await executeAnalyticsOperations(
      redisClient,
      trackId,
      eventType,
      userAgent,
      countryCode,
      logPayload,
      logKey
    );

    // 8. Асинхронная очистка логов при необходимости
    if (logCount > LIMITS.MAX_LOG_ENTRIES) {
      // Не блокируем ответ на очистке логов
      setImmediate(() => cleanupOldLogs(redisClient));
    }

    console.log(`Successfully processed event '${eventType}' for track '${trackId}' from ${countryCode}.`);
    
    return new NextResponse(null, { status: 204 });

  } catch (error: any) {
    console.error('An unexpected error occurred in listen handler:', error);
    
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

export async function GET(): Promise<NextResponse> {
  try {
    const redisClient = getRedisClient();
    
    if (!redisClient) {
      return NextResponse.json({
        status: 'Analytics endpoint is running',
        redis: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }

    const [totalListens, totalLogs] = await Promise.all([
      redisClient.hlen(REDIS_KEYS.LISTEN_COUNTS),
      redisClient.hlen(REDIS_KEYS.DIAGNOSTIC_LOGS)
    ]);

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
    console.error('Error in GET handler:', error);
    return NextResponse.json({
      status: 'Analytics endpoint is running',
      redis: 'error',
      error: 'Failed to get stats',
      timestamp: new Date().toISOString()
    });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
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

// ================================================================================
// GRACEFUL SHUTDOWN
// ================================================================================

const gracefulShutdown = (): void => {
  if (redis) {
    console.log('Disconnecting Redis client...');
    redis.disconnect();
    redis = null;
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
