import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageMode, setStorageMode, STORAGE_MODE_LABELS } from '@/lib/storage'
import { validateSupabasePublicEnv, listEnvChecks, formatEnvValidationError } from '@/lib/env-config'

describe('storage mode', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('defaults to local when unset', () => {
    expect(getStorageMode()).toBe('local')
  })

  it('persists valid modes', () => {
    setStorageMode('cloud')
    expect(getStorageMode()).toBe('cloud')
    setStorageMode('beacon')
    expect(getStorageMode()).toBe('beacon')
    setStorageMode('local')
    expect(getStorageMode()).toBe('local')
  })

  it('ignores invalid stored values', () => {
    localStorage.setItem('folio_storage_mode', 'nfs')
    expect(getStorageMode()).toBe('local')
  })

  it('exposes Korean labels', () => {
    expect(STORAGE_MODE_LABELS.local).toBe('로컬')
    expect(STORAGE_MODE_LABELS.cloud).toBe('클라우드')
    expect(STORAGE_MODE_LABELS.beacon).toBe('Beacon')
  })

  it('dispatches mode change event', () => {
    const spy = vi.fn()
    window.addEventListener('folio-storage-mode', spy)
    setStorageMode('cloud')
    expect(spy).toHaveBeenCalled()
    window.removeEventListener('folio-storage-mode', spy)
  })
})

describe('storage fallback contracts (env)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports incomplete supabase as not ok', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    const r = validateSupabasePublicEnv()
    expect(r.ok).toBe(false)
    expect(r.missing.length).toBeGreaterThan(0)
    expect(r.message).toContain('Supabase')
  })

  it('accepts real-looking supabase env', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiJ9.test')
    expect(validateSupabasePublicEnv().ok).toBe(true)
  })

  it('rejects placeholder supabase values', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'your-project-url')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'your-anon-key')
    expect(validateSupabasePublicEnv().ok).toBe(false)
  })

  it('lists env checks', () => {
    const checks = listEnvChecks()
    expect(checks.some((c) => c.key === 'FOLIO_VERSION')).toBe(true)
    expect(checks.some((c) => c.key === 'NEXT_PUBLIC_SUPABASE_URL')).toBe(true)
  })

  it('formats required env error', () => {
    const msg = formatEnvValidationError(['NEXT_PUBLIC_SUPABASE_URL'])
    expect(msg).toContain('필수 환경변수')
    expect(msg).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })
})
