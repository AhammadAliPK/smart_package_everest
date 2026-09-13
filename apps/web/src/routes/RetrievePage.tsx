import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import {
  BrandDash,
  Button,
  ChargeSummary,
  CodeInput,
  ErrorBanner,
  Eyebrow,
  Input,
  Spinner,
} from '@locker/ui';

import { api, type ApiError, type PickupReply } from '../api/client.js';
import { usePageTitleFocus } from './usePageFocus.js';

/** Never mutated in place — cells are always rebuilt via spread. */
const EMPTY_CODE: string[] = ['', '', '', '', '', '', '', ''];

/**
 * `/retrieve` — customer pickup, phone-first (Meera, one hand, at the
 * station). Locker ID + the 8-cell code; Enter submits. Errors never destroy
 * input: the failing field is flagged inline, everything stays put. Success
 * replaces the form with the confirmation + the charge ledger, verbatim from
 * the API (AD-10) — with one tap to retrieve another.
 */
export function RetrievePage() {
  const titleRef = usePageTitleFocus<HTMLHeadingElement>();
  const confirmRef = useRef<HTMLDivElement>(null);

  const [lockerId, setLockerId] = useState('');
  const [code, setCode] = useState<string[]>(EMPTY_CODE);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PickupReply | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);

  const codeComplete = code.every((cell) => cell !== '');

  useEffect(() => {
    if (result !== null) confirmRef.current?.focus();
  }, [result]);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lockerId.trim() || !codeComplete || pending) return;
    setPending(true);
    setFailure(null);
    try {
      setResult(await api.retrievePackage({ lockerId: lockerId.trim(), pickupCode: code.join('') }));
    } catch (error) {
      setFailure(error as ApiError);
    } finally {
      setPending(false);
    }
  };

  const resetForAnother = () => {
    // Another package means a different locker + code — start the form over.
    setResult(null);
    setFailure(null);
    setLockerId('');
    setCode(EMPTY_CODE);
  };

  const lockerError =
    failure?.code === 'LOCKER_NOT_FOUND'
      ? 'No locker with that ID at this station.'
      : failure?.code === 'VALIDATION_ERROR'
        ? 'Check the locker ID and try again.'
        : null;
  const codeError =
    failure?.code === 'INVALID_PICKUP_CODE'
      ? 'That code doesn’t match this locker.'
      : null;
  const banner =
    failure?.code === 'LOCKER_EMPTY'
      ? 'This locker is already empty — the package may have been picked up.'
      : failure !== null && !lockerError && !codeError
        ? 'Something went wrong on our side.'
        : null;

  return (
    <section className="mx-auto w-full max-w-[520px] px-[margin-mobile] py-section md:px-[margin-desktop]">
      <Eyebrow>Customer pickup</Eyebrow>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="page-title mt-2 font-display text-display uppercase text-foreground"
      >
        Pick up a package
      </h1>
      <BrandDash className="mt-4" />

      {result ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          aria-labelledby="retrieval-confirmation"
          className="mt-8 rounded-lg border border-cream-edge bg-card px-6 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <h2
            id="retrieval-confirmation"
            className="font-display text-display-sm uppercase text-foreground"
          >
            Locker {result.lockerId} is open.
          </h2>
          <p className="mt-2 font-sans text-base text-muted-foreground">
            Take your package.
          </p>

          <ChargeSummary
            className="mt-6"
            daysCharged={result.daysCharged}
            storageCharge={result.storageCharge}
            breakdown={result.breakdown}
          />

          <Button
            variant="secondary"
            className="mt-6"
            onClick={resetForAnother}
          >
            Retrieve another package
          </Button>
        </div>
      ) : (
        <form className="mt-8" onSubmit={handleSubmit} noValidate>
          <label htmlFor="retrieve-locker-id" className="block font-sans text-sm text-foreground">
            Locker ID
          </label>
          <Input
            id="retrieve-locker-id"
            className="mt-1.5"
            value={lockerId}
            disabled={pending}
            autoComplete="off"
            aria-invalid={lockerError !== null || undefined}
            aria-describedby={lockerError ? 'retrieve-locker-id-error' : undefined}
            onChange={(event) => setLockerId(event.target.value)}
          />
          {lockerError ? (
            <p id="retrieve-locker-id-error" className="mt-1.5 font-sans text-sm text-foreground">
              {lockerError}
            </p>
          ) : null}

          <p className="mt-5 font-sans text-sm text-foreground" id="retrieve-code-label">
            Pickup code
          </p>
          <CodeInput
            className="mt-1.5"
            value={code}
            onChange={setCode}
            disabled={pending}
            invalid={codeError !== null}
          />
          {codeError ? (
            <p
              id="retrieve-code-error"
              className="font-sans text-sm text-foreground"
              role="alert"
            >
              {codeError}
            </p>
          ) : null}

          {banner ? <ErrorBanner className="mt-4">{banner}</ErrorBanner> : null}

          <Button
            type="submit"
            variant="primary"
            className="mt-6 w-full"
            disabled={!lockerId.trim() || !codeComplete || pending}
          >
            {pending ? (
              <>
                <Spinner /> Opening…
              </>
            ) : (
              'Open my locker'
            )}
          </Button>
        </form>
      )}
    </section>
  );
}
