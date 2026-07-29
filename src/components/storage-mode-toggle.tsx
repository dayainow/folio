'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Cloud, Database, HardDrive } from 'lucide-react';
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

const MODES: StorageMode[] = ['local', 'cloud', 'beacon'];

function ModeIcon({ mode, className }: { mode: StorageMode; className?: string }) {
  if (mode === 'cloud') return <Cloud className={className} />;
  if (mode === 'beacon') return <Database className={className} />;
  return <HardDrive className={className} />;
}

export function StorageModeToggle() {
  const [mode, setMode] = useState<StorageMode>('local');
  const [beaconOk, setBeaconOk] = useState(false);
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
          {MODES.map((m) => {
            const disabled = m === 'beacon' && !beaconOk;
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
                <span className="flex-1">{STORAGE_MODE_LABELS[m]}</span>
                {mode === m && (
                  <span className="text-[10px] text-muted-foreground">현재</span>
                )}
                {disabled && (
                  <span className="text-[9px] text-muted-foreground">없음</span>
                )}
              </button>
            );
          })}
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] text-muted-foreground leading-snug">
            Beacon은 `.beacon` 초기화 시에만 사용
          </p>
        </div>
      )}
    </div>
  );
}
