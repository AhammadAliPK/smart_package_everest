import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import '@testing-library/jest-dom/vitest';

// vitest runs without globals; Testing Library's auto-cleanup needs the hook.
afterEach(() => {
  cleanup();
});

// Radix primitives (Select, Dialog) rely on pointer-capture APIs and
// scrollIntoView, which jsdom does not implement. These no-op stubs are the
// documented recipe for driving Radix with user-event under jsdom.
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.releasePointerCapture = () => {};
