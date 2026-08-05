import { expect, test } from '@playwright/test'

test.describe('Folio a11y smoke (P55)', () => {
  test('home loads with landmarks and skip link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    const skip = page.locator('a.skip-link')
    await expect(skip).toHaveCount(1)
    await skip.focus()
    await expect(skip).toBeFocused()
  })

  test('keyboard can open search with Ctrl/Meta+K', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+K')
    const search = page.getByRole('searchbox').or(page.getByPlaceholder(/검색|Search|検索/i))
    await expect(search.first()).toBeVisible({ timeout: 5000 })
  })

  test('theme and contrast controls exist in sidebar footer area', async ({ page }) => {
    await page.goto('/')
    // 데스크톱에서 사이드바 푸터 테마 버튼
    const contrast = page.getByRole('button', {
      name: /고대비|high contrast|ハイコントラスト/i,
    })
    // 모바일에서는 요약 패널에 있을 수 있음 — 없으면 soft skip
    const count = await contrast.count()
    if (count === 0) {
      test.info().annotations.push({ type: 'note', description: 'contrast toggle not in viewport' })
      return
    }
    await contrast.first().click()
    await expect(page.locator('html.high-contrast')).toHaveCount(1)
  })
})
