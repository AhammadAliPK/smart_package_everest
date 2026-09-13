/**
 * ThemeToggle — controlled presentational switch (UX-DR3).
 *
 * The app owns persistence and the document class; this is just the button.
 * Sun/moon glyphs are decorative; the accessible name carries the state.
 */

import { Moon, Sun } from 'lucide-react';

import { cn } from '../lib/cn.js';

export type ThemeName = 'dark' | 'light';

export function ThemeToggle({
  theme,
  onToggle,
  className,
}: {
  theme: ThemeName;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card',
        'text-muted-foreground hover:border-brand hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
