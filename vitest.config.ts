import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/**/__tests__/**',
        'src/lib/beacon.ts',
        'src/lib/beacon-*.ts',
        'src/server/**',
      ],
      // P55: lib 전체 80% 목표 (점진 상향). 코어 모듈 기준선만 게이트
      thresholds: {
        'src/lib/theme.ts': { lines: 80, functions: 80, statements: 80 },
        'src/lib/errors.ts': { lines: 80, functions: 80, statements: 80 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
