import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'
import withPWAInit from '@ducanh2912/next-pwa'

/**
 * Folio Next.js config
 * - standalone: Docker 이미지용 최소 산출물
 * - PWA: @ducanh2912/next-pwa (next-pwa 유지 포크) · webpack 빌드에서 SW 생성
 * - ANALYZE=true 시 @next/bundle-analyzer 리포트
 */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  customWorkerSrc: 'worker',
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }: { request: Request }) =>
          request.destination === 'style' ||
          request.destination === 'script' ||
          request.destination === 'worker' ||
          request.destination === 'font' ||
          request.destination === 'image',
        handler: 'CacheFirst',
        options: {
          cacheName: 'folio-static-assets',
          expiration: {
            maxEntries: 128,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'folio-api',
          networkTimeoutSeconds: 8,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'folio-pages',
          networkTimeoutSeconds: 5,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
        },
      },
    ],
  },
})

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Next 16: next-pwa(webpack)와 turbopack 공존 경고 억제
  turbopack: {},
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@dnd-kit/core',
      '@supabase/supabase-js',
      '@supabase/ssr',
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // beacon.ts 서버 전용 dynamic import(node:*)가 클라이언트 번들 분석을 깨지 않게
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node:/,
        }),
      )
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        buffer: false,
        sqlite: false,
        'sql.js': false,
      }
    }
    return config
  },
}

export default withBundleAnalyzer(withPWA(nextConfig))
