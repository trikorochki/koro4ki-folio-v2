// admin-nextjs/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    REDIS_URL: process.env.REDIS_URL,
    STATS_API_SECRET: process.env.STATS_API_SECRET,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/admin',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
