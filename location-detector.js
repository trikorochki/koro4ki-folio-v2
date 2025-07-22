// js/location-detector.js
const LocationDetector = {
  cachedResult: null,
  
  async detectRussianUser() {
    // Кэшируем результат на время сессии
    if (this.cachedResult !== null) {
      return this.cachedResult;
    }
    
    try {
      // Fetch автоматически следует редиректам (включая 307)
      // Vercel перенаправляет kr4.pro → www.kr4.pro, это нормально
      const response = await fetch('/api/check-location', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        // redirect: 'follow' - по умолчанию, но указываем явно
        redirect: 'follow',
        // Таймаут на случай долгих редиректов
        signal: AbortSignal.timeout(10000)
      });
      
      // Проверяем что запрос успешен после всех редиректов
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Валидация ответа
      if (typeof data.isRussian !== 'boolean') {
        throw new Error('Invalid API response format');
      }
      
      this.cachedResult = data.isRussian;
      
      console.log('🌍 Location detected:', {
        isRussian: data.isRussian,
        country: data.country || 'Unknown',
        confidence: data.confidence || 0,
        finalUrl: response.url // Покажет финальный URL после редиректов
      });
      
      return this.cachedResult;
      
    } catch (error) {
      console.warn('Location detection failed:', {
        error: error.message,
        type: error.constructor.name
      });
      
      // Fallback к проверке языка браузера
      this.cachedResult = navigator.language?.includes('ru') || 
                         Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Moscow') ||
                         false;
      
      console.log('🔄 Using fallback detection:', {
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        result: this.cachedResult
      });
      
      return this.cachedResult;
    }
  },
  
  // Преобразует URL трека для российских пользователей
  processTrackUrl(originalUrl, useProxy) {
    if (!useProxy) return originalUrl;
    
    // Используем Vercel rewrite правило /music/ вместо /proxy-music/
    // Это соответствует настройкам в vercel.json
    return originalUrl.replace(
      'https://rpattpnro3om3v4l.public.blob.vercel-storage.com/music/',
      '/music/' // Vercel rewrite обработает редирект автоматически
    );
  },
  
  // Дополнительный метод для сброса кэша (полезно для отладки)
  resetCache() {
    this.cachedResult = null;
    console.log('🔄 Location cache cleared');
  },
  
  // Проверка готовности API без кэширования
  async testApiConnection() {
    try {
      const response = await fetch('/api/check-location', {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000)
      });
      
      return {
        success: response.ok,
        status: response.status,
        finalUrl: response.url,
        redirected: response.redirected
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// Делаем доступным глобально
window.LocationDetector = LocationDetector;

// Отладочная информация (можно убрать в продакшене)
if (window.location.hostname.includes('kr4.pro')) {
  console.log('🌐 Domain detected:', {
    hostname: window.location.hostname,
    expectingRedirects: window.location.hostname === 'kr4.pro' // true если ожидаем редирект
  });
}
