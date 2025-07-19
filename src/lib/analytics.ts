// src/lib/analytics.ts

import Redis from 'ioredis';

let redis: Redis | null = null;

const getRedisClient = () => {
  if (!redis && process.env.REDIS_URL) {
    try {
      // Вариант 1: Минимальная конфигурация (совместима со всеми версиями)
      redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        // Убираем socket секцию полностью
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      redis.on('connect', () => {
        console.log('Connected to Redis');
      });

    } catch (error) {
      console.error('Failed to create Redis client:', error);
      redis = null;
    }
  }
  return redis;
};

export async function trackEvent(eventData: {
  trackId: string;
  event: string;
  timestamp?: number;
  userAgent?: string;
  ip?: string;
}) {
  try {
    const client = getRedisClient();
    if (!client) {
      console.warn('Redis client not available, skipping analytics');
      return;
    }

    const data = {
      ...eventData,
      timestamp: eventData.timestamp || Date.now(),
    };

    await client.lpush('music:events', JSON.stringify(data));
    await client.ltrim('music:events', 0, 9999);

    console.log(`Tracked event: ${eventData.event} for track: ${eventData.trackId}`);
    
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export async function getAnalytics(trackId?: string) {
  try {
    const client = getRedisClient();
    if (!client) {
      return { error: 'Redis not available' };
    }

    const events = await client.lrange('music:events', 0, -1);
    const parsedEvents = events.map(event => {
      try {
        return JSON.parse(event);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const filteredEvents = trackId 
      ? parsedEvents.filter(event => event.trackId === trackId)
      : parsedEvents;

    const eventCounts = filteredEvents.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEvents: filteredEvents.length,
      eventCounts,
      recentEvents: filteredEvents.slice(0, 100)
    };

  } catch (error) {
    console.error('Failed to get analytics:', error);
    return { error: 'Failed to retrieve analytics' };
  }
}

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
