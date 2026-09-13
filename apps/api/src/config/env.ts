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
  /**
   * Origins allowed to call the API cross-origin (CORS). Optional: local
   * development reaches the API through the Vite proxy (same-origin), so the
   * CORS plugin is only registered when `CORS_ORIGIN` is set.
   */
  readonly corsOrigin?: readonly string[];
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

/** A plausible origin: a scheme of http(s) followed by a host. */
const ORIGIN_PATTERN = /^https?:\/\//;

/**
 * Read an optional comma-separated list of http(s) origins.
 *
 * Absent, empty, or whitespace-only means "no CORS" — the variable is
 * optional by design (same-origin deploys need nothing). A list whose parts
 * are not plausible origins is a boot error, reported with the offending
 * values so the operator can fix the one bad entry.
 */
function readOptionalOriginList(
  issues: EnvIssue[],
  source: Record<string, string | undefined>,
  variable: string,
): string[] | undefined {
  const raw = source[variable];
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }

  const origins = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (origins.length === 0) {
    return undefined;
  }

  const invalid = origins.filter((origin) => !ORIGIN_PATTERN.test(origin));
  if (invalid.length > 0) {
    issues.push({
      variable,
      reason: `must be a comma-separated list of http(s) origins (got ${invalid
        .map((origin) => `"${origin}"`)
        .join(', ')})`,
    });
    return undefined;
  }

  return origins;
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
  const corsOrigin = readOptionalOriginList(issues, source, 'CORS_ORIGIN');

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  // The required-variable checks guarantee these are present.
  return {
    databaseUrl: databaseUrl as string,
    port,
    storageFeeBase,
    corsOrigin,
  };
}

/** The single entry point that reads the real process environment. */
export function loadEnv(): Env {
  return parseEnv(process.env);
}
