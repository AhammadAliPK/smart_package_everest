import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, type PickupReply } from './api/client.js';
import { RetrievePage } from './routes/RetrievePage.js';

vi.mock('./api/client.js', () => ({
  api: { retrievePackage: vi.fn() },
}));
const retrievePackage = vi.mocked(api.retrievePackage);

const retrieved: PickupReply = {
  lockerId: 'clx8m2qk4',
  retrievedAt: '2026-09-13T18:00:00.000Z',
  storageCharge: 210,
  daysCharged: 12,
  breakdown: [
    { tier: 1, days: 5, rate: 10, amount: 50 },
    { tier: 2, days: 5, rate: 20, amount: 100 },
    { tier: 3, days: 2, rate: 30, amount: 60 },
  ],
};

function apiError(code: string, status: number): unknown {
  return Object.assign(new Error(code), { code, status });
}

/** Fill the form the way a customer would. */
async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/locker id/i), 'clx8m2qk4');
  pasteCode('A7BXK9ZM');
}

/**
 * Drive the paste handler directly: user-event's paste() degrades silently
 * under jsdom (no ClipboardEvent plumbing), so we dispatch the event with a
 * stubbed clipboardData — the handler contract is what we are testing.
 */
function pasteCode(text: string) {
  fireEvent.paste(screen.getByLabelText('code character 1'), {
    clipboardData: { getData: () => text },
  });
}

/**
 * Story 4.6 contract: CodeInput behavior (advance, uppercase, banned chars,
 * paste), the gated submit, error paths that preserve everything typed, and
 * the confirmation + ledger rendered verbatim from the API.
 */
describe('customer retrieval', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('auto-advances and uppercases; rejects 0/O/1/I with the gentle hint', async () => {
    render(<RetrievePage />);
    const user = userEvent.setup();

    const first = screen.getByLabelText('code character 1');
    await user.type(first, 'a');
    expect(first).toHaveValue('A');
    expect(screen.getByLabelText('code character 2')).toHaveFocus();

    await user.type(screen.getByLabelText('code character 2'), '0');
    expect(screen.getByLabelText('code character 2')).toHaveValue('');
    expect(screen.getByText(/codes don’t use 0, o, 1 or i\./i)).toBeInTheDocument();
  });

  it('a pasted 8-char string fills every cell', () => {
    render(<RetrievePage />);

    pasteCode('a7bxk9zm');

    for (let index = 1; index <= 8; index += 1) {
      expect(screen.getByLabelText(`code character ${index}`)).toHaveValue(
        'A7BXK9ZM'.charAt(index - 1),
      );
    }
  });

  it('gates the submit until both fields are complete', async () => {
    retrievePackage.mockResolvedValue(retrieved);
    render(<RetrievePage />);
    const user = userEvent.setup();

    const submit = screen.getByRole('button', { name: /open my locker/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/locker id/i), 'clx8m2qk4');
    expect(submit).toBeDisabled();

    await fillValidForm(user);
    expect(submit).toBeEnabled();
  });

  it('retrieves: confirmation replaces the form, ledger verbatim, focus lands', async () => {
    retrievePackage.mockResolvedValue(retrieved);
    render(<RetrievePage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /open my locker/i }));

    expect(retrievePackage).toHaveBeenCalledWith({
      lockerId: 'clx8m2qk4',
      pickupCode: 'A7BXK9ZM',
    });

    const confirmation = await screen.findByText(/locker clx8m2qk4 is open\./i);
    expect(confirmation).toBeInTheDocument();
    expect(screen.getByText('Take your package.')).toBeInTheDocument();
    // Focus lands on the confirmation itself — the result is what's announced.
    expect(
      screen.getByLabelText(/locker clx8m2qk4 is open\./i),
    ).toHaveFocus();

    // The ledger, number for number.
    expect(screen.getByText('Storage charge · 12 days')).toBeInTheDocument();
    expect(screen.getByText('Days 1–5 × 10')).toBeInTheDocument();
    expect(screen.getByText('Days 6–10 × 20')).toBeInTheDocument();
    expect(screen.getByText('Days 11–12 × 30')).toBeInTheDocument();
    expect(screen.getByText('210 units')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open my locker/i })).not.toBeInTheDocument();
  });

  it('INVALID_PICKUP_CODE flags the code and preserves every keystroke', async () => {
    retrievePackage.mockRejectedValue(apiError('INVALID_PICKUP_CODE', 404));
    render(<RetrievePage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /open my locker/i }));

    expect(
      await screen.findByText(/that code doesn’t match this locker\./i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/locker id/i)).toHaveValue('clx8m2qk4');
    for (let index = 1; index <= 8; index += 1) {
      expect(screen.getByLabelText(`code character ${index}`)).toHaveValue(
        'A7BXK9ZM'.charAt(index - 1),
      );
    }
    expect(
      screen.getByRole('button', { name: /open my locker/i }),
    ).toBeEnabled(); // one tap to retry
  });

  it('LOCKER_NOT_FOUND flags the locker field inline', async () => {
    retrievePackage.mockRejectedValue(apiError('LOCKER_NOT_FOUND', 404));
    render(<RetrievePage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /open my locker/i }));

    expect(
      await screen.findByText(/no locker with that id at this station\./i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/locker id/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('LOCKER_EMPTY shows the calm banner without touching the form', async () => {
    retrievePackage.mockRejectedValue(apiError('LOCKER_EMPTY', 409));
    render(<RetrievePage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /open my locker/i }));

    expect(
      await screen.findByText(
        /this locker is already empty — the package may have been picked up\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/locker id/i)).toHaveValue('clx8m2qk4');
    expect(screen.getByLabelText('code character 8')).toHaveValue('M');
  });

  it('shows only the tiers actually used', async () => {
    retrievePackage.mockResolvedValue({
      ...retrieved,
      storageCharge: 30,
      daysCharged: 3,
      breakdown: [{ tier: 1, days: 3, rate: 10, amount: 30 }],
    });
    render(<RetrievePage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /open my locker/i }));

    await screen.findByText(/locker clx8m2qk4 is open\./i);
    expect(screen.getByText('Storage charge · 3 days')).toBeInTheDocument();
    expect(screen.getByText('Days 1–3 × 10')).toBeInTheDocument();
    expect(screen.queryByText(/days 6–10/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/day 11/i)).not.toBeInTheDocument();
    expect(screen.getByText('30 units')).toBeInTheDocument();
  });

  it('"Retrieve another" returns to a fresh form', async () => {
    retrievePackage.mockResolvedValue(retrieved);
    render(<RetrievePage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /open my locker/i }));
    await screen.findByText(/locker clx8m2qk4 is open\./i);

    await user.click(screen.getByRole('button', { name: /retrieve another package/i }));

    expect(screen.getByLabelText(/locker id/i)).toBeInTheDocument();
    expect(screen.getByLabelText('code character 1')).toHaveValue('');
  });
});
