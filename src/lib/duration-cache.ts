// src/lib/duration-cache.ts

const DURATION_CACHE_KEY = 'kr4_audio_durations_cache';
const CACHE_VERSION = '1.0';

interface CacheData {
  version: string;
  durations: Record<string, string>;
  timestamps: Record<string, number>;
}

export class DurationCache {
  private static cache: Map<string, string> = new Map();
  private static timestamps: Map<string, number> = new Map();
  private static loaded = false;
  private static readonly CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 дней

  static load() {
    if (typeof window === 'undefined' || this.loaded) return;
    
    try {
      const cached = localStorage.getItem(DURATION_CACHE_KEY);
      if (cached) {
        const data: CacheData = JSON.parse(cached);
        
        if (data.version === CACHE_VERSION) {
          const now = Date.now();
          
          Object.entries(data.durations).forEach(([trackId, duration]) => {
            const timestamp = data.timestamps[trackId];
            if (timestamp && (now - timestamp) < this.CACHE_EXPIRY) {
              this.cache.set(trackId, duration);
              this.timestamps.set(trackId, timestamp);
            }
          });
          
          console.log(`📦 Loaded ${this.cache.size} cached track durations`);
        }
      }
    } catch (error) {
      console.warn('Failed to load duration cache:', error);
      this.clearCache();
    }
    
    this.loaded = true;
  }

  static get(trackId: string): string | null {
    this.load();
    return this.cache.get(trackId) || null;
  }

  static set(trackId: string, duration: string) {
    this.load();
    
    const now = Date.now();
    this.cache.set(trackId, duration);
    this.timestamps.set(trackId, now);
    
    this.save();
  }

  static has(trackId: string): boolean {
    this.load();
    return this.cache.has(trackId);
  }

  private static save() {
    if (typeof window === 'undefined') return;
    
    try {
      const data: CacheData = {
        version: CACHE_VERSION,
        durations: Object.fromEntries(this.cache.entries()),
        timestamps: Object.fromEntries(this.timestamps.entries())
      };
      
      localStorage.setItem(DURATION_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save duration cache:', error);
    }
  }

  static clearCache() {
    this.cache.clear();
    this.timestamps.clear();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DURATION_CACHE_KEY);
    }
    
    console.log('🗑️ Duration cache cleared');
  }

  static getCacheStats() {
    this.load();
    
    if (this.timestamps.size === 0) {
      return {
        totalCached: 0,
        oldestEntry: null,
        newestEntry: null
      };
    }
    
    const timestamps = Array.from(this.timestamps.values());
    
    return {
      totalCached: this.cache.size,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps)
    };
  }
}
