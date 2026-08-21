import { getStorageMode } from '@/lib/storage'

export type ProcessProviderPreference = 'local' | 'beacon'

const STORAGE_KEY = 'folio_process_provider'

export function getProcessProviderPreference(): ProcessProviderPreference {
  if (typeof window === 'undefined') return 'local'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'local' || stored === 'beacon') return stored
  } catch {
    return 'local'
  }
  // 기존 Beacon 저장 모드 사용자는 확장 연결을 그대로 이어간다.
  return getStorageMode() === 'beacon' ? 'beacon' : 'local'
}

export function setProcessProviderPreference(preference: ProcessProviderPreference): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // 저장소 접근이 막혀도 현재 세션의 로컬 업무 흐름은 계속 사용할 수 있다.
  }
}
