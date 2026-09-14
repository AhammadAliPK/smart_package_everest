import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { ThemeToggle, Wordmark } from '@locker/ui';

import { readStoredTheme, toggleTheme } from '../theme.js';

/**
 * App shell: header with the logo lockup and the theme toggle (UX-DR3), and
 * the routed page below. The shell owns theme state so every surface shares
 * one toggle.
 */
export function Layout() {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.title = 'Everest Lockers';
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:font-sans focus:text-on-brand"
      >
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-margin-mobile py-4 md:px-margin-desktop">
        {/* The lockup is the way home — same convention as the browser back
            stack, one tap from anywhere. */}
        <Link
          to="/"
          aria-label="Everest Lockers home"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Wordmark />
        </Link>
        <ThemeToggle theme={theme} onToggle={() => setTheme(toggleTheme(theme))} />
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
