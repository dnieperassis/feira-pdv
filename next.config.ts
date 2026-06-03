import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  turbopack: {}, // silencia aviso de webpack config no dev
}

export default nextConfig
