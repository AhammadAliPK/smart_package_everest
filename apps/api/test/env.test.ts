import { describe, expect, it } from 'vitest';

import { EnvValidationError, parseEnv } from '../src/config/env.js';

describe('parseEnv', () => {
  it('accepts a full environment', () => {
    expect(
      parseEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
        PORT: '8080',
        STORAGE_FEE_BASE: '25',
      }),
    ).toEqual({
      databaseUrl: 'postgres://user:pass@localhost:5432/locker',
      port: 8080,
      storageFeeBase: 25,
    });
  });

  it('applies the documented defaults for optional variables', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
    });

    expect(env.port).toBe(3000);
    expect(env.storageFeeBase).toBe(10);
  });

  it('fails fast when DATABASE_URL is missing, naming the variable', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('fails on malformed values and names each offending variable', () => {
    try {
      parseEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
        PORT: 'not-a-port',
        STORAGE_FEE_BASE: '-3',
      });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues.map(
        (issue) => issue.variable,
      );
      expect(issues).toContain('PORT');
      expect(issues).toContain('STORAGE_FEE_BASE');
    }
  });
});
