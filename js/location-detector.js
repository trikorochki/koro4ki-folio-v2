// js/location-detector.js
const LocationDetector = {
  cachedResult: null,
  apiEndpoint: 'https://api.kr4.pro/api/check-location',
  proxyEndpoint: 'https://api.kr4.pro/music/',
  
  async detectRussianUser(forceRefresh = false) {
    // Отладочная информация для диагностики VPN
    console.log('🔍 Debug Info:', {
      cached: this.cachedResult,
      localStorage: localStorage.getItem('lastLocationDetection'),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      forceRefresh: forceRefresh
    });
    
    // Если принудительное обновление - очистить весь кэш
    if (forceRefresh) {
      this.cachedResult = null;
      localStorage.removeItem('lastLocationDetection');
      console.log('🔄 Forced cache refresh requested');
    }
    
    // Кэш на время сессии (если не принудительное обновление)
    if (this.cachedResult !== null && !forceRefresh) {
      console.log('📱 Using session cache:', this.cachedResult);
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
        cache: forceRefresh ? 'no-cache' : 'default',
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
        ip: data.ip,
        vpsDetection: true
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        fallbackUsed: true
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
    
    // Логирование для отладки
    console.log('🔄 Browser fallback analysis:', {
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      russianLanguage: hasRussianLanguage,
      moscowTimezone: hasMoscowTimezone,
      russianInput: hasRussianInput
    });
    
    // ИСПРАВЛЕНО: При VPN приоритет языку браузера, timezone менее надежен
    return hasRussianLanguage || hasRussianInput;
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
  
  // Методы для отладки и управления
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
    localStorage.removeItem('lastLocationDetection');
    console.log('🔄 Location detection cache cleared completely');
  },
  
  // НОВОЕ: Принудительная перепроверка локации (для пользователей с VPN)
  async forceLocationRefresh() {
    console.log('🔄 Forcing location refresh...');
    this.resetCache();
    return await this.detectRussianUser(true);
  },
  
  // НОВОЕ: Диагностика всей системы
  async runDiagnostics() {
    console.log('🔍 Running LocationDetector diagnostics...');
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      
      // Browser info
      browser: {
        language: navigator.language,
        languages: navigator.languages,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        userAgent: navigator.userAgent.substring(0, 100)
      },
      
      // Cache status
      cache: {
        sessionCache: this.cachedResult,
        localStorage: localStorage.getItem('lastLocationDetection')
      },
      
      // API test
      apiConnection: await this.testConnection(),
      
      // Fresh location check
      freshDetection: null
    };
    
    try {
      diagnostics.freshDetection = await this.detectRussianUser(true);
    } catch (error) {
      diagnostics.freshDetection = { error: error.message };
    }
    
    console.table(diagnostics.browser);
    console.log('🔍 Full diagnostics:', diagnostics);
    
    return diagnostics;
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

// ОБНОВЛЕНО: Улучшенное сохранение в localStorage
LocationDetector.originalDetectRussianUser = LocationDetector.detectRussianUser;
LocationDetector.detectRussianUser = async function(forceRefresh = false) {
  const result = await this.originalDetectRussianUser(forceRefresh);
  
  // Сохраняем результат только если не принудительное обновление
  if (!forceRefresh) {
    localStorage.setItem('lastLocationDetection', JSON.stringify({
      result,
      timestamp: Date.now(),
      ttl: 24 * 60 * 60 * 1000, // 24 часа
      userAgent: navigator.userAgent.substring(0, 50),
      language: navigator.language
    }));
  }
  
  return result;
};

// УЛУЧШЕНО: Загрузка из кэша с дополнительными проверками
(() => {
  try {
    const cached = localStorage.getItem('lastLocationDetection');
    if (cached) {
      const { result, timestamp, ttl, userAgent, language } = JSON.parse(cached);
      
      // Проверяем не истек ли кэш И не изменился ли браузер/язык
      const isValid = Date.now() - timestamp < ttl;
      const isSameBrowser = userAgent === navigator.userAgent.substring(0, 50);
      const isSameLanguage = language === navigator.language;
      
      if (isValid && isSameBrowser && isSameLanguage) {
        LocationDetector.cachedResult = result;
        console.log('📱 Loaded location from localStorage cache:', {
          result,
          age: Math.round((Date.now() - timestamp) / 1000 / 60),
          minutes: 'minutes ago'
        });
      } else {
        localStorage.removeItem('lastLocationDetection');
        console.log('🔄 Cache invalidated:', { isValid, isSameBrowser, isSameLanguage });
      }
    }
  } catch (error) {
    console.debug('Failed to load location cache:', error);
    localStorage.removeItem('lastLocationDetection');
  }
})();

// Глобальная доступность
window.LocationDetector = LocationDetector;

// НОВОЕ: Глобальные методы для быстрой диагностики
window.clearLocationCache = () => LocationDetector.resetCache();
window.forceLocationRefresh = () => LocationDetector.forceLocationRefresh();
window.runLocationDiagnostics = () => LocationDetector.runDiagnostics();

// Отладочная информация
console.log('🚀 LocationDetector v2.1 initialized:', {
  endpoint: LocationDetector.apiEndpoint,
  proxy: LocationDetector.proxyEndpoint,
  cachedResult: LocationDetector.cachedResult,
  globalMethods: ['clearLocationCache()', 'forceLocationRefresh()', 'runLocationDiagnostics()']
});
