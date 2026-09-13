/**
 * ESLint flat config — monorepo-wide.
 *
 * TS files are parsed with @babel/eslint-parser because typescript-eslint does
 * not support TypeScript 7 yet (its peer range caps at <6.1.0 and it throws on
 * load against TS >=7.0). Every rule enabled here is syntax-only — none needs
 * type information — so the parser swap is lossless for what we enforce today.
 * Revisit when typescript-eslint ships TS 7 support (typescript-eslint#10940).
 *
 * AD-2 (inward-only dependency rule) is enforced mechanically by the
 * `no-restricted-imports` zones below:
 *   - `packages/domain/src/**` and `apps/api/src/application/**` may not import
 *     `fastify`, `@sinclair/typebox`, `@prisma/*` or `prisma/*`.
 *   - `apps/api/src/application/**` may not import from `src/adapters/**`
 *     (adapters implement the ports; the direction is one-way).
 *
 * The committed violating fixtures under `src/__fixtures__/` are excluded from
 * the normal lint pass and are linted on purpose by
 * `scripts/check-boundaries.mjs` (root task `//#check:boundaries`), which
 * asserts ESLint *fails* on them. That keeps the enforcement proof in the repo
 * without turning `turbo lint` red.
 */

import babelParser from '@babel/eslint-parser';

const tsParser = {
  files: ['**/*.ts'],
  languageOptions: {
    parser: babelParser,
    parserOptions: {
      requireConfigFile: false,
      babelOptions: {
        plugins: ['@babel/plugin-syntax-typescript'],
      },
    },
  },
};

/** AD-2: nothing inward-facing may reach for HTTP, DB or schema tooling. */
const forbiddenAcrossTheBoundary = {
  paths: ['fastify', '@sinclair/typebox'],
  patterns: ['@prisma/*', 'prisma/*'],
};

const boundaryZones = [
  {
    files: ['packages/domain/src/**', 'apps/api/src/application/**'],
    rules: {
      'no-restricted-imports': ['error', forbiddenAcrossTheBoundary],
    },
  },
  {
    // Application additionally may not import adapters: adapters depend on
    // application (they implement its ports), never the reverse. AD-2 / AD-4.
    //
    // This is a SEPARATE `no-restricted-imports` declaration merged into one
    // entry on purpose: flat config merges config objects by *rule name* and
    // the last object wins wholesale, so a second object here would silently
    // REPLACE the cross-boundary rule above for application files instead of
    // extending it. Hence the application zone restates both sets.
    files: ['apps/api/src/application/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbiddenAcrossTheBoundary.paths,
          patterns: [
            ...forbiddenAcrossTheBoundary.patterns,
            '**/adapters/**',
            '**/adapters/*',
          ],
        },
      ],
    },
  },
];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/__fixtures__/**',
    ],
  },
  tsParser,
  ...boundaryZones,
  {
    // `no-unused-vars` stays on JS files only: under the babel parser it
    // cannot see type-only usage and false-positives on `import type`. Dead
    // locals/params in TypeScript are caught type-aware by tsc instead
    // (`noUnusedLocals` / `noUnusedParameters` in tsconfig.base.json).
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
