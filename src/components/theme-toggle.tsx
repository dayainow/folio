'use client';

import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStoredTheme, toggleTheme, type ThemeMode } from '@/lib/theme';
import { useI18n } from '@/components/i18n-provider';

export function ThemeToggle() {
  const { t } = useI18n();
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof window !== 'undefined' ? getStoredTheme() : 'light',
  );

  const onToggle = () => {
    setMode(toggleTheme());
  };

  const label = mode === 'dark' ? t('settings.themeLight') : t('settings.themeDark');

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="h-7 w-7"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      {mode === 'dark' ? (
        <Sun className="h-3.5 w-3.5" />
      ) : (
        <Moon className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
