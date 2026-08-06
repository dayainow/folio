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
        // P42 — 정적 자산/스크립트/폰트: 장기 CacheFirst
        urlPattern: ({ request }: { request: Request }) =>
          request.destination === 'style' ||
          request.destination === 'script' ||
          request.destination === 'worker' ||
          request.destination === 'font',
        handler: 'CacheFirst',
        options: {
          cacheName: 'folio-static-assets',
          expiration: {
            maxEntries: 160,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
        },
      },
      {
        // P42 — 이미지: StaleWhileRevalidate (lazy + 빠른 재방문)
        urlPattern: ({ request }: { request: Request }) => request.destination === 'image',
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'folio-images',
          expiration: {
            maxEntries: 96,
            maxAgeSeconds: 14 * 24 * 60 * 60,
          },
        },
      },
      {
        urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'folio-api',
          networkTimeoutSeconds: 6,
          expiration: {
            maxEntries: 64,
            maxAgeSeconds: 12 * 60 * 60,
          },
        },
      },
      {
        urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'folio-pages',
          networkTimeoutSeconds: 4,
          expiration: {
            maxEntries: 40,
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
  // /guide 가 docs/*.md 를 읽도록 standalone 트레이싱에 포함
  outputFileTracingIncludes: {
    '/guide': [
      './docs/ONBOARDING.md',
      './docs/FEATURES.md',
      './docs/TROUBLESHOOTING.md',
    ],
  },
  async headers() {
    const supabaseHost = (() => {
      try {
        const u = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!u || u.includes('placeholder') || u.includes('your-')) return null
        return new URL(u).origin
      } catch {
        return null
      }
    })()
    const collabWs = process.env.NEXT_PUBLIC_COLLAB_WS_URL?.trim()
    const connect = ["'self'", 'https:', 'wss:']
    if (supabaseHost) connect.push(supabaseHost)
    if (collabWs) {
      try {
        const w = new URL(collabWs.replace(/^ws/, 'http'))
        connect.push(w.origin.replace(/^http/, 'ws'))
        connect.push(w.origin)
      } catch {
        /* ignore */
      }
    }
    const csp = [
      "default-src 'self'",
      // Next.js / PWA: unsafe-inline 유지 · eval은 개발 편의용(프로덕션 빌드는 최소화)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${[...new Set(connect)].join(' ')}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Content-Security-Policy-Report-Only', value: csp.replace(" 'unsafe-eval'", '') },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ]
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@supabase/supabase-js',
      '@supabase/ssr',
      'yjs',
      'idb',
      'react-window',
      'jspdf',
    ],
  },
  images: {
    // P44/P66 — 원격/로컬 이미지 lazy 기본 · next/image 자동 최적화
    dangerouslyAllowSVG: false,
    formats: ['image/avif', 'image/webp'],
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
