declare module '@ducanh2912/next-pwa' {
  import type { NextConfig } from 'next'

  type PWAOptions = {
    dest?: string
    disable?: boolean
    register?: boolean
    cacheOnFrontEndNav?: boolean
    aggressiveFrontEndNavCaching?: boolean
    reloadOnOnline?: boolean
    customWorkerSrc?: string
    workboxOptions?: Record<string, unknown>
  }

  export default function withPWAInit(
    options?: PWAOptions,
  ): (config: NextConfig) => NextConfig
}
