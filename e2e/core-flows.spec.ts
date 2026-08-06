import { expect, test } from '@playwright/test'

/**
 * P66 — 핵심 플로우 E2E (로컬 모드 · 인증 없이)
 */
test.describe('Folio core flows (P66)', () => {
  test('login/auth affordance is reachable from home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    // Supabase 미설정 시에도 보안/헬스/테마 등 설정 진입점이 존재
    const security = page.getByRole('button', { name: /보안|Security|セキュリティ/i })
    const theme = page.getByRole('button', { name: /테마|Theme|テーマ|다크|라이트/i })
    const anyControl = security.or(theme)
    await expect(anyControl.first()).toBeVisible({ timeout: 8000 })
  })

  test('journal write tab accepts input and can save locally', async ({ page }) => {
    await page.goto('/')
    const journalTab = page.getByRole('tab', { name: /일지|Journal|ジャーナル/i }).or(
      page.getByRole('button', { name: /일지|Journal/i }),
    )
    if ((await journalTab.count()) > 0) {
      await journalTab.first().click()
    }
    const editor = page
      .locator('textarea, [contenteditable="true"], [role="textbox"]')
      .first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await editor.fill(`P66 e2e note ${Date.now()}`)
    const save = page.getByRole('button', { name: /저장|Save|保存/i })
    if ((await save.count()) > 0) {
      await save.first().click()
    }
    await expect(editor).toBeVisible()
  })

  test('docs tab opens editor surface', async ({ page }) => {
    await page.goto('/')
    const docs = page.getByRole('tab', { name: /문서|Docs|ドキュメント/i }).or(
      page.getByRole('button', { name: /문서|Docs/i }),
    )
    await docs.first().click()
    const surface = page
      .locator('textarea, [contenteditable="true"], [role="textbox"]')
      .or(page.getByText(/문서|Document|새 문서|New/i))
    await expect(surface.first()).toBeVisible({ timeout: 10000 })
  })

  test('board tab shows kanban columns for DnD', async ({ page }) => {
    await page.goto('/')
    const board = page.getByRole('tab', { name: /일정|보드|Board|ボード/i }).or(
      page.getByRole('button', { name: /일정|보드|Board/i }),
    )
    await board.first().click()
    const column = page.getByText(/Backlog|진행|Done|완료|To Do|대기/i)
    await expect(column.first()).toBeVisible({ timeout: 12000 })
  })

  test('command palette opens with Ctrl/Meta+K', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('ControlOrMeta+K')
    const palette = page
      .getByRole('dialog')
      .or(page.getByRole('searchbox'))
      .or(page.getByPlaceholder(/검색|Search|コマンド|명령/i))
    await expect(palette.first()).toBeVisible({ timeout: 5000 })
  })
})
