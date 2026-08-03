/**
 * P50 — Lighthouse CI 설정
 * collect: 빌드 산출물 기준 로컬 서버
 * assert: 성능 카테고리 · LCP/CLS 회귀 가드
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'Ready|started server',
      url: ['http://127.0.0.1:3000/'],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.45 }],
        'categories:accessibility': ['warn', { minScore: 0.8 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 6000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.35 }],
        'total-blocking-time': ['warn', { maxNumericValue: 800 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
