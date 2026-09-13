/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

/**
 * Vite + React + Tailwind 4 for the SPA; jsdom for component tests.
 *
 * In dev, the API's root-level routes are proxied to the local Fastify
 * service so the SPA stays same-origin; in production the base URL comes
 * from `VITE_API_BASE_URL` (see src/api/client.ts).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: Object.fromEntries(
      ['/health', '/lockers', '/packages', '/pickups', '/docs'].map((path) => [
        path,
        { target: API_PROXY_TARGET, changeOrigin: true },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // One file at a time — same memory discipline as the API suites.
    fileParallelism: false,
  },
});
