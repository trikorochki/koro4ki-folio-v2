// js/location-detector.js
const LocationDetector = {
  cachedResult: null,
  apiEndpoint: 'https://api.kr4.pro/api/check-location',
  proxyEndpoint: 'https://api.kr4.pro/music/',
  
  async detectRussianUser() {
    // Кэш на время сессии
    if (this.cachedResult !== null) {
      return this.cachedResult;
    }
    
    try {
      console.log('🔍 Detecting location via VPS...');
      
      const response = await fetch(this.apiEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        throw new Error(`VPS API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Валидация ответа
      if (typeof data.isRussian !== 'boolean') {
        throw new Error('Invalid API response format');
      }
      
      this.cachedResult = data.isRussian;
      
      console.log('🌍 Location detected via VPS:', {
        isRussian: data.isRussian,
        country: data.country,
        confidence: data.confidence,
        source: data.source,
        method: data.method || 'unknown',
        ip: data.ip
      });
      
      // Аналитика: отправляем информацию об использовании proxy
      this.sendProxyAnalytics(data.isRussian, data.country, data.confidence);
      
      return this.cachedResult;
      
    } catch (error) {
      console.warn('🚨 VPS location detection failed:', {
        error: error.message,
        type: error.constructor.name,
        endpoint: this.apiEndpoint
      });
      
      // Fallback к браузерной эвристике
      this.cachedResult = this.getBrowserFallback();
      
      console.log('🔄 Using browser fallback detection:', {
        result: this.cachedResult,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      return this.cachedResult;
    }
  },
  
  getBrowserFallback() {
    // Эвристики на основе браузера
    const hasRussianLanguage = navigator.language?.toLowerCase().includes('ru');
    const hasMoscowTimezone = Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone?.includes('Moscow');
    
    // Проверка клавиатуры (если пользователь что-то вводил)
    const inputs = document.querySelectorAll('input, textarea');
    let hasRussianInput = false;
    
    inputs.forEach(input => {
      if (input.value && /[а-яё]/i.test(input.value)) {
        hasRussianInput = true;
      }
    });
    
    return hasRussianLanguage || hasMoscowTimezone || hasRussianInput;
  },
  
  async sendProxyAnalytics(isRussian, country, confidence) {
    try {
      // Отправляем аналитику об использовании proxy в существующий API
      await fetch('/api/listen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          trackId: 'proxy-detection',
          eventType: 'location_detected',
          proxyUsed: isRussian,
          locationData: {
            country,
            confidence,
            source: 'vps'
          }
        })
      });
    } catch (error) {
      // Не критично если аналитика не отправилась
      console.debug('Analytics send failed:', error);
    }
  },
  
  processTrackUrl(originalUrl, useProxy) {
    if (!useProxy) {
      return originalUrl;
    }
    
    // Заменяем Blob Storage URL на наш VPS proxy
    const proxyUrl = originalUrl.replace(
      'https://rpattpnro3om3v4l.public.blob.vercel-storage.com/music/',
      this.proxyEndpoint
    );
    
    console.log('🎵 Track URL processed:', {
      original: originalUrl.substring(0, 80) + '...',
      proxy: proxyUrl.substring(0, 80) + '...',
      useProxy
    });
    
    return proxyUrl;
  },
  
  // Методы для отладки
  async testConnection() {
    try {
      const response = await fetch(`${this.apiEndpoint.replace('/api/check-location', '/health')}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      return {
        success: response.ok,
        status: response.status,
        endpoint: this.apiEndpoint,
        health: response.ok ? await response.json() : null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        endpoint: this.apiEndpoint
      };
    }
  },
  
  resetCache() {
    this.cachedResult = null;
    console.log('🔄 Location detection cache cleared');
  },
  
  // Получить статистику proxy
  getProxyStats() {
    return {
      cached: this.cachedResult,
      endpoint: this.apiEndpoint,
      proxyEndpoint: this.proxyEndpoint,
      lastDetection: localStorage.getItem('lastLocationDetection')
    };
  }
};

// Сохранение в localStorage для персистентности между сессиями
LocationDetector.originalDetectRussianUser = LocationDetector.detectRussianUser;
LocationDetector.detectRussianUser = async function() {
  const result = await this.originalDetectRussianUser();
  
  // Сохраняем результат и время детекции
  localStorage.setItem('lastLocationDetection', JSON.stringify({
    result,
    timestamp: Date.now(),
    ttl: 24 * 60 * 60 * 1000 // 24 часа
  }));
  
  return result;
};

// Загрузка из кэша при инициализации
(() => {
  try {
    const cached = localStorage.getItem('lastLocationDetection');
    if (cached) {
      const { result, timestamp, ttl } = JSON.parse(cached);
      
      // Проверяем не истек ли кэш
      if (Date.now() - timestamp < ttl) {
        LocationDetector.cachedResult = result;
        console.log('📱 Loaded location from localStorage cache:', result);
      } else {
        localStorage.removeItem('lastLocationDetection');
      }
    }
  } catch (error) {
    console.debug('Failed to load location cache:', error);
    localStorage.removeItem('lastLocationDetection');
  }
})();

// Глобальная доступность
window.LocationDetector = LocationDetector;

// Отладочная информация
console.log('🚀 LocationDetector v2.0 initialized:', {
  endpoint: LocationDetector.apiEndpoint,
  proxy: LocationDetector.proxyEndpoint,
  cachedResult: LocationDetector.cachedResult
});
