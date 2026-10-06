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

/** One size's card the way the API serves it: fee × the tier multipliers. */
function sizePricing(size: 'SMALL' | 'MEDIUM' | 'LARGE', baseFee: number) {
  return {
    size,
    baseFee,
    tiers: [
      { tier: 1, fromDay: 1, toDay: 5, perDay: baseFee },
      { tier: 2, fromDay: 6, toDay: 10, perDay: 2 * baseFee },
      { tier: 3, fromDay: 11, toDay: null, perDay: 3 * baseFee },
    ],
  };
}

/** The seeded rate card (SMALL 10 · MEDIUM 15 · LARGE 20). */
const pricing: PricingReply = {
  sizes: [sizePricing('SMALL', 10), sizePricing('MEDIUM', 15), sizePricing('LARGE', 20)],
};

const stored: StorePackageReply = { lockerId: 'M4XT2B', pickupCode: 'A7BX-K9ZM' };

/**
 * The rate card decorates the two flows money touches: the agent's store
 * form (policy stated where the code is photographed) and the customer's
 * pickup form (rates before any charge exists). It must also be fail-safe —
 * rates never block or break the flow they ride on.
 */
describe('storage rates display', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows only the selected size on the agent panel, all three once the choice resets', async () => {
    getPricing.mockResolvedValue(pricing);
    storePackage.mockResolvedValue(stored);
    const user = userEvent.setup();
    render(
      <StorePanel prefill={{ size: 'SMALL', lockerId: 'A1', n: 1 }} onStored={vi.fn()} />,
    );

    // SMALL is selected → its block only; the other sizes are not rendered.
    const rates = await screen.findByLabelText('Storage rates');
    expect(within(rates).queryByLabelText('Storage rates · MEDIUM')).toBeNull();
    expect(within(rates).queryByLabelText('Storage rates · LARGE')).toBeNull();

    const small = within(rates).getByLabelText('Storage rates · SMALL');
    expect(within(small).getByText('SMALL · 10 / day base')).toBeInTheDocument();
    expect(within(small).getByText('Days 1–5')).toBeInTheDocument();
    expect(within(small).getByText('Day 11 onwards')).toBeInTheDocument();
    expect(within(small).getByText('10 / day')).toBeInTheDocument();
    expect(within(small).queryByText('45 / day')).toBeNull();

    // …and the card stays up after the ResultCard lands — back to all three,
    // because a successful store clears the selection for the next package.
    await user.click(screen.getByRole('button', { name: /store package/i }));

    const card = await screen.findByRole('group', { name: /package stored/i });
    expect(within(card).getByText('M4XT2B')).toBeInTheDocument();
    const after = screen.getByLabelText('Storage rates');
    expect(within(after).getAllByLabelText(/Storage rates · /)).toHaveLength(3);
  });

  it('shows the schedule on the pickup form, before any charge exists', async () => {
    getPricing.mockResolvedValue(pricing);
    render(<RetrievePage />);

    const rates = await screen.findByLabelText('Storage rates');
    expect(within(rates).getAllByLabelText(/Storage rates · /)).toHaveLength(3);
    const medium = within(rates).getByLabelText('Storage rates · MEDIUM');
    expect(within(rates).getByText('SMALL · 10 / day base')).toBeInTheDocument();
    expect(within(medium).getByText('Days 1–5')).toBeInTheDocument();
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
    getPricing.mockResolvedValue({
      sizes: [{ size: 'SMALL', baseFee: 10 }], // tiers missing
    } as unknown as PricingReply);
    render(<RetrievePage />);

    expect(await screen.findByRole('button', { name: /open my locker/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Storage rates')).toBeNull();
  });
});
