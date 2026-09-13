import { defineConfig } from 'vitest/config';

import { loadNearestEnvFile } from './src/config/load-env.js';

// Suites need a DATABASE_URL to truncate against; load the repo-root `.env`
// the same way a real boot does, before any suite file is imported.
loadNearestEnvFile();

export default defineConfig({
  test: {
    environment: 'node',
    // Integration suites share one Postgres and isolate by truncating after
    // each suite, so suite files must not run concurrently.
    fileParallelism: false,
  },
});
