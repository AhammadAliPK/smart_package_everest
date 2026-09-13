/**
 * CodeInput (EXPERIENCE.md component patterns) — the 8 pickup-code cells.
 *
 * `XXXX-XXXX` with a display-only dash — two real chunks, so below 480px
 * they stack 4-over-4 instead of ragged-wrapping mid-chunk. Auto-advance,
 * auto-uppercase,
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

interface CellProps {
  index: number;
  value: string;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  register: (element: HTMLInputElement | null) => void;
  onInput: (index: number, event: React.FormEvent<HTMLInputElement>) => void;
  onKeyDown: (index: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (index: number, event: React.ClipboardEvent<HTMLInputElement>) => void;
}

/** One pickup-code cell — the chunk containers own the layout, this owns
 *  the behavior (advance, backspace, paste, banned-char hint). */
function Cell({
  index,
  value,
  disabled,
  invalid,
  describedBy,
  register,
  onInput,
  onKeyDown,
  onPaste,
}: CellProps) {
  return (
    <input
      ref={register}
      type="text"
      inputMode="text"
      autoComplete="off"
      maxLength={1}
      value={value}
      disabled={disabled}
      aria-label={`code character ${index + 1}`}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onInput(index, event)}
      onKeyDown={(event) => onKeyDown(index, event)}
      onPaste={(event) => onPaste(index, event)}
      className={cn(
        // Fluid within a band: grows to fill the chunk, floored at the 44px
        // touch-target minimum, capped at 56px so a wide card doesn't turn
        // the cells into balloons.
        'h-14 min-w-11 max-w-14 flex-1 rounded-sm border border-border bg-background',
        'text-center font-mono text-2xl uppercase text-foreground',
        'transition-[border-color] duration-150',
        'focus:border-ring focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-ring',
      )}
    />
  );
}

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
      {/* DESIGN.md: "chunked `XXXX-XXXX`" — two real chunks, never a ragged
          flex-wrap. Cells flex within a band — floored at the 44px
          touch-target minimum, capped at 56px so they never balloon on a
          wide card — and each chunk centers, so the control composes
          cleanly at every section width and cannot overflow it. ≥480px: one
          row, chunks joined by the display dash. Below that the chunks
          stack 4-over-4 (eight cells can't clear the 44px floor in a phone
          column); the between-chunks dash hides when they stack. */}
      <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center">
        <div className="flex flex-1 justify-center gap-2">
          {Array.from({ length: LENGTH / 2 }, (_, offset) => (
            <Cell
              key={offset}
              index={offset}
              value={value[offset] ?? ''}
              disabled={disabled}
              invalid={invalid}
              describedBy={describedBy}
              register={(element) => {
                cells.current[offset] = element;
              }}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className="hidden px-1 font-mono text-[22px] text-muted-foreground min-[480px]:block"
        >
          –
        </span>
        <div className="flex flex-1 justify-center gap-2">
          {Array.from({ length: LENGTH / 2 }, (_, offset) => (
            <Cell
              key={offset}
              index={LENGTH / 2 + offset}
              value={value[LENGTH / 2 + offset] ?? ''}
              disabled={disabled}
              invalid={invalid}
              describedBy={describedBy}
              register={(element) => {
                cells.current[LENGTH / 2 + offset] = element;
              }}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
          ))}
        </div>
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
