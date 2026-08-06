import path from 'node:path'
import { defineConfig } from 'vitest/config'

/** P66 — 커버리지 게이트 대상 (코어 · 성능 · 테마). 전체 lib는 점진 확대. */
const COVERAGE_CORE = [
  'src/lib/theme.ts',
  'src/lib/errors.ts',
  'src/lib/perf-metrics.ts',
  'src/lib/perf-score.ts',
  'src/lib/jspdf-loader.ts',
  'src/lib/debounce.ts',
  'src/lib/env-config.ts',
  'src/lib/sanitize.ts',
  'src/lib/slash-commands.ts',
  'src/lib/shortcuts.ts',
  'src/lib/templates.ts',
  'src/lib/pdf-layout.ts',
  'src/lib/favorites.ts',
  'src/lib/local-cache.ts',
  'src/lib/storage-retry.ts',
  'src/lib/time-tracking.ts',
  'src/lib/plugin-system.ts',
  'src/lib/plugin-marketplace.ts',
  'src/lib/collab-perf.ts',
  'src/lib/resource-acl.ts',
]

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: COVERAGE_CORE,
      // P66: 게이트 대상 평균 80%
      thresholds: {
        lines: 80,
        functions: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
