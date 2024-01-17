/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    responseLimit: '8mb',
  },
}

module.exports = nextConfig
