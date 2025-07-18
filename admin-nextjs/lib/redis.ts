import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL is not configured')
    }
    
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }
  
  return redis
}

export interface ListenData {
  trackId: string
  plays: number
  artist: string
  album: string
  track: string
}

export interface StatsData {
  totalListens: number
  topTracks: Array<{
    name: string
    plays: number
    artist: string
    album: string
  }>
  countries: Record<string, number>
  devices: Record<string, number>
  browsers: Record<string, number>
}

export interface GeneralStats {
  totalPlays: number;
  uniqueListeners: number;
  totalTracks: number;
  [key: string]: any;
}

export async function getGeneralStats(): Promise<GeneralStats> {
  const redis = getRedis()
  
  const [
    listenCounts,
    countries,
    devices,
    browsers
  ] = await Promise.all([
    redis.hgetall('v2:listen_counts'),
    redis.hgetall('v2:stats:countries'),
    redis.hgetall('v2:stats:devices'),
    redis.hgetall('v2:stats:browsers')
  ])

  // Подсчитываем общее количество прослушиваний
  const totalListens = Object.values(listenCounts).reduce((sum, plays) => sum + parseInt(plays), 0)

  // Форматируем топ треки
  const topTracks = Object.entries(listenCounts)
    .sort(([,a], [,b]) => parseInt(b) - parseInt(a))
    .slice(0, 10)
    .map(([trackUrl, plays]) => {
      const parts = trackUrl.split('/')
      let artist = 'Unknown'
      let album = 'Unknown'
      let track = 'Unknown'
      
      if (parts.length >= 4 && parts[0] === 'music') {
        artist = decodeURIComponent(parts[1])
        album = decodeURIComponent(parts[2]).replace(/^(Album|EP|Demo)\.\s*/, '')
        track = decodeURIComponent(parts[3]).replace(/^\d{1,2}[\s.\-_]*/, '').replace(/\.[^.]+$/, '')
      }
      
      return {
        name: `${artist} - ${track}`,
        plays: parseInt(plays),
        artist,
        album
      }
    })

  return {
    totalListens,
    totalPlays: totalListens,
    uniqueListeners: Object.keys(listenCounts).length,
    totalTracks: topTracks.length,
    topTracks,
    countries: Object.fromEntries(Object.entries(countries).map(([k, v]) => [k, parseInt(v)])),
    devices: Object.fromEntries(Object.entries(devices).map(([k, v]) => [k, parseInt(v)])),
    browsers: Object.fromEntries(Object.entries(browsers).map(([k, v]) => [k, parseInt(v)]))
  }
}

export interface TrackStats {
  artist: string
  album: string
  track: string
  plays: number
  events: Record<string, number>
  url: string
}

export async function getTracksStats(): Promise<TrackStats[]> {
  const redis = getRedis()
  
  const [
    listenCounts,
    eventKeys
  ] = await Promise.all([
    redis.hgetall('v2:listen_counts'),
    redis.keys('v2:events:*')
  ])

  const tracks: TrackStats[] = []
  
  for (const [trackUrl, plays] of Object.entries(listenCounts)) {
    const parts = trackUrl.split('/')
    let artist = 'Unknown'
    let album = 'Unknown'
    let track = 'Unknown'
    
    if (parts.length >= 4 && parts[0] === 'music') {
      artist = decodeURIComponent(parts[1])
      album = decodeURIComponent(parts[2]).replace(/^(Album|EP|Demo)\.\s*/, '')
      track = decodeURIComponent(parts[3]).replace(/^\d{1,2}[\s.\-_]*/, '').replace(/\.[^.]+$/, '')
    }
    
    // Получаем события для этого трека
    const eventKey = `v2:events:${trackUrl}`
    const events = eventKeys.includes(eventKey) ? await redis.hgetall(eventKey) : {}
    
    tracks.push({
      artist,
      album,
      track,
      plays: parseInt(plays),
      events: Object.fromEntries(Object.entries(events).map(([k, v]) => [k, parseInt(v)])),
      url: trackUrl
    })
  }

  return tracks.sort((a, b) => b.plays - a.plays)
}

export async function getAudienceStats() {
  const redis = getRedis()
  
  const [
    countries,
    devices,
    browsers,
    os,
    diagnosticLogs
  ] = await Promise.all([
    redis.hgetall('v2:stats:countries'),
    redis.hgetall('v2:stats:devices'),
    redis.hgetall('v2:stats:browsers'),
    redis.hgetall('v2:stats:os'),
    redis.hgetall('v2:diagnostic_logs')
  ])

  // Обрабатываем диагностические логи
  const recentActivity: Array<{ timestamp: string; [key: string]: any }> = []
  for (const logData of Object.values(diagnosticLogs)) {
    try {
      const log = JSON.parse(logData)
      recentActivity.push(log)
    } catch (e) {
      console.warn('Failed to parse log:', e)
    }
  }

  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return {
    countries: Object.fromEntries(Object.entries(countries).map(([k, v]) => [k, parseInt(v)])),
    devices: Object.fromEntries(Object.entries(devices).map(([k, v]) => [k, parseInt(v)])),
    browsers: Object.fromEntries(Object.entries(browsers).map(([k, v]) => [k, parseInt(v)])),
    os: Object.fromEntries(Object.entries(os).map(([k, v]) => [k, parseInt(v)])),
    recentActivity: recentActivity.slice(0, 50),
    totalEvents: recentActivity.length
  }
}
