/**
 * Export the API's OpenAPI document without a server (AD-10 typegen source).
 *
 * Builds the Fastify app exactly as production does (same schema/plugin
 * registration), reads `/docs/json` through `app.inject()`, and writes the
 * document where `apps/web`'s `openapi-typescript` step consumes it. No
 * socket is bound and no database is touched — the swagger document is pure
 * route metadata.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApp } from '../src/adapters/http/app.js';

const outFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/src/api/openapi.json',
);

// A dummy URL is enough: the Prisma driver pool connects lazily and this run
// never queries — it only reads the composed route schemas.
const app = await buildApp(
  {
    databaseUrl: 'postgres://export:export@localhost:5432/export',
    port: 0,
    storageFeeBase: 10,
  },
  { logger: false },
);

try {
  const response = await app.inject({ method: 'GET', url: '/docs/json' });
  if (response.statusCode !== 200) {
    throw new Error(`/docs/json answered ${response.statusCode}`);
  }
  const document = JSON.stringify(JSON.parse(response.body), null, 2) + '\n';
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, document, 'utf8');
  console.log(`export-openapi: wrote ${outFile} (${document.length} bytes)`);
} finally {
  await app.close();
}
