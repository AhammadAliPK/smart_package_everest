import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { Layout } from './routes/Layout.js';
import { AgentPage } from './routes/AgentPage.js';
import { ChooserPage } from './routes/ChooserPage.js';
import { RetrievePage } from './routes/RetrievePage.js';

/**
 * Story 4.1 shell contract: the header (wordmark + theme toggle) renders on
 * every route, route changes move focus to the page title (UX-DR18), and the
 * theme toggle applies + persists (UX-DR3).
 */
function renderAt(path: '/' | '/agent' | '/retrieve') {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <ChooserPage /> },
          { path: '/agent', element: <AgentPage /> },
          { path: '/retrieve', element: <RetrievePage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe('app shell', () => {
  it('renders the header lockup and theme toggle on every route', () => {
    for (const path of ['/', '/agent', '/retrieve'] as const) {
      const { unmount } = renderAt(path);
      expect(screen.getByText('Everest')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /switch to light theme/i }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('focuses the page title on render (route-change announcement)', () => {
    renderAt('/agent');
    const title = screen.getByRole('heading', { name: /station view/i });
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus to the new page title on navigation', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <Layout />,
          children: [
            { path: '/', element: <ChooserPage /> },
            { path: '/agent', element: <AgentPage /> },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: /choose your door/i })).toHaveFocus();

    await router.navigate('/agent');

    // Navigation resolves before React flushes the new route; findByRole
    // waits for the render + the focus effect to land.
    expect(
      await screen.findByRole('heading', { name: /station view/i }),
    ).toHaveFocus();
  });

  it('theme toggle flips the document class and persists the choice', async () => {
    localStorage.clear();
    document.documentElement.classList.add('dark');
    const user = userEvent.setup();

    renderAt('/');
    await user.click(screen.getByRole('button', { name: /switch to light theme/i }));

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('locker-theme')).toBe('light');
    // The accessible name flips with the state.
    expect(
      screen.getByRole('button', { name: /switch to dark theme/i }),
    ).toBeInTheDocument();
  });

  it('offers a skip link straight to main content', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute(
      'href',
      '#main',
    );
  });
});
