import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

/**
 * Build the Prisma client for a connection string.
 *
 * Prisma 7 connects through a driver adapter — here `@prisma/adapter-pg`,
 * the plain `pg` pool. One client per process; the caller owns its lifecycle
 * (`connect()` is implicit and lazy, `disconnect()` on shutdown).
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}
