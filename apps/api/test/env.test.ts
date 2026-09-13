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
    expect(env.corsOrigin).toBeUndefined();
  });

  it('parses CORS_ORIGIN as a trimmed comma-separated origin list', () => {
    expect(
      parseEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
        CORS_ORIGIN: 'https://everest-web.onrender.com',
      }).corsOrigin,
    ).toEqual(['https://everest-web.onrender.com']);

    expect(
      parseEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
        CORS_ORIGIN:
          ' https://everest-web.onrender.com , http://localhost:8080 ',
      }).corsOrigin,
    ).toEqual(['https://everest-web.onrender.com', 'http://localhost:8080']);
  });

  it('treats a whitespace-only CORS_ORIGIN as unset (optional, not missing)', () => {
    expect(
      parseEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
        CORS_ORIGIN: '   ',
      }).corsOrigin,
    ).toBeUndefined();
  });

  it('fails when a CORS_ORIGIN part is not a plausible origin, naming the variable', () => {
    try {
      parseEnv({
        DATABASE_URL: 'postgres://user:pass@localhost:5432/locker',
        CORS_ORIGIN:
          'https://everest-web.onrender.com,everest-api.onrender.com',
      });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues;
      expect(issues).toHaveLength(1);
      expect(issues[0].variable).toBe('CORS_ORIGIN');
      expect(issues[0].reason).toMatch(/everest-api\.onrender\.com/);
    }
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
