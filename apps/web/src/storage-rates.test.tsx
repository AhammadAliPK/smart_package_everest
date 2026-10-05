import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, type PricingReply, type StorePackageReply } from './api/client.js';
import { RetrievePage } from './routes/RetrievePage.js';
import { StorePanel } from './routes/StorePanel.js';

vi.mock('./api/client.js', () => ({
  api: { getPricing: vi.fn(), retrievePackage: vi.fn(), storePackage: vi.fn() },
}));
const getPricing = vi.mocked(api.getPricing);
const storePackage = vi.mocked(api.storePackage);

/** The default rate card the API serves (base fee 10). */
const pricing: PricingReply = {
  baseFee: 10,
  tiers: [
    { tier: 1, fromDay: 1, toDay: 5, perDay: 10 },
    { tier: 2, fromDay: 6, toDay: 10, perDay: 20 },
    { tier: 3, fromDay: 11, toDay: null, perDay: 30 },
  ],
};

const stored: StorePackageReply = { lockerId: 'M4XT2B', pickupCode: 'A7BX-K9ZM' };

/**
 * The rate card decorates the two flows money touches: the agent's store
 * result (policy stated where the code is photographed) and the customer's
 * pickup form (rates before any charge exists). It must also be fail-safe —
 * rates never block or break the flow they ride on.
 */
describe('storage rates display', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the schedule on the agent panel — while filling the form and after storing', async () => {
    getPricing.mockResolvedValue(pricing);
    storePackage.mockResolvedValue(stored);
    const user = userEvent.setup();
    render(
      <StorePanel prefill={{ size: 'SMALL', lockerId: 'A1', n: 1 }} onStored={vi.fn()} />,
    );

    // Rates are stated before any money exists, while the agent fills the form.
    const rates = await screen.findByLabelText('Storage rates');
    expect(within(rates).getByText('Days 1–5')).toBeInTheDocument();
    expect(within(rates).getByText('Days 6–10')).toBeInTheDocument();
    expect(within(rates).getByText('Day 11 onwards')).toBeInTheDocument();
    expect(within(rates).getAllByText('10 / day')).toHaveLength(1);
    expect(within(rates).getByText('30 / day')).toBeInTheDocument();

    // …and they stay up after the ResultCard lands.
    await user.click(screen.getByRole('button', { name: /store package/i }));

    const card = await screen.findByRole('group', { name: /package stored/i });
    expect(within(card).getByText('M4XT2B')).toBeInTheDocument();
    expect(screen.getByLabelText('Storage rates')).toBeInTheDocument();
  });

  it('shows the schedule on the pickup form, before any charge exists', async () => {
    getPricing.mockResolvedValue(pricing);
    render(<RetrievePage />);

    const rates = await screen.findByLabelText('Storage rates');
    expect(within(rates).getByText('Storage rates · 10 / day base')).toBeInTheDocument();
    expect(within(rates).getByText('Days 1–5')).toBeInTheDocument();
  });

  it('renders nothing when the pricing fetch fails — the pickup flow is unaffected', async () => {
    getPricing.mockRejectedValue(new Error('rates unavailable'));
    render(<RetrievePage />);

    // The form is intact (gated as designed until id + code are complete);
    // no rate card anywhere.
    expect(await screen.findByRole('button', { name: /open my locker/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^locker id$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Storage rates')).toBeNull();
  });

  it('renders nothing on a malformed reply (guard, not crash)', async () => {
    getPricing.mockResolvedValue({ tiers: 'nope' } as unknown as PricingReply);
    render(<RetrievePage />);

    expect(await screen.findByRole('button', { name: /open my locker/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Storage rates')).toBeNull();
  });
});
