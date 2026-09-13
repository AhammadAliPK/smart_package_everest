import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { config as dotenvConfig } from 'dotenv';

/**
 * Load the nearest `.env` file, walking up from the current directory.
 *
 * The monorepo keeps one `.env` at the repo root, but every process entry
 * point runs from its own workspace directory (`pnpm --filter @locker/api
 * dev`, `node apps/api/dist/index.js`) — so the file has to be searched for
 * rather than assumed. Variables already set in the environment always win:
 * dotenv never overrides, which is what makes deployments (which pass real
 * environment variables) immune to a stray `.env` on disk.
 */
export function loadNearestEnvFile(from: string = process.cwd()): void {
  let directory = from;

  for (;;) {
    const candidate = join(directory, '.env');
    if (existsSync(candidate)) {
      dotenvConfig({ path: candidate, quiet: true });
      return;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      return; // reached the filesystem root — no .env anywhere, that's fine
    }
    directory = parent;
  }
}
