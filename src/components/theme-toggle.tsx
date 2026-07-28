'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredTheme, toggleTheme, type ThemeMode } from '@/lib/theme';

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setMode(stored);
    setReady(true);
  }, []);

  const onToggle = () => {
    setMode(toggleTheme());
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="h-7 w-7"
      onClick={onToggle}
      aria-label={mode === 'dark' ? '라이트 모드' : '다크 모드'}
      title={mode === 'dark' ? '라이트 모드' : '다크 모드'}
    >
      {ready && mode === 'dark' ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
