/**
 * Theme state (UX-DR3): dark default, light toggle, persisted to localStorage,
 * applied as a class before first paint (index.html) and on toggle.
 *
 * Storage failures (private mode, blocked cookies) degrade to dark-only —
 * the reference rendering — rather than ever flashing the wrong theme.
 */

export const THEME_STORAGE_KEY = 'locker-theme';

export type ThemeName = 'dark' | 'light';

/** The persisted choice, defaulting to dark when absent or unreadable. */
export function readStoredTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Apply a theme to the document root. */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** Persist the choice; failures are ignored (dark still applies in-session). */
export function persistTheme(theme: ThemeName): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / storage blocked — in-session theming still works.
  }
}

/** Toggle helper: compute the opposite, apply it, persist it. */
export function toggleTheme(current: ThemeName): ThemeName {
  const next: ThemeName = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  persistTheme(next);
  return next;
}
