import { createBrowserRouter, RouterProvider } from 'react-router';

import { Layout } from './routes/Layout.js';
import { AgentPage } from './routes/AgentPage.js';
import { ChooserPage } from './routes/ChooserPage.js';
import { RetrievePage } from './routes/RetrievePage.js';

/**
 * Route shell (EXPERIENCE.md IA): chooser landing, agent console, customer
 * retrieval. No auth — roles are navigation, not identity.
 */
export function App() {
  const router = createBrowserRouter([
    {
      element: <Layout />,
      children: [
        { path: '/', element: <ChooserPage /> },
        { path: '/agent', element: <AgentPage /> },
        { path: '/retrieve', element: <RetrievePage /> },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}
