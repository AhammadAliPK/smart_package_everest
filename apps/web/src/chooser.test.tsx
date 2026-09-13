import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AgentPage } from './routes/AgentPage.js';
import { ChooserPage } from './routes/ChooserPage.js';
import { RetrievePage } from './routes/RetrievePage.js';

/**
 * Story 4.2 chooser contract: two RoleCards with the deck microcopy, whole
 * card as the click target (clicking inner text navigates), SPA navigation to
 * both destinations, and a plain href so the cards work without JS.
 */
function renderApp() {
  const router = createMemoryRouter([
    { path: '/', element: <ChooserPage /> },
    { path: '/agent', element: <AgentPage /> },
    { path: '/retrieve', element: <RetrievePage /> },
  ]);
  return render(<RouterProvider router={router} />);
}

describe('chooser landing', () => {
  it('renders both role cards with the deck microcopy', () => {
    renderApp();

    const agentCard = screen.getByRole('link', { name: /store packages/i });
    const customerCard = screen.getByRole('link', { name: /pick up a package/i });

    expect(agentCard).toHaveTextContent('Delivery agent');
    expect(agentCard).toHaveTextContent(
      'See the station, drop packages in, get pickup codes.',
    );
    expect(customerCard).toHaveTextContent('Customer');
    expect(customerCard).toHaveTextContent(
      'Enter your locker ID and pickup code.',
    );
  });

  it('keeps a real href on both cards (works without JS)', () => {
    renderApp();

    expect(screen.getByRole('link', { name: /store packages/i })).toHaveAttribute(
      'href',
      '/agent',
    );
    expect(screen.getByRole('link', { name: /pick up a package/i })).toHaveAttribute(
      'href',
      '/retrieve',
    );
  });

  it('navigates to the agent console when any part of the card is clicked', async () => {
    renderApp();
    const user = userEvent.setup();

    // Inner text, not the card root — the whole card is the target.
    await user.click(screen.getByText('See the station, drop packages in, get pickup codes.'));

    expect(
      await screen.findByRole('heading', { name: /station view/i }),
    ).toBeInTheDocument();
  });

  it('navigates to customer retrieval from the customer card', async () => {
    renderApp();
    const user = userEvent.setup();

    await user.click(screen.getByText('Pick up a package'));

    expect(
      await screen.findByRole('heading', { name: /pick up a package/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Store packages')).not.toBeInTheDocument();
  });
});
