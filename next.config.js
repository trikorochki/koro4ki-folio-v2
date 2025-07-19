// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  env: {
    REDIS_URL: process.env.REDIS_URL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    ANALYTICS_TOKEN: process.env.ANALYTICS_TOKEN,
  },
  // ✅ Добавляем поддержку статических файлов из папки music
  async rewrites() {
    return [
      // Статические музыкальные файлы
      {
        source: '/music/:path*',
        destination: '/music/:path*',
      },
      // API маршруты
      {
        source: '/admin/:path*',
        destination: '/admin/:path*',
      },
      {
        source: '/api/admin/:path*',
        destination: '/api/admin/:path*',
      },
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/admin.html',
        destination: '/admin',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
