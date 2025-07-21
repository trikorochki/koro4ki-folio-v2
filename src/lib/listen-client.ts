// src/lib/listen-client.ts
'use client';

export interface ListenEvent {
  trackId: string;
  eventType: '30s_listen' | 'track_start' | 'track_complete' | 'track_skip' | 'playlist_add' | 'download_attempt';
}

export class ListenClient {
  private static instance: ListenClient;
  private pendingEvents: Set<string> = new Set();

  static getInstance(): ListenClient {
    if (!this.instance) {
      this.instance = new ListenClient();
    }
    return this.instance;
  }

  async trackEvent(event: ListenEvent): Promise<void> {
    const eventKey = `${event.trackId}-${event.eventType}-${Date.now()}`;
    
    // Предотвращение дублирования событий
    if (this.pendingEvents.has(eventKey)) {
      return;
    }

    this.pendingEvents.add(eventKey);

    try {
      const response = await fetch('/api/listen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackId: event.trackId,
          eventType: event.eventType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Tracked ${event.eventType} for track: ${event.trackId}`);
    } catch (error) {
      console.error(`❌ Failed to track ${event.eventType}:`, error);
    } finally {
      this.pendingEvents.delete(eventKey);
    }
  }

  async track30SecondListen(trackId: string): Promise<void> {
    return this.trackEvent({
      trackId,
      eventType: '30s_listen'
    });
  }

  async trackStart(trackId: string): Promise<void> {
    return this.trackEvent({
      trackId,
      eventType: 'track_start'
    });
  }

  async trackComplete(trackId: string): Promise<void> {
    return this.trackEvent({
      trackId,
      eventType: 'track_complete'
    });
  }

  async trackSkip(trackId: string): Promise<void> {
    return this.trackEvent({
      trackId,
      eventType: 'track_skip'
    });
  }
}

// Экспорт singleton instance
export const listenClient = ListenClient.getInstance();

// Convenience functions
export const track30SecondListen = (trackId: string) => listenClient.track30SecondListen(trackId);
export const trackStart = (trackId: string) => listenClient.trackStart(trackId);
export const trackComplete = (trackId: string) => listenClient.trackComplete(trackId);
export const trackSkip = (trackId: string) => listenClient.trackSkip(trackId);

/**
 * @deprecated Используйте listen-client.ts вместо analytics.ts
 * Этот файл оставлен для обратной совместимости
 */
export const trackEvent = (eventData: {
  trackId: string;
  event: string;
  timestamp?: number;
  userAgent?: string;
  ip?: string;
}) => {
  console.warn('⚠️ trackEvent is deprecated. Use listen-client.ts instead');
  
  // Маппинг старых событий на новые
  const eventTypeMap: Record<string, '30s_listen' | 'track_start' | 'track_complete' | 'track_skip'> = {
    'listen': '30s_listen',
    'play': 'track_start',
    'complete': 'track_complete',
    'skip': 'track_skip'
  };

  const eventType = eventTypeMap[eventData.event] || '30s_listen';
  
  return listenClient.trackEvent({
    trackId: eventData.trackId,
    eventType
  });
};

/**
 * @deprecated Используйте API endpoint /api/stats вместо getAnalytics
 */
export const getAnalytics = async (trackId?: string) => {
  console.warn('⚠️ getAnalytics is deprecated. Use /api/stats endpoint instead');
  
  try {
    const response = await fetch('/api/stats', {
      headers: {
        'Authorization': `Bearer ${process.env.ANALYTICS_TOKEN || process.env.STATS_API_SECRET}`
      }
    });

    if (!response.ok) {
      throw new Error(`Stats API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Преобразуем в старый формат для совместимости
    return {
      totalEvents: data.diagnostic_logs?.length || 0,
      eventCounts: {},
      recentEvents: data.diagnostic_logs?.slice(0, 100) || []
    };
  } catch (error) {
    console.error('Failed to get analytics:', error);
    return { error: 'Failed to retrieve analytics' };
  }
};
