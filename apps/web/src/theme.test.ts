import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyTheme, persistTheme, readStoredTheme, toggleTheme } from './theme.js';

/** UX-DR3: dark default, persisted toggle, applied as a class. */
describe('theme state', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to dark when nothing is stored', () => {
    expect(readStoredTheme()).toBe('dark');
  });

  it('reads a persisted light choice', () => {
    persistTheme('light');
    expect(readStoredTheme()).toBe('light');
  });

  it('degrades to dark when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredTheme()).toBe('dark');
    spy.mockRestore();
  });

  it('applies the theme as a document class', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggleTheme flips, applies and persists in one step', () => {
    expect(toggleTheme('dark')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('locker-theme')).toBe('light');
    expect(toggleTheme('light')).toBe('dark');
    expect(localStorage.getItem('locker-theme')).toBe('dark');
  });
});
