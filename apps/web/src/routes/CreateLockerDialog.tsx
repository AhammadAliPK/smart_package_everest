import { useState, type SyntheticEvent } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorBanner,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@locker/ui';

import { api, type LockerSizeValue } from '../api/client.js';

export interface CreateLockerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create — the console refreshes its grid. */
  onCreated: () => void | Promise<void>;
}

const SIZES: readonly LockerSizeValue[] = ['SMALL', 'MEDIUM', 'LARGE'];

/**
 * CreateLockerControl (EXPERIENCE.md): size picker + submit in a dialog.
 * The SPA never decides anything — it POSTs the chosen size and mirrors the
 * API's verdict (AD-10). Esc/X close without side effects; a failed create
 * keeps the dialog open with the calm banner.
 */
export function CreateLockerDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLockerDialogProps) {
  const [size, setSize] = useState<LockerSizeValue | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = () => {
    setSize(null);
    setPending(false);
    setFailed(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (pending) return; // don't abandon an in-flight create
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (size === null || pending) return;
    setPending(true);
    setFailed(false);
    try {
      await api.createLocker(size);
      await onCreated();
      reset();
      onOpenChange(false);
    } catch {
      setFailed(true);
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="create-locker-hint">
        <DialogTitle>Create a locker</DialogTitle>
        <DialogDescription id="create-locker-hint">
          Pick a door size — the station grid refreshes when it exists.
        </DialogDescription>

        <form className="mt-6" onSubmit={handleSubmit}>
          <Select
            value={size ?? undefined}
            onValueChange={(value) => setSize(value as LockerSizeValue)}
            disabled={pending}
          >
            <SelectTrigger aria-label="Locker size" id="create-locker-size">
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

          {failed ? (
            <ErrorBanner className="mt-4">
              Something went wrong on our side.
            </ErrorBanner>
          ) : null}

          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="primary" disabled={size === null || pending}>
              {pending ? (
                <>
                  <Spinner /> Creating…
                </>
              ) : (
                'Create locker'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
