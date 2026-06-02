'use client';

import { Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Alternar tema"
    >
      <Sun size={20} weight="bold" className="hidden dark:block" aria-hidden />
      <Moon size={20} weight="bold" className="block dark:hidden" aria-hidden />
    </Button>
  );
}
