import { describe, expect, it } from 'vitest';

import type { PackageRetrieval } from '../src/application/ports/package-repository.js';
import { LockerEmptyError } from '../src/application/errors.js';
import { PrismaPackageRepository } from '../src/adapters/db/package-repository.js';
import {
  Prisma,
  type PrismaClient,
} from '../src/adapters/db/generated/prisma/client.js';

/**
 * Story 3.2 — the P2034 bounded retry of the retrieval transaction (AD-3),
 * unit-tested with a conflict-injecting transaction script. The store path
 * reuses the identical loop shape; these tests pin the retrieval one.
 */

/** A write conflict exactly as Prisma surfaces it. */
function writeConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('write conflict', {
    code: 'P2034',
    clientVersion: Prisma.prismaVersion.client,
  });
}

const DONE: PackageRetrieval = {
  lockerId: 'K7Q4M2',
  storedAt: new Date('2026-09-13T09:00:00.000Z'),
  retrievedAt: new Date('2026-09-13T09:05:00.000Z'),
};

/** Prisma stand-in whose $transaction resolves/throws a scripted sequence. */
class ScriptedConflictPrisma {
  /** One entry per attempt: a value to resolve, or an error to throw. */
  readonly script: unknown[];
  attempts = 0;

  constructor(script: unknown[]) {
    this.script = script;
  }

  async $transaction(): Promise<unknown> {
    const next = this.script[this.attempts];
    this.attempts += 1;
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }
}

function repositoryWith(script: unknown[]): {
  repository: PrismaPackageRepository;
  prisma: ScriptedConflictPrisma;
} {
  const prisma = new ScriptedConflictPrisma(script);
  return {
    prisma,
    repository: new PrismaPackageRepository(prisma as unknown as PrismaClient),
  };
}

describe('PrismaPackageRepository.retrieve — P2034 bounded retry', () => {
  it('succeeds on the second attempt after one write conflict', async () => {
    const { repository, prisma } = repositoryWith([writeConflict(), DONE]);

    await expect(
      repository.retrieve('clocker0000000000000000', 'ABCDEFGH'),
    ).resolves.toBe(DONE);
    expect(prisma.attempts).toBe(2);
  });

  it('exhausts after three conflicts and re-raises P2034 (→ INTERNAL_ERROR at the boundary)', async () => {
    const { repository, prisma } = repositoryWith([
      writeConflict(),
      writeConflict(),
      writeConflict(),
    ]);

    await expect(
      repository.retrieve('clocker0000000000000000', 'ABCDEFGH'),
    ).rejects.toMatchObject({ code: 'P2034' });
    expect(prisma.attempts).toBe(3);
  });

  it('succeeds on the first attempt with no conflict', async () => {
    const { repository, prisma } = repositoryWith([DONE]);

    await expect(
      repository.retrieve('clocker0000000000000000', 'ABCDEFGH'),
    ).resolves.toBe(DONE);
    expect(prisma.attempts).toBe(1);
  });

  it('never retries a calm outcome — LOCKER_EMPTY surfaces on attempt one', async () => {
    const calm = new LockerEmptyError('clocker0000000000000000');
    const { repository, prisma } = repositoryWith([calm, DONE]);

    await expect(
      repository.retrieve('clocker0000000000000000', 'ABCDEFGH'),
    ).rejects.toBe(calm);
    expect(prisma.attempts).toBe(1);
  });

  it('never retries an unexpected error either', async () => {
    const unexpected = new Error('connection reset');
    const { repository, prisma } = repositoryWith([unexpected]);

    await expect(
      repository.retrieve('clocker0000000000000000', 'ABCDEFGH'),
    ).rejects.toBe(unexpected);
    expect(prisma.attempts).toBe(1);
  });
});
