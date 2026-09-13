import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { PrismaClient } from '../src/adapters/db/generated/prisma/client.js';
import { createPrismaClient } from '../src/adapters/db/prisma.js';

const execFileAsync = promisify(execFile);

/**
 * Shared test-database helper.
 *
 * Isolation strategy for this story: **truncate-after-suite**. Each suite
 * truncates every table it may have touched in `afterAll`, running against
 * the real compose Postgres rather than a wrapped transaction — a rollback
 * strategy would fight the interactive transactions the store story (1.4)
 * introduces, and truncation keeps what the suites prove honest.
 *
 * Concurrency: `vitest.config.ts` sets `fileParallelism: false` so two
 * suites can never truncate each other's rows mid-test.
 */

/** The database the suites run against (compose Postgres by default). */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || url.trim() === '') {
    throw new Error(
      'No database configured for the integration suites: set DATABASE_URL ' +
        '(or TEST_DATABASE_URL), e.g. in .env — `docker compose up -d postgres`.',
    );
  }
  return url.trim();
}

let prismaClient: PrismaClient | undefined;
let migrationsPromise: Promise<void> | undefined;

/** One shared client per test process, pointed at the test database. */
export function getTestPrisma(): PrismaClient {
  prismaClient ??= createPrismaClient(testDatabaseUrl());
  return prismaClient;
}

/**
 * Apply the committed migrations (AD-8) so a freshly created compose volume
 * is testable without a manual step. Idempotent and memoised per process.
 */
export function applyMigrations(): Promise<void> {
  migrationsPromise ??= (async () => {
    const prismaCli = fileURLToPath(
      new URL('../node_modules/.bin/prisma', import.meta.url),
    );
    await execFileAsync(
      prismaCli,
      ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      {
        cwd: fileURLToPath(new URL('..', import.meta.url)),
        env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
      },
    );
  })();
  return migrationsPromise;
}

/** Truncate every table in the public schema except Prisma's bookkeeping. */
export async function truncateAll(): Promise<void> {
  const prisma = getTestPrisma();

  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );

  if (tables.length === 0) {
    return;
  }

  const quoted = tables
    .map((table) => `"${table.tablename}"`)
    .sort()
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}

/** Close the shared client — call once in `afterAll`. */
export async function closeTestPrisma(): Promise<void> {
  await prismaClient?.$disconnect();
  prismaClient = undefined;
  migrationsPromise = undefined;
}
