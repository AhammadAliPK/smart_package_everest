import { loadNearestEnvFile } from './src/config/load-env.js';
import { defineConfig } from 'prisma/config';

// Same rule as the API boot: find the repo-root `.env` from wherever the CLI
// was invoked, without ever overriding real environment variables.
loadNearestEnvFile();

/**
 * Prisma 7 CLI configuration (Prisma 7 no longer reads `url` from
 * schema.prisma, nor `.env` files automatically).
 *
 * `DATABASE_URL` is the same variable the API validates at boot; it is read
 * from the process environment, which docker-compose / the deploy platform
 * provide. A `.env` file is only loaded for local developer convenience.
 *
 * Paths are relative to this file's directory (the config root).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
