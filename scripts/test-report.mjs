/*
 * Feature-grouped test report — `pnpm run test:report`.
 *
 * Runs the three suites (domain / api / web) one at a time with vitest's JSON
 * reporter, maps each test FILE to its feature (the suites are deliberately
 * file-per-feature), and emits ONE self-contained HTML page at
 * test-report/index.html. Data is inlined — the page opens straight from
 * disk (file://) with no server, sidestepping the CORS wall that hits the
 * stock vitest HTML report when opened without `vite preview`.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SUITES = [
  { pkg: '@locker/domain', dir: 'packages/domain' },
  { pkg: '@locker/api', dir: 'apps/api' },
  { pkg: '@locker/web', dir: 'apps/web' },
];

/** Test file basename -> feature label. Unmapped files fall back to their name. */
const FEATURE = new Map([
  // Domain policies
  ['allocation.test.ts', 'Smallest-fit allocation'],
  ['locker-id.test.ts', 'Human locker IDs (AD-9)'],
  ['locker-size.test.ts', 'Locker sizes'],
  ['pickup-code.test.ts', 'Pickup codes'],
  ['storage-pricing.test.ts', 'Tiered storage pricing (AD-5)'],
  // API surface
  ['create-locker.test.ts', 'Create locker'],
  ['create-locker.use-case.test.ts', 'Create locker'],
  ['list-lockers.test.ts', 'List lockers / availability'],
  ['list-lockers.use-case.test.ts', 'List lockers / availability'],
  ['store-package.test.ts', 'Store a package'],
  ['store-package.use-case.test.ts', 'Store a package'],
  ['store-refusal.test.ts', 'Refuse when no locker fits'],
  ['pickups.test.ts', 'Pickup endpoint'],
  ['pickup-outcomes.test.ts', 'Calm pickup outcomes (AD-7)'],
  ['pickup-charges.test.ts', 'Charges returned with retrieval'],
  ['retrieve-package.use-case.test.ts', 'Retrieve use-case'],
  ['concurrency-parallel-store.test.ts', 'Concurrency safety'],
  ['concurrency-mixed.test.ts', 'Concurrency safety'],
  ['package-repository.retry.test.ts', 'Repository retry'],
  ['cors.test.ts', 'CORS'],
  ['health.test.ts', 'Health'],
  ['env.test.ts', 'Environment'],
  ['openapi.test.ts', 'OpenAPI docs'],
  // Web UI
  ['chooser.test.tsx', 'Chooser landing'],
  ['agent.test.tsx', 'Agent console'],
  ['create-locker.test.tsx', 'Create-locker dialog'],
  ['store-package.test.tsx', 'Store flow'],
  ['retrieve.test.tsx', 'Customer retrieval'],
  ['shell.test.tsx', 'App shell + theming'],
  ['state-matrix.test.tsx', 'State-matrix hardening'],
]);

const run = (cmd, args, opts) =>
  new Promise((resolve) => {
    execFile(cmd, args, opts, (error, stdout, stderr) =>
      resolve({ error, stdout, stderr }),
    );
  });

async function runSuite(suite) {
  const cwd = path.join(ROOT, suite.dir);
  const bin = path.join(cwd, 'node_modules', '.bin', 'vitest');
  const tmp = await mkdtemp(path.join(tmpdir(), 'locker-report-'));
  const outFile = path.join(tmp, 'results.json');
  const started = Date.now();
  // Non-zero exit (failing tests) still writes the JSON — read it either way.
  // The .bin entry is an executable sh shim, so spawn it directly.
  const { error, stderr } = await run(bin, ['run', '--reporter=json', `--outputFile=${outFile}`], { cwd });
  const raw = await readFile(outFile, 'utf8').catch(() => null);
  await rm(tmp, { recursive: true, force: true });
  if (!raw) {
    return {
      pkg: suite.pkg, failedToRun: true, durationMs: Date.now() - started,
      detail: (error ? String(error.message) : '') + stderr.slice(-2000),
      files: [],
    };
  }
  const json = JSON.parse(raw);
  const files = (json.testResults ?? []).map((file) => ({
    file: path.basename(file.name),
    feature: FEATURE.get(path.basename(file.name)) ?? path.basename(file.name),
    tests: (file.assertionResults ?? []).map((t) => ({
      name: t.title ?? t.fullName,
      status: t.status,
    })),
  }));
  return {
    pkg: suite.pkg, failedToRun: false, durationMs: Date.now() - started, files,
  };
}

const suites = [];
for (const suite of SUITES) suites.push(await runSuite(suite));

const totals = { passed: 0, failed: 0, skipped: 0 };
for (const s of suites)
  for (const f of s.files)
    for (const t of f.tests) {
      if (t.status === 'passed') totals.passed += 1;
      else if (t.status === 'failed') totals.failed += 1;
      else totals.skipped += 1;
    }

const report = {
  generatedAt: new Date().toISOString(),
  totals,
  suites: suites.map(({ pkg, durationMs, failedToRun, files }) => {
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const f of files)
      for (const t of f.tests) counts[t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped'] += 1;
    return { pkg, durationMs, failedToRun, counts, files };
  }),
};

const OUT_DIR = path.join(ROOT, 'test-report');
await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'index.html'), render(report));

const mark = totals.failed === 0 && !suites.some((s) => s.failedToRun)
  ? `all ${totals.passed} tests passing`
  : `${totals.failed} failing, ${totals.passed} passing`;
console.log(`test-report/index.html — ${mark} — ${path.join(OUT_DIR, 'index.html')}`);

function render(report) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Everest Lockers — test report</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f5f2ec; color: #1a1915;
         font: 15px/1.55 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 880px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font: 400 28px/1.2 Georgia, 'Times New Roman', serif; letter-spacing: .01em;
       text-transform: uppercase; margin: 0; }
  .dash { width: 44px; height: 3px; background: #f5a100; margin: 14px 0 18px; }
  .summary { font-family: ui-monospace, Menlo, monospace; font-size: 13px; color: #5b594f; }
  .summary.bad { color: #8c2f1c; font-weight: 700; }
  section.pkg { margin-top: 36px; }
  section.pkg > h2 { font: 400 19px/1.2 Georgia, serif; border-bottom: 1px solid #e5dfd2;
                     padding-bottom: 8px; margin: 0 0 12px; }
  .pkgmeta { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #5b594f; margin: -6px 0 12px; }
  details.feature { margin: 0 0 10px; }
  details.feature > summary { cursor: pointer; padding: 8px 12px; background: #fbf9f3;
                              border: 1px solid #e5dfd2; border-radius: 6px;
                              display: flex; justify-content: space-between; gap: 12px; }
  details.feature > summary:hover { border-color: #c9b57e; }
  .fname { font-weight: 600; }
  .counts { font-family: ui-monospace, Menlo, monospace; font-size: 12px; white-space: nowrap; }
  .ok { color: #3c6e47; } .bad { color: #8c2f1c; } .skip { color: #8b8b84; }
  details.file { margin: 6px 0 6px 12px; }
  details.file > summary { cursor: pointer; color: #5b594f; font-size: 13px;
                           font-family: ui-monospace, Menlo, monospace; }
  ul.tests { list-style: none; margin: 4px 0 12px; padding: 0 0 0 14px; }
  ul.tests li { font-size: 13px; padding: 1px 0; }
  .glyph { display: inline-block; width: 1.4em; font-family: ui-monospace, Menlo, monospace; }
</style>
</head>
<body>
<main>
  <h1>Everest Lockers</h1>
  <div class="dash"></div>
  <p class="summary" id="summary"></p>
  <div id="root"></div>
</main>
<script>
const REPORT = ${JSON.stringify(report)};
const ICON = { passed: '\\u2713', failed: '\\u2717', skipped: '\\u2013', todo: '\\u2013' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const total = REPORT.totals;
const allGood = total.failed === 0 && !REPORT.suites.some((s) => s.failedToRun);
document.getElementById('summary').textContent =
  (allGood ? '\\u2713 all ' + total.passed + ' tests passing'
           : total.failed + ' failing / ' + total.passed + ' passing')
  + '  \\u00b7  generated ' + new Date(REPORT.generatedAt).toLocaleString();
if (!allGood) document.getElementById('summary').classList.add('bad');

const root = document.getElementById('root');
for (const suite of REPORT.suites) {
  const sec = document.createElement('section');
  sec.className = 'pkg';
  const byFeature = new Map();
  for (const f of suite.files) {
    if (!byFeature.has(f.feature)) byFeature.set(f.feature, []);
    byFeature.get(f.feature).push(f);
  }
  const c = suite.counts;
  let html = '<h2>' + esc(suite.pkg) + '</h2>';
  html += '<p class="pkgmeta">' + c.passed + ' passed' + (c.failed ? ' \\u00b7 ' + c.failed + ' failed' : '')
        + (c.skipped ? ' \\u00b7 ' + c.skipped + ' skipped' : '')
        + ' \\u00b7 ' + (suite.durationMs / 1000).toFixed(1) + 's'
        + (suite.failedToRun ? ' \\u00b7 SUITE FAILED TO RUN' : '') + '</p>';
  for (const [feature, files] of byFeature) {
    const fc = { passed: 0, failed: 0, skipped: 0 };
    for (const f of files) for (const t of f.tests) fc[t.status] = (fc[t.status] ?? 0) + 1;
    html += '<details class="feature" open><summary><span class="fname">' + esc(feature)
          + '</span><span class="counts ' + (fc.failed ? 'bad' : 'ok') + '">'
          + fc.passed + '/' + (fc.passed + fc.failed + fc.skipped) + '</span></summary>';
    for (const f of files) {
      html += '<details class="file"><summary>' + esc(f.file) + '</summary><ul class="tests">';
      for (const t of f.tests)
        html += '<li><span class="glyph ' + (t.status === 'failed' ? 'bad' : t.status === 'passed' ? 'ok' : 'skip')
              + '">' + (ICON[t.status] ?? '\\u00b7') + '</span>' + esc(t.name) + '</li>';
      html += '</ul></details>';
    }
    html += '</details>';
  }
  sec.innerHTML = html;
  root.appendChild(sec);
}
</script>
</body>
</html>
`;
}
