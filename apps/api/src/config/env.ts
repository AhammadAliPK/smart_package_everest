/**
 * Boot-time environment configuration.
 *
 * This module is the ONLY place `process.env` is read. Configuration is parsed
 * and validated once, eagerly, before the application is built — a bad or
 * missing value aborts boot with a single error naming the offending variable
 * (epic-1-context: "no partial boot").
 *
 * Pure by design: `parseEnv` takes an env-shaped record instead of touching
 * `process.env`, so it is directly unit-testable and free of module-level
 * mutable state.
 */

/** Validated application configuration, built once at boot. */
export interface Env {
  /** Postgres connection string. Required. */
  readonly databaseUrl: string;
  /** HTTP port to listen on. Default 3000. */
  readonly port: number;
  /** Base storage fee per 24h day, in plain units (AD-5). Default 10. */
  readonly storageFeeBase: number;
}

/** One invalid environment variable. */
export interface EnvIssue {
  readonly variable: string;
  readonly reason: string;
}

/** Thrown when the environment fails boot-time validation. */
export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map((issue) => `  - ${issue.variable}: ${issue.reason}`)
        .join('\n')}`,
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function readString(
  issues: EnvIssue[],
  source: Record<string, string | undefined>,
  variable: string,
): string | undefined {
  const raw = source[variable];
  if (raw === undefined || raw.trim() === '') {
    issues.push({ variable, reason: 'is required but missing or empty' });
    return undefined;
  }
  return raw.trim();
}

function readOptionalInteger(
  issues: EnvIssue[],
  source: Record<string, string | undefined>,
  variable: string,
  fallback: number,
  minimum: number,
  maximum: number = Number.MAX_SAFE_INTEGER,
): number {
  const raw = source[variable];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw.trim());
  if (
    !Number.isInteger(parsed) ||
    parsed < minimum ||
    parsed > maximum
  ) {
    issues.push({
      variable,
      reason: `must be an integer between ${minimum} and ${maximum}, got "${raw.trim()}"`,
    });
    return fallback;
  }
  return parsed;
}

/**
 * Parse and validate an environment-shaped record.
 *
 * Collects every problem before throwing, so a single boot failure names all
 * offending variables at once.
 */
export function parseEnv(
  source: Record<string, string | undefined> = {},
): Env {
  const issues: EnvIssue[] = [];

  const databaseUrl = readString(issues, source, 'DATABASE_URL');
  const port = readOptionalInteger(issues, source, 'PORT', 3000, 1, 65535);
  const storageFeeBase = readOptionalInteger(
    issues,
    source,
    'STORAGE_FEE_BASE',
    10,
    1,
  );

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  // The required-variable checks guarantee these are present.
  return {
    databaseUrl: databaseUrl as string,
    port,
    storageFeeBase,
  };
}

/** The single entry point that reads the real process environment. */
export function loadEnv(): Env {
  return parseEnv(process.env);
}
