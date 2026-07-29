import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

/**
 * Folio Next.js config
 * - standalone: Docker 이미지용 최소 산출물
 * - ANALYZE=true 시 @next/bundle-analyzer 리포트
 */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@dnd-kit/core',
      '@supabase/supabase-js',
      '@supabase/ssr',
    ],
  },
}

export default withBundleAnalyzer(nextConfig)
