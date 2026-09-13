import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { api, type LockersReply } from './api/client.js';
import { AgentPage } from './routes/AgentPage.js';

vi.mock('./api/client.js', () => ({
  api: { listLockers: vi.fn(), createLocker: vi.fn() },
}));
const listLockers = vi.mocked(api.listLockers);
const createLocker = vi.mocked(api.createLocker);

const station: LockersReply = {
  lockers: [
    { id: 'A1', size: 'SMALL', occupied: false },
    { id: 'A2', size: 'MEDIUM', occupied: true },
  ],
};

/**
 * Story 4.4 contract: a Create locker control in the toolbar, the
 * empty-station EmptyState with its single primary action, and a dialog that
 * POSTs the chosen size, refreshes the grid on success, and stays open with
 * the calm banner on failure.
 */
describe('create locker', () => {
  it('opens the dialog from the toolbar with size picker and a gated submit', async () => {
    listLockers.mockResolvedValue(station);
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /create locker/i }));

    const dialog = await screen.findByRole('dialog', { name: /create a locker/i });
    expect(within(dialog).getByText('Choose a size')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /create locker/i }),
    ).toBeDisabled();
  });

  it('creates a locker, refreshes the grid and closes on success', async () => {
    listLockers.mockResolvedValue(station);
    createLocker.mockResolvedValue({
      lockerId: 'A3',
      size: 'LARGE',
      occupied: false,
    });
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');
    expect(listLockers).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /create locker/i }));
    const dialog = await screen.findByRole('dialog', { name: /create a locker/i });

    await user.click(within(dialog).getByRole('combobox', { name: /locker size/i }));
    await user.click(await screen.findByRole('option', { name: 'LARGE' }));
    await user.click(within(dialog).getByRole('button', { name: /create locker/i }));

    expect(createLocker).toHaveBeenCalledWith('LARGE');
    expect(listLockers).toHaveBeenCalledTimes(2); // grid refreshed
    expect(
      await screen.findByText('1 free of 2'),
    ).toBeInTheDocument();
  });

  it('keeps the dialog open with the calm banner when creation fails', async () => {
    listLockers.mockResolvedValue(station);
    createLocker.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'INTERNAL_ERROR', status: 500 }),
    );
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /create locker/i }));
    const dialog = await screen.findByRole('dialog', { name: /create a locker/i });

    await user.click(within(dialog).getByRole('combobox', { name: /locker size/i }));
    await user.click(await screen.findByRole('option', { name: 'SMALL' }));
    await user.click(within(dialog).getByRole('button', { name: /create locker/i }));

    expect(
      await within(dialog).findByText('Something went wrong on our side.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /create locker/i }),
    ).toBeEnabled();
  });

  it('closes on Escape without creating anything', async () => {
    listLockers.mockResolvedValue(station);
    const user = userEvent.setup();
    render(<AgentPage />);
    await screen.findByText('1 free of 2');

    await user.click(screen.getByRole('button', { name: /create locker/i }));
    await screen.findByRole('dialog', { name: /create a locker/i });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(createLocker).not.toHaveBeenCalled();
  });

  it('shows the empty-station state whose action opens the same dialog', async () => {
    listLockers.mockResolvedValue({ lockers: [] });
    const user = userEvent.setup();
    render(<AgentPage />);

    expect(
      await screen.findByText(/this station has no lockers yet\./i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /create the first locker/i }));

    expect(
      await screen.findByRole('dialog', { name: /create a locker/i }),
    ).toBeInTheDocument();
  });
});
