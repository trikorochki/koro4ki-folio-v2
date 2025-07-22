// js/location-detector.js
const LocationDetector = {
  cachedResult: null,
  
  async detectRussianUser() {
    // Кэшируем результат на время сессии
    if (this.cachedResult !== null) {
      return this.cachedResult;
    }
    
    try {
      const response = await fetch('/api/check-location');
      const data = await response.json();
      
      this.cachedResult = data.isRussian;
      
      console.log('🌍 Location detected:', {
        isRussian: data.isRussian,
        country: data.country,
        confidence: data.confidence
      });
      
      return this.cachedResult;
      
    } catch (error) {
      console.warn('Location detection failed:', error);
      
      // Fallback к проверке языка браузера
      this.cachedResult = navigator.language?.includes('ru') || false;
      return this.cachedResult;
    }
  },
  
  // Преобразует URL трека для российских пользователей
  processTrackUrl(originalUrl, useProxy) {
    if (!useProxy) return originalUrl;
    
    return originalUrl.replace(
      'https://rpattpnro3om3v4l.public.blob.vercel-storage.com/music/',
      '/proxy-music/'
    );
  }
};

// Делаем доступным глобально
window.LocationDetector = LocationDetector;
