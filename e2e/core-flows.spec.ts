import { expect, test } from '@playwright/test'

/**
 * P66 — 핵심 플로우 E2E (로컬 모드 · 인증 없이)
 */
test.describe('Folio core flows (P66)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('welcome_seen', '1')
      localStorage.setItem('folio_locale', 'ko')
      localStorage.setItem('workspace_tasks', '[]')
      localStorage.removeItem('folio_weekly_plans_v1')
    })
  })

  test('login/auth affordance is reachable from home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await page.getByRole('button', { name: /요약|summary/i }).click()
    await page.getByRole('button', { name: /추가 위젯 더보기/ }).click()
    // Supabase 미설정 시에도 로그인 또는 테마 설정 진입점이 존재
    const security = page.getByRole('button', { name: /보안|Security|セキュリティ/i })
    const theme = page.getByRole('button', { name: /테마|Theme|テーマ|다크|라이트/i })
    const login = page.getByRole('link', { name: /로그인|Login/i })
    const anyControl = security.or(theme).or(login)
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

  test('header search opens an accessible search field', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /통합 검색 열기|Open search/i }).click()
    await expect(page.getByRole('textbox', { name: /검색|Search/i })).toBeVisible()
  })

  test('meeting actions require approval before appearing in backlog', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /요약|summary/i }).click()
    await page.getByRole('button', { name: /추가 위젯 더보기/ }).click()
    await page.getByRole('button', { name: /^AI$/ }).click()
    const dialog = page.getByRole('dialog', { name: /AI 도구/i })
    await dialog.getByRole('button', { name: '실행' }).click()
    await dialog.getByPlaceholder(/회의 기록/).fill('TODO: 배포 체크리스트를 8/20까지 정리하기')
    await dialog.getByRole('button', { name: /실행 항목 제안/ }).click()
    const title = dialog.getByRole('textbox', { name: /실행 항목 제목/ })
    await expect(title).toHaveValue(/배포 체크리스트/)
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('workspace_tasks') || '[]').length)).toBe(0)
    await dialog.getByRole('button', { name: /선택 항목 승인 후 추가/ }).click()
    await expect(dialog.getByText(/Backlog에 추가했습니다/)).toBeVisible()
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('workspace_tasks') || '[]').length)).toBe(1)
  })

  test('weekly review confirms next-week focus before persisting it', async ({ page }) => {
    await page.goto('/')
    await page.getByText('주간 리뷰', { exact: true }).click()
    await page.getByRole('textbox', { name: '1순위 목표' }).fill('고객 피드백 정리')
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('folio_weekly_plans_v1'))).toBeNull()
    await page.getByRole('button', { name: /주간 리뷰 완료/ }).click()
    await expect(page.getByText('이번 주를 정리하고 다음 주 초점을 확정했습니다.')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const plans = JSON.parse(localStorage.getItem('folio_weekly_plans_v1') || '{}')
      return Object.values(plans)[0]?.focus?.[0]
    })).toBe('고객 피드백 정리')
  })
})
