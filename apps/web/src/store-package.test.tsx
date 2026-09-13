import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, type LockersReply, type StorePackageReply } from './api/client.js';
import { AgentPage } from './routes/AgentPage.js';

vi.mock('./api/client.js', () => ({
  api: { listLockers: vi.fn(), createLocker: vi.fn(), storePackage: vi.fn() },
}));
const listLockers = vi.mocked(api.listLockers);
const storePackage = vi.mocked(api.storePackage);

const station: LockersReply = {
  lockers: [
    { id: 'A1', size: 'SMALL', occupied: false },
    { id: 'A2', size: 'MEDIUM', occupied: true },
  ],
};

const stored: StorePackageReply = { lockerId: 'clx8m2qk4', pickupCode: 'A7BX-K9ZM' };

/** The client always throws ApiError; tests fake the same shape. */
function apiError(code: string, status: number): unknown {
  return Object.assign(new Error(code), { code, status });
}

/**
 * Story 4.5 contract: the agent rhythm. Free-tile prefill, gated submit,
 * ResultCard climax (focus + copy), form clears for the next package, grid
 * refreshes, and the four calm failure paths keep what was typed.
 */
describe('store package', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('gates the submit until a size is chosen; a free tile click prefills it', async () => {
    listLockers.mockResolvedValue(station);
    storePackage.mockResolvedValue(stored);
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    const submit = screen.getByRole('button', { name: /store package/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /small · free/i }));

    expect(submit).toBeEnabled();
    expect(
      screen.getByRole('combobox', { name: /package size/i }),
    ).toHaveTextContent('SMALL');
  });

  it('stores, shows the focused ResultCard, clears the form and refreshes the grid', async () => {
    listLockers.mockResolvedValue(station);
    storePackage.mockResolvedValue(stored);
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');
    expect(listLockers).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /small · free/i }));
    await user.type(
      screen.getByLabelText(/customer reference/i),
      'Meera — pharmacy',
    );
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(storePackage).toHaveBeenCalledWith({
      size: 'SMALL',
      customerRef: 'Meera — pharmacy',
    });

    const card = await screen.findByRole('group', { name: /package stored/i });
    expect(card).toHaveFocus();
    expect(within(card).getByText('clx8m2qk4')).toBeInTheDocument();
    expect(within(card).getByText('A7BX-K9ZM')).toBeInTheDocument();

    // The form clears for the next package; the grid refreshed.
    expect(
      screen.getByRole('combobox', { name: /package size/i }),
    ).toHaveTextContent('Choose a size');
    expect(screen.getByLabelText(/customer reference/i)).toHaveValue('');
    expect(listLockers).toHaveBeenCalledTimes(2);
  });

  it('NO_SUITABLE_LOCKER keeps the form intact with the calm capacity banner', async () => {
    listLockers.mockResolvedValue(station);
    storePackage.mockRejectedValue(apiError('NO_SUITABLE_LOCKER', 409));
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /small · free/i }));
    await user.type(screen.getByLabelText(/customer reference/i), 'Hold at desk');
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(
      await screen.findByText('No free locker fits a SMALL package right now.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/customer reference/i)).toHaveValue('Hold at desk');
    expect(
      screen.getByRole('combobox', { name: /package size/i }),
    ).toHaveTextContent('SMALL');
  });

  it('VALIDATION_ERROR flags the reference field inline, not with a banner', async () => {
    listLockers.mockResolvedValue(station);
    storePackage.mockRejectedValue(apiError('VALIDATION_ERROR', 400));
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /small · free/i }));
    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(
      await screen.findByText('Check this field and try again.'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/customer reference/i),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.queryByText(/no free locker fits/i),
    ).not.toBeInTheDocument();
  });

  it('INTERNAL_ERROR shows the calm banner and the button retries', async () => {
    listLockers.mockResolvedValue(station);
    storePackage
      .mockRejectedValueOnce(apiError('INTERNAL_ERROR', 500))
      .mockResolvedValueOnce(stored);
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /small · free/i }));
    await user.click(screen.getByRole('button', { name: /store package/i }));
    expect(
      await screen.findByText('Something went wrong on our side.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /store package/i }));

    expect(
      await screen.findByRole('group', { name: /package stored/i }),
    ).toBeInTheDocument();
    expect(storePackage).toHaveBeenCalledTimes(2);
  });

  it('copy buttons write to the clipboard and swap to Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // user-event's setup() swaps in its own navigator.clipboard stub; install
    // ours after it so the component's write goes to the spy.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    listLockers.mockResolvedValue(station);
    storePackage.mockResolvedValue(stored);
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /small · free/i }));
    await user.click(screen.getByRole('button', { name: /store package/i }));
    const card = await screen.findByRole('group', { name: /package stored/i });

    await user.click(
      within(card).getByRole('button', { name: /copy pickup code/i }),
    );

    expect(writeText).toHaveBeenCalledWith('A7BX-K9ZM');
    expect(
      within(card).getByRole('button', { name: /pickup code copied/i }),
    ).toBeInTheDocument();
  });
});
