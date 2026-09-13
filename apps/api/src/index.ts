import { buildApp } from './adapters/http/app.js';
import { EnvValidationError, loadEnv } from './config/env.js';

/**
 * Process entrypoint — the only place the server binds a socket.
 *
 * Order matters: env is validated first, so a bad environment aborts before
 * the app (and nothing else) is built — no partial boot.
 */
async function main(): Promise<void> {
  const env = loadEnv();

  const app = await buildApp(env);

  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info(
    { port: env.port, storageFeeBase: env.storageFeeBase },
    `locker api listening on port ${env.port}`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    // One clear config error naming the offending variable(s), then a
    // non-zero exit. No traceback noise for a problem the operator can fix.
    console.error(`boot failed: ${error.message}`);
  } else {
    console.error('boot failed with an unexpected error:', error);
  }
  process.exit(1);
});
