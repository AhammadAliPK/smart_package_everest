import { useEffect, useState, type SyntheticEvent } from 'react';

import {
  Button,
  ErrorBanner,
  Eyebrow,
  Input,
  ResultCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@locker/ui';

import { api, type ApiError, type LockerSizeValue, type StorePackageReply } from '../api/client.js';

export interface StorePanelProps {
  /** Free-tile click — prefills the size (convenience, never required). */
  prefill: { size: LockerSizeValue; n: number } | null;
  /** Called after a successful store — the grid tile flips to occupied. */
  onStored: () => void | Promise<void>;
}

const SIZES: readonly LockerSizeValue[] = ['SMALL', 'MEDIUM', 'LARGE'];

/**
 * StorePackageForm (EXPERIENCE.md) — the agent rhythm panel: pick a size,
 * optional customer reference, Enter submits. Success yields the ResultCard
 * and clears the form for the next package; a capacity refusal (409) keeps
 * everything the agent typed. Outcomes arrive from the API verbatim (AD-10).
 */
export function StorePanel({ prefill, onStored }: StorePanelProps) {
  const [size, setSize] = useState<LockerSizeValue | null>(null);
  const [customerRef, setCustomerRef] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<StorePackageReply | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);

  useEffect(() => {
    if (prefill !== null) setSize(prefill.size);
  }, [prefill]);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (size === null || pending) return;
    setPending(true);
    setFailure(null);
    try {
      const reply = await api.storePackage({
        size,
        customerRef: customerRef.trim() || undefined,
      });
      setResult(reply);
      setSize(null);
      setCustomerRef('');
      await onStored();
    } catch (error) {
      setFailure(error as ApiError);
    } finally {
      setPending(false);
    }
  };

  const capacityRefusal =
    failure?.code === 'NO_SUITABLE_LOCKER' && size !== null
      ? `No free locker fits a ${size} package right now.`
      : null;
  const internalFailure =
    failure !== null && failure.code !== 'NO_SUITABLE_LOCKER' && failure.code !== 'VALIDATION_ERROR'
      ? 'Something went wrong on our side.'
      : null;
  const refInvalid = failure?.code === 'VALIDATION_ERROR';

  return (
    <section aria-labelledby="store-package-heading">
      {result ? (
        <ResultCard lockerId={result.lockerId} pickupCode={result.pickupCode} />
      ) : null}

      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <Eyebrow>Store a package</Eyebrow>
        <h2
          id="store-package-heading"
          className="mt-1 font-display text-display-sm uppercase text-foreground"
        >
          Next package
        </h2>

        <form className="mt-5" onSubmit={handleSubmit} noValidate>
          <label
            htmlFor="store-package-size"
            className="block font-sans text-sm text-foreground"
          >
            Package size
          </label>
          <div className="mt-1.5">
            <Select
              value={size ?? undefined}
              onValueChange={(value) => setSize(value as LockerSizeValue)}
              disabled={pending}
            >
              <SelectTrigger id="store-package-size" aria-label="Package size">
                <SelectValue placeholder="Choose a size" />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label
            htmlFor="store-package-ref"
            className="mt-4 block font-sans text-sm text-foreground"
          >
            Customer reference <span className="text-faint">(optional)</span>
          </label>
          <Input
            id="store-package-ref"
            className="mt-1.5"
            value={customerRef}
            disabled={pending}
            autoComplete="off"
            aria-invalid={refInvalid || undefined}
            aria-describedby={refInvalid ? 'store-package-ref-error' : undefined}
            onChange={(event) => setCustomerRef(event.target.value)}
          />
          {refInvalid ? (
            <p
              id="store-package-ref-error"
              className="mt-1.5 font-sans text-sm text-foreground"
              role="status"
              aria-live="polite"
            >
              Check this field and try again.
            </p>
          ) : null}

          {capacityRefusal ? (
            <ErrorBanner className="mt-4">{capacityRefusal}</ErrorBanner>
          ) : null}
          {internalFailure ? (
            <ErrorBanner className="mt-4">{internalFailure}</ErrorBanner>
          ) : null}

          <div className="mt-6">
            <Button
              type="submit"
              variant="primary"
              disabled={size === null || pending}
              className="w-full"
            >
              {pending ? (
                <>
                  <Spinner /> Storing…
                </>
              ) : (
                'Store package'
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
