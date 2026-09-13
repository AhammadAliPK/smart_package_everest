import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/inter';
import '@fontsource/dm-serif-display/400.css';

import { App } from './App.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('missing #root mount point');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
