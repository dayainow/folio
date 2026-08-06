import { expect, test } from '@playwright/test'

/**
 * P66 — 시각 회귀 (Chromatic 대체 스냅샷 · Storybook 스토리와 병행)
 * 로컬: npx playwright test e2e/visual-regression.spec.ts --update-snapshots
 */
test.describe('visual regression (P66)', () => {
  test('home first paint snapshot', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await page.waitForTimeout(400)
    await expect(page).toHaveScreenshot('home-banner.png', {
      maxDiffPixelRatio: 0.08,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 120 },
    })
  })
})
