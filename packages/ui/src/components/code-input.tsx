/**
 * CodeInput (EXPERIENCE.md component patterns) — the 8 pickup-code cells.
 *
 * `XXXX-XXXX` with a display-only dash. Auto-advance, auto-uppercase,
 * paste-tolerant: a pasted 8-char string fills every cell. The alphabet
 * excludes `0/O/1/I` — typing one is rejected with a gentle inline hint
 * (announced politely), never an error state. Cells are thumb-sized
 * (`/retrieve` is phone-first) and the value is controlled by the caller.
 *
 * The exclusion set is deliberately duplicated here as a *display rule*:
 * the SPA must not import domain knowledge (AD-10), and the API remains the
 * authority on what a valid code is.
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

const BANNED = new Set(['0', 'O', '1', 'I']);
const LENGTH = 8;

const HINT = 'Codes don’t use 0, O, 1 or I.';

export interface CodeInputProps {
  /** Exactly 8 entries; `''` marks an empty cell. */
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Flag every cell as failing (linked inline error is the caller's). */
  invalid?: boolean;
  /** id of the inline error element — linked to every cell (a11y floor). */
  describedBy?: string;
  className?: string;
}

export function CodeInput({
  value,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
  className,
}: CodeInputProps) {
  const cells = React.useRef<Array<HTMLInputElement | null>>([]);
  const [hint, setHint] = React.useState(false);
  const hintTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  const flashHint = () => {
    setHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(false), 2500);
  };

  const commit = (next: string[], focusIndex: number) => {
    onChange(next);
    const cell = cells.current[focusIndex];
    cell?.focus();
    cell?.select();
  };

  const handleInput = (
    index: number,
    event: React.FormEvent<HTMLInputElement>,
  ) => {
    const typed = event.currentTarget.value;
    const ch = typed.charAt(typed.length - 1).toUpperCase();
    // Restore the controlled source: if the same character is retyped, the
    // vdom value is unchanged and React would not correct the DOM itself.
    event.currentTarget.value = value[index] ?? '';
    if (!ch) return;
    if (BANNED.has(ch)) {
      flashHint();
      return;
    }
    if (!/^[A-Z0-9]$/.test(ch)) return;

    const next = [...value];
    next[index] = ch;
    commit(next, Math.min(index + 1, LENGTH - 1));
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && value[index] === '' && index > 0) {
      event.preventDefault();
      const next = [...value];
      next[index - 1] = '';
      commit(next, index - 1);
    }
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const chars = [...event.clipboardData.getData('text').toUpperCase()].filter(
      (c) => /^[A-Z0-9]$/.test(c),
    );
    if (chars.length === 0) return;
    event.preventDefault();

    const allowed = chars.filter((c) => !BANNED.has(c));
    if (allowed.length !== chars.length) flashHint();
    if (allowed.length === 0) return;

    const next = [...value];
    if (allowed.length >= LENGTH) {
      allowed.slice(0, LENGTH).forEach((ch, i) => {
        next[i] = ch;
      });
      commit(next, LENGTH - 1);
    } else {
      const room = LENGTH - index;
      allowed.slice(0, room).forEach((ch, offset) => {
        next[index + offset] = ch;
      });
      commit(next, Math.min(index + allowed.length, LENGTH - 1));
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: LENGTH }, (_, index) => (
          <React.Fragment key={index}>
            {index === LENGTH / 2 ? (
              <span
                aria-hidden="true"
                className="font-mono text-[22px] text-muted-foreground"
              >
                –
              </span>
            ) : null}
            <input
              ref={(element) => {
                cells.current[index] = element;
              }}
              type="text"
              inputMode="text"
              autoComplete="off"
              maxLength={1}
              value={value[index]}
              disabled={disabled}
              aria-label={`code character ${index + 1}`}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => handleInput(index, event)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={(event) => handlePaste(index, event)}
              className={cn(
                'h-14 w-11.5 rounded-sm border border-border bg-background',
                'text-center font-mono text-2xl uppercase text-foreground',
                'transition-[border-color] duration-150',
                'focus:border-ring focus:outline-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'aria-invalid:border-ring',
              )}
            />
          </React.Fragment>
        ))}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 font-sans text-sm text-muted-foreground"
      >
        {hint ? HINT : ''}
      </p>
    </div>
  );
}
