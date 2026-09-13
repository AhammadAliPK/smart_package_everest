import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Vitest runs each package with cwd at its own root (apps/web) — jsdom
 * rewrites import.meta.url, so file lookups go through cwd instead.
 */
const webRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(webRoot, ...parts), 'utf8');

/**
 * Story 4.7 design audit — computed from the tokens that actually ship.
 *
 * Contrast is calculated from `src/styles.css` at test time (not from copied
 * hexes), so a token change that breaks the floor fails here. The floor:
 * WCAG AA — 4.5:1 for text, 3:1 for the focus ring (2.4.11) measured against
 * the page surfaces it sits on.
 */

const css = read('src', 'styles.css');

/** Merge every `:root` block (light deltas + constant brand layer). */
function varsOf(selector: string): Record<string, string> {
  const collected: Record<string, string> = {};
  for (const block of css.matchAll(new RegExp(`${selector}\\s*\\{`, 'g'))) {
    const start = block.index ?? 0;
    const body = css.slice(start, css.indexOf('}', start));
    for (const match of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
      if (match[1] !== undefined && match[2] !== undefined) {
        collected[match[1]] = match[2];
      }
    }
  }
  return collected;
}

const light = { ...varsOf(':root') };
const dark = { ...light, ...varsOf('\\.dark') };

/** A theme token that must exist — failing loudly beats silently skipping. */
function token(theme: Record<string, string>, name: string): string {
  const value = theme[name];
  if (value === undefined) throw new Error(`missing token --${name}`);
  return value;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = hex.replace('#', '');
  const r = channel(parseInt(digits.slice(0, 2), 16));
  const g = channel(parseInt(digits.slice(2, 4), 16));
  const b = channel(parseInt(digits.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast from the shipped tokens (WCAG AA)', () => {
  const textPairs: Array<[string, string]> = [
    ['foreground', 'background'],
    ['foreground', 'card'],
    ['muted', 'card'], // eyebrows, helper text — 12–14px
    ['muted', 'background'],
    ['gold', 'card'], // stale label
    ['on-brand', 'brand'], // primary CTA
    ['on-brand', 'cream'], // free-tile copy
  ];

  it.each(textPairs.map(([a, b]) => [`light ${a}/${b}`, token(light, a), token(light, b)]))(
    '%s ≥ 4.5',
    (_name, fore, back) => {
      expect(contrast(fore, back)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(
    [
      ['butter', 'card'] as [string, string], // oversized code text (dark)
      ...textPairs,
    ].map(([a, b]) => [`dark ${a}/${b}`, token(dark, a), token(dark, b)]),
  )('%s ≥ 4.5', (_name, fore, back) => {
    expect(contrast(fore, back)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light ring/page', token(light, 'ring'), token(light, 'background')],
    ['light ring/card', token(light, 'ring'), token(light, 'card')],
    ['dark ring/page', token(dark, 'ring'), token(dark, 'background')],
    ['dark ring/card', token(dark, 'ring'), token(dark, 'card')],
  ])('%s ≥ 3 (focus indicator, WCAG 2.4.11)', (_name, ring, back) => {
    expect(contrast(ring, back)).toBeGreaterThanOrEqual(3);
  });
});

describe('design-language invariants (DESIGN.md / EXPERIENCE.md)', () => {
  it('dark is class-based and set before first paint', () => {
    expect(css).toContain('@custom-variant dark');
    expect(read('index.html')).toMatch(/localStorage\.getItem\('locker-theme'\)/);
  });

  it('reduced motion is honored globally (opacity-only or none)', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('the ≥44px floor lives in the interactive primitives', () => {
    const ui = join(webRoot, '..', '..', 'packages', 'ui', 'src', 'components');
    expect(readFileSync(join(ui, 'button.tsx'), 'utf8')).toContain('min-h-11');
    expect(readFileSync(join(ui, 'input.tsx'), 'utf8')).toContain('min-h-11');
    expect(readFileSync(join(ui, 'select.tsx'), 'utf8')).toContain('min-h-11');
    expect(readFileSync(join(ui, 'code-input.tsx'), 'utf8')).toContain('h-14');
  });
});

/** EXPERIENCE.md banned list, enforced mechanically on the shipped source. */
describe('banned patterns', () => {
  const BANNED = /(toast|confetti|animate-bounce|text-red-|bg-red-|border-red-|destructive)/i;

  /** The ban targets shipped behavior — comments may document the rule. */
  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  function collect(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry === '__fixtures__' || entry === 'node_modules') continue;
        collect(path, files);
      } else if (/\.(tsx?|css)$/.test(entry) && !/\.test\./.test(entry)) {
        files.push(path);
      }
    }
    return files;
  }

  it('no toasts, no celebratory animation, no alarm-red, no destructive vocabulary', () => {
    const scanned = [
      ...collect(join(webRoot, 'src')), // apps/web/src
      ...collect(join(webRoot, '..', '..', 'packages', 'ui', 'src')),
    ];
    expect(scanned.length).toBeGreaterThan(20);
    const offenders = scanned
      .map((path) => [path, stripComments(readFileSync(path, 'utf8'))] as const)
      .filter(([, source]) => BANNED.test(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
