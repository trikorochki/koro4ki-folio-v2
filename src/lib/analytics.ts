// src/lib/analytics.ts
import { NextRequest } from 'next/server';
import { createClient } from 'redis';
import { UAParser } from 'ua-parser-js';

// Создаем глобальный Redis клиент с улучшенным управлением состоянием
let redis: ReturnType<typeof createClient> | null = null;
let isConnected = false;
let connectionPromise: Promise<ReturnType<typeof createClient>> | null = null;

async function getRedisClient() {
  // Если уже есть активное подключение, возвращаем его
  if (redis && isConnected) {
    return redis;
  }
  
  // Если идет процесс подключения, ждем его завершения
  if (connectionPromise) {
    return connectionPromise;
  }
  
  // Создаем новое подключение
  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      if (!redis) {
        redis = createClient({
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          socket: {
            connectTimeout: 10000,
            lazyConnect: true,
          },
          retry_delay_on_failover: 100,
          retry_delay_on_cluster_down: 300,
        });
        
        redis.on('error', (err) => {
          console.error('Redis connection error:', err);
          isConnected = false;
        });

        redis.on('connect', () => {
          console.log('Redis connected successfully');
          isConnected = true;
        });

        redis.on('end', () => {
          console.log('Redis connection ended');
          isConnected = false;
        });

        redis.on('reconnecting', () => {
          console.log('Redis reconnecting...');
          isConnected = false;
        });
      }
      
      if (!isConnected) {
        await redis.connect();
        isConnected = true;
      }
      
      connectionPromise = null;
      resolve(redis);
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      connectionPromise = null;
      reject(error);
    }
  });
  
  return connectionPromise;
}

// Функция для безопасного закрытия подключения
export async function closeRedisConnection() {
  if (redis && isConnected) {
    try {
      await redis.quit();
      isConnected = false;
      redis = null;
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}

export class Analytics {
  private async getUserInfo(request: NextRequest) {
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               request.headers.get('cf-connecting-ip') || 
               '127.0.0.1';
    
    try {
      const parser = new UAParser(userAgent);
      const result = parser.getResult();
      
      return {
        userAgent,
        ip: ip.split(',')[0].trim(), // Берем первый IP если несколько
        browser: result.browser.name || 'Unknown',
        browserVersion: result.browser.version || 'Unknown',
        os: result.os.name || 'Unknown',
        osVersion: result.os.version || 'Unknown',
        device: result.device.type || 'desktop',
        deviceModel: result.device.model || 'Unknown',
        country: 'Unknown', // Можно добавить GeoIP определение
      };
    } catch (error) {
      console.error('Error parsing user agent:', error);
      return {
        userAgent,
        ip: ip.split(',')[0].trim(),
        browser: 'Unknown',
        browserVersion: 'Unknown',
        os: 'Unknown',
        osVersion: 'Unknown',
        device: 'desktop',
        deviceModel: 'Unknown',
        country: 'Unknown',
      };
    }
  }

  async recordListen(trackId: string, request: NextRequest) {
    // Проверяем валидность trackId
    if (!trackId || typeof trackId !== 'string' || trackId.trim() === '') {
      console.warn('Invalid trackId provided to recordListen:', trackId);
      return;
    }

    try {
      const redisClient = await getRedisClient();
      const userInfo = await this.getUserInfo(request);
      const timestamp = Date.now();
      
      // Создаем транзакцию для атомарности операций
      const pipeline = redisClient.multi();
      
      // Основные счетчики
      pipeline.hIncrBy('v2:listen_counts', trackId, 1);
      pipeline.hIncrBy('v2:listen_counts:daily', `${trackId}:${new Date().toISOString().split('T')[0]}`, 1);
      
      // События для детальной аналитики
      pipeline.zAdd(`v2:events:${trackId}`, {
        score: timestamp,
        value: JSON.stringify({
          timestamp,
          sessionId: request.headers.get('x-session-id') || 'anonymous',
          ...userInfo,
        })
      });
      
      // Статистика по браузерам
      pipeline.hIncrBy('v2:stats:browsers', userInfo.browser, 1);
      pipeline.hIncrBy('v2:stats:browsers:versions', `${userInfo.browser}:${userInfo.browserVersion}`, 1);
      
      // Статистика по ОС
      pipeline.hIncrBy('v2:stats:os', userInfo.os, 1);
      pipeline.hIncrBy('v2:stats:os:versions', `${userInfo.os}:${userInfo.osVersion}`, 1);
      
      // Статистика по устройствам
      pipeline.hIncrBy('v2:stats:devices', userInfo.device, 1);
      pipeline.hIncrBy('v2:stats:countries', userInfo.country, 1);
      
      // Логи для диагностики (с TTL)
      pipeline.zAdd('v2:diagnostic_logs', {
        score: timestamp,
        value: JSON.stringify({
          timestamp,
          trackId,
          action: 'listen',
          ip: userInfo.ip,
          userAgent: userInfo.userAgent.substring(0, 200), // Ограничиваем длину
        })
      });
      
      // Очистка старых логов (старше 30 дней)
      const thirtyDaysAgo = timestamp - (30 * 24 * 60 * 60 * 1000);
      pipeline.zRemRangeByScore('v2:diagnostic_logs', '-inf', thirtyDaysAgo);
      
      await pipeline.exec();
      
      console.log(`Recorded listen for track: ${trackId}`);
    } catch (error) {
      console.error('Error recording listen:', error);
      // Не бросаем ошибку, чтобы не ломать воспроизведение музыки
    }
  }

  async getStats() {
    try {
      const redisClient = await getRedisClient();
      
      const [
        listenCounts,
        dailyListens,
        browsers,
        browserVersions,
        os,
        osVersions,
        devices,
        countries,
      ] = await Promise.all([
        redisClient.hGetAll('v2:listen_counts'),
        redisClient.hGetAll('v2:listen_counts:daily'),
        redisClient.hGetAll('v2:stats:browsers'),
        redisClient.hGetAll('v2:stats:browsers:versions'),
        redisClient.hGetAll('v2:stats:os'),
        redisClient.hGetAll('v2:stats:os:versions'),
        redisClient.hGetAll('v2:stats:devices'),
        redisClient.hGetAll('v2:stats:countries'),
      ]);

      // Подсчитываем общую статистику
      const totalListens = Object.values(listenCounts || {}).reduce((sum, count) => sum + parseInt(count as string, 10), 0);
      const totalTracks = Object.keys(listenCounts || {}).length;
      
      return {
        summary: {
          totalListens,
          totalTracks,
          uniqueBrowsers: Object.keys(browsers || {}).length,
          uniqueCountries: Object.keys(countries || {}).length,
        },
        tracks: listenCounts || {},
        dailyStats: dailyListens || {},
        browsers: browsers || {},
        browserVersions: browserVersions || {},
        os: os || {},
        osVersions: osVersions || {},
        devices: devices || {},
        countries: countries || {},
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        summary: {
          totalListens: 0,
          totalTracks: 0,
          uniqueBrowsers: 0,
          uniqueCountries: 0,
        },
        tracks: {},
        dailyStats: {},
        browsers: {},
        browserVersions: {},
        os: {},
        osVersions: {},
        devices: {},
        countries: {},
      };
    }
  }

  async getTopTracks(limit: number = 10) {
    try {
      const redisClient = await getRedisClient();
      const listenCounts = await redisClient.hGetAll('v2:listen_counts');
      
      const sortedTracks = Object.entries(listenCounts || {})
        .map(([trackId, count]) => ({ trackId, count: parseInt(count as string, 10) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      
      return sortedTracks;
    } catch (error) {
      console.error('Error getting top tracks:', error);
      return [];
    }
  }

  async getTrackStats(trackId: string) {
    if (!trackId) return null;
    
    try {
      const redisClient = await getRedisClient();
      
      const [listens, events] = await Promise.all([
        redisClient.hGet('v2:listen_counts', trackId),
        redisClient.zRange(`v2:events:${trackId}`, 0, -1, { REV: true, LIMIT: { offset: 0, count: 100 } })
      ]);
      
      const recentEvents = events.map(event => {
        try {
          return JSON.parse(event);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      return {
        trackId,
        totalListens: parseInt(listens || '0', 10),
        recentEvents: recentEvents.slice(0, 10), // Последние 10 событий
      };
    } catch (error) {
      console.error('Error getting track stats:', error);
      return null;
    }
  }
}

export const analytics = new Analytics();
