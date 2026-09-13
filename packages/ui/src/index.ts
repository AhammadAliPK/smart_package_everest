/**
 * @locker/ui — presentation-only React component library (AD-10).
 *
 * Placeholder for Epic 4, which owns this package's internals (shadcn/Tailwind,
 * product theme tokens). It must never import an API client or hold business
 * logic; `apps/web` remains the only owner of routing and data fetching.
 */

/** Package identity marker; exists only so this workspace compiles and ships a real entry point. */
export const UI_PACKAGE_NAME = '@locker/ui' as const;
