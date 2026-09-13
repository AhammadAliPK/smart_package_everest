import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { api, type LockersReply } from './api/client.js';
import { AgentPage } from './routes/AgentPage.js';

vi.mock('./api/client.js', () => ({ api: { listLockers: vi.fn() } }));
const listLockers = vi.mocked(api.listLockers);

const station: LockersReply = {
  lockers: [
    { id: 'A1', size: 'SMALL', occupied: false },
    { id: 'A2', size: 'MEDIUM', occupied: true },
    { id: 'A3', size: 'LARGE', occupied: false },
  ],
};

/**
 * Story 4.3 console contract: skeleton cold load (never spinner-only), tiles
 * that mirror the API verbatim, the aria-live count summary, manual refresh,
 * and the silent stale path for failed polls.
 */
describe('agent console', () => {
  it('shows skeleton tiles matching the final layout on cold load', async () => {
    let resolveList: (reply: LockersReply) => void = () => {};
    listLockers.mockImplementation(
      () => new Promise<LockersReply>((resolve) => (resolveList = resolve)),
    );

    render(<AgentPage />);

    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(listLockers).toHaveBeenCalledTimes(1);

    await act(async () => resolveList(station));
    expect(screen.getByText('2 free of 3')).toBeInTheDocument();
  });

  it('renders one button per free tile and no control on occupied tiles', async () => {
    listLockers.mockResolvedValue(station);
    render(<AgentPage />);

    expect(
      await screen.findByRole('button', { name: /small · free/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /large · free/i }),
    ).toBeInTheDocument();

    const occupied = screen.getByText('MEDIUM · OCCUPIED');
    expect(occupied.closest('button')).toBeNull();
    // Every door has its number on it (DESIGN.md: id in typography.code) —
    // the occupied one quietly muted, the free ones on the cream door.
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('A3')).toBeInTheDocument();
  });

  it('announces the free count through a polite live region', async () => {
    listLockers.mockResolvedValue(station);
    render(<AgentPage />);

    const summary = await screen.findByText('2 free of 3');
    expect(summary.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('re-fetches when Refresh is pressed', async () => {
    listLockers.mockResolvedValue(station);
    render(<AgentPage />);
    await screen.findByText('2 free of 3');

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(listLockers).toHaveBeenCalledTimes(2);
  });

  it('keeps the tiles and stale-labels the timestamp when a poll fails', async () => {
    listLockers.mockResolvedValue(station);
    render(<AgentPage />);
    await screen.findByText('2 free of 3');

    listLockers.mockRejectedValueOnce(new Error('network down'));
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(screen.getByText(/last updated .+— updating…/i)).toBeInTheDocument();
    expect(screen.getByText('2 free of 3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /small · free/i }),
    ).toBeInTheDocument();
  });
});
