'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Cloud, Database, HardDrive, Puzzle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getStorageMode,
  isBeaconAvailable,
  setStorageMode,
  STORAGE_MODE_LABELS,
  subscribeStorageMode,
  type StorageMode,
} from '@/lib/storage';
import { useEscapeToClose, useFocusTrap } from '@/lib/a11y';

export const PRIMARY_STORAGE_MODES: StorageMode[] = ['local', 'cloud'];
export const EXTENSION_STORAGE_MODES: StorageMode[] = ['beacon'];

const MODE_DESCRIPTIONS: Record<StorageMode, string> = {
  local: '이 기기에 빠르고 안전하게 저장',
  cloud: '로그인한 기기에서 동기화',
  beacon: '프로젝트 파일과 고급 동기화',
};

function ModeIcon({ mode, className }: { mode: StorageMode; className?: string }) {
  if (mode === 'cloud') return <Cloud className={className} />;
  if (mode === 'beacon') return <Database className={className} />;
  return <HardDrive className={className} />;
}

export function StorageModeToggle() {
  const [mode, setMode] = useState<StorageMode>('local');
  const [beaconOk, setBeaconOk] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);

  useEscapeToClose(open, close);
  useFocusTrap(open, rootRef);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setMode(getStorageMode());
      void isBeaconAvailable().then((ok) => {
        setBeaconOk(ok);
        if (!ok && getStorageMode() === 'beacon') {
          setStorageMode('local');
          setMode('local');
        }
      });
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => subscribeStorageMode(setMode), []);

  // 로그인 없으면 클라우드 비활성 · 이미 cloud면 로컬로 강등
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const { createBrowserSupabaseClient, getUser } = await import('@/lib/supabase');
        const user = await getUser();
        if (cancelled) return;
        const loggedIn = Boolean(user);
        setAuthed(loggedIn);
        if (!loggedIn && getStorageMode() === 'cloud') {
          setStorageMode('local');
          setMode('local');
        }

        const supabase = createBrowserSupabaseClient();
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          const ok = Boolean(session?.user);
          setAuthed(ok);
          if (!ok && getStorageMode() === 'cloud') {
            setStorageMode('local');
            setMode('local');
          }
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        if (!cancelled) {
          setAuthed(false);
          if (getStorageMode() === 'cloud') {
            setStorageMode('local');
            setMode('local');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [open]);

  const select = (next: StorageMode) => {
    if (next === 'beacon' && !beaconOk) return;
    if (next === 'cloud' && !authed) return;
    setStorageMode(next);
    setMode(next);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs max-w-[160px]"
        onClick={() => setOpen((v) => !v)}
        title="저장 모드"
        aria-label={`저장 모드, 현재 ${STORAGE_MODE_LABELS[mode]}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <ModeIcon mode={mode} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{STORAGE_MODE_LABELS[mode]}</span>
        <span className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0 text-[9px] font-medium tracking-wide text-muted-foreground">
          {mode === 'local' ? 'L' : mode === 'cloud' ? 'C' : 'B'}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      </Button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="저장 모드 선택"
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-gray-100 dark:border-gray-800 bg-background shadow-lg p-1"
        >
          {PRIMARY_STORAGE_MODES.map((m) => {
            const disabled =
              m === 'cloud' && !authed;
            const disabledHint =
              m === 'cloud' && !authed ? '로그인 필요' : null;
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={mode === m}
                disabled={disabled}
                onClick={() => select(m)}
                className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                  mode === m
                    ? 'bg-gray-100 dark:bg-gray-800 font-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <ModeIcon mode={m} className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">{STORAGE_MODE_LABELS[m]}</span>
                  <span className="block truncate text-[9px] font-normal text-muted-foreground">
                    {MODE_DESCRIPTIONS[m]}
                  </span>
                </span>
                {mode === m && (
                  <span className="text-[10px] text-muted-foreground">현재</span>
                )}
                {disabledHint && (
                  <span className="text-[9px] text-muted-foreground">{disabledHint}</span>
                )}
              </button>
            );
          })}
          <div className="mx-1 my-1.5 border-t border-gray-100 dark:border-gray-800" />
          <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <Puzzle className="size-3" aria-hidden />
            고급 확장
          </div>
          {EXTENSION_STORAGE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m}
              disabled={!beaconOk}
              onClick={() => select(m)}
              className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                mode === m
                  ? 'bg-gray-100 dark:bg-gray-800 font-medium'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-900'
              } ${!beaconOk ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ModeIcon mode={m} className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block">{STORAGE_MODE_LABELS[m]}</span>
                <span className="block truncate text-[9px] font-normal text-muted-foreground">
                  {beaconOk ? MODE_DESCRIPTIONS[m] : '프로세스 탭에서 먼저 연결'}
                </span>
              </span>
              {mode === m && <span className="text-[10px] text-muted-foreground">현재</span>}
              {!beaconOk && <span className="text-[9px] text-muted-foreground">선택</span>}
            </button>
          ))}
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] leading-snug text-muted-foreground">
            기본 사용에는 Beacon이 필요하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}
