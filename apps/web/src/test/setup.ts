import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// vitest runs without globals; Testing Library's auto-cleanup needs the hook.
afterEach(() => {
  cleanup();
});
