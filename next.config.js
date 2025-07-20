// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ================================================================================
  // IMAGE OPTIMIZATION CONFIGURATION
  // ================================================================================
  images: {
    remotePatterns: [
      // Основной паттерн для Vercel Blob Storage (public)
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      // Конкретный домен для текущего проекта
      {
        protocol: 'https',
        hostname: 'rpattpnro3om3v4l.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      // Дополнительные домены Blob Storage
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      // Поддержка локальных изображений в development
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      // Поддержка CDN и других внешних источников
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      }
    ],
    // Оптимизированные форматы изображений
    formats: ['image/avif', 'image/webp'],
    // Адаптивные размеры для разных устройств
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Дополнительные настройки оптимизации
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Настройки качества изображений

  },
  
  // ================================================================================
  // HEADERS CONFIGURATION FOR AUDIO AND IMAGES
  // ================================================================================
  async headers() {
    return [
      // CORS заголовки для аудиофайлов
      {
        source: '/api/music/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, HEAD, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Range, Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Expose-Headers',
            value: 'Content-Length, Content-Range, Accept-Ranges',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          // Кэширование аудиофайлов
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Заголовки безопасности для всего приложения
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ],
      },
      // Специальные заголовки для статических файлов
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      }
    ]
  },

  // ================================================================================
  // EXPERIMENTAL FEATURES
  // ================================================================================
  experimental: {
    // Оптимизация импортов пакетов
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      'zustand',
      'next/image',
      'react-use'
    ],
    // Оптимизация сборки
    optimizeCss: true,
    // Улучшение производительности
    swcMinify: true,
  },

  // ================================================================================
  // WEBPACK CONFIGURATION
  // ================================================================================
  webpack: (config, { isServer }) => {
    // Оптимизация для аудиофайлов
    config.module.rules.push({
      test: /\.(mp3|wav|ogg|flac|m4a)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/media/[name].[hash][ext]',
      },
    });

    // Оптимизация для изображений
    config.module.rules.push({
      test: /\.(png|jpg|jpeg|gif|svg|webp|avif)$/,
      type: 'asset',
      parser: {
        dataUrlCondition: {
          maxSize: 8192, // 8KB
        },
      },
    });

    // Исключение серверных модулей на клиенте
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },

  // ================================================================================
  // BUILD OPTIMIZATION
  // ================================================================================
  compiler: {
    // Удаление console.* в production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // ================================================================================
  // PERFORMANCE SETTINGS
  // ================================================================================
  poweredByHeader: false,
  compress: true,
  
  // Настройки для статической генерации
  trailingSlash: false,
  
  // Переменные окружения
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // ================================================================================
  // REDIRECTS AND REWRITES
  // ================================================================================
  async redirects() {
    return [
      // Редирект с WWW на без WWW
      {
        source: '/(.*)',
        has: [
          {
            type: 'host',
            value: 'www.yourdomain.com',
          },
        ],
        destination: 'https://yourdomain.com/$1',
        permanent: true,
      },
    ]
  },

  async rewrites() {
    return [
      // Проксирование API запросов если нужно
      {
        source: '/api/proxy/:path*',
        destination: 'https://external-api.com/:path*',
      },
    ]
  },

  // ================================================================================
  // OUTPUT CONFIGURATION
  // ================================================================================
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  
  // ESLint конфигурация
  eslint: {
    // Игнорировать ESLint ошибки в production build
    ignoreDuringBuilds: false,
  },

  // TypeScript конфигурация
  typescript: {
    // Игнорировать TypeScript ошибки в production build
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
