/**
 * Header, caching and SPA smoke test for a running POWR server (technical concept §7.3, §7.5).
 * Used against the local Docker image in CI and against beta/production after each deploy.
 *
 *   node deploy/smoke.ts http://localhost:8080 [--expect-build <sha>]
 */
import { readFileSync } from 'node:fs';

const [baseUrl, flag, expectedBuild] = process.argv.slice(2);
if (!baseUrl || (flag && flag !== '--expect-build')) {
  console.error('Usage: node deploy/smoke.ts <base-url> [--expect-build <build>]');
  process.exit(2);
}

// The expected security headers come from the same file nginx includes.
const expectedHeaders = Object.fromEntries(
  [
    ...readFileSync(new URL('./security-headers.conf', import.meta.url), 'utf8').matchAll(
      /^add_header\s+(\S+)\s+"([^"]*)"\s+always;$/gm,
    ),
  ].map((match) => [match[1]!.toLowerCase(), match[2]!]),
);

const failures: string[] = [];
let checks = 0;

function check(condition: boolean, message: string) {
  checks++;
  if (!condition) failures.push(message);
}

async function get(path: string, init: RequestInit = {}) {
  const response = await fetch(new URL(path, baseUrl), { redirect: 'manual', ...init });
  for (const [name, value] of Object.entries(expectedHeaders)) {
    check(
      response.headers.get(name) === value,
      `${path}: header ${name} is "${response.headers.get(name)}"`,
    );
  }
  return response;
}

const cacheControl = (response: Response) => response.headers.get('cache-control') ?? '';

const index = await get('/');
const html = await index.text();
check(index.status === 200, `/: status ${index.status}`);
check(index.headers.get('content-type')?.startsWith('text/html') ?? false, '/: not served as HTML');
check(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), '/: inline <script> in index.html');
check(!/\sstyle=/i.test(html) && !/<style/i.test(html), '/: inline style in index.html');
check(!/nginx\/\d/.test(index.headers.get('server') ?? ''), '/: server version is exposed');

for (const path of [
  '/index.html',
  '/sw.js',
  '/manifest.webmanifest',
  '/version.json',
  '/theme-init.js',
]) {
  const response = await get(path);
  check(response.status === 200, `${path}: status ${response.status}`);
  check(
    cacheControl(response) === 'no-cache',
    `${path}: Cache-Control "${cacheControl(response)}"`,
  );
}

const manifest = await get('/manifest.webmanifest');
check(
  manifest.headers.get('content-type')?.startsWith('application/manifest+json') ?? false,
  'manifest: wrong content type',
);

const version = (await (await get('/version.json')).json()) as { version: string; build: string };
check(Boolean(version.version), 'version.json: no version');
if (expectedBuild)
  check(
    version.build === expectedBuild,
    `version.json: build ${version.build}, expected ${expectedBuild}`,
  );

const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
check(Boolean(asset), 'index.html: no hashed entry script');
if (asset) {
  const response = await get(asset, { headers: { 'Accept-Encoding': 'gzip' } });
  check(response.status === 200, `${asset}: status ${response.status}`);
  check(
    cacheControl(response) === 'public, max-age=31536000, immutable',
    `${asset}: Cache-Control "${cacheControl(response)}"`,
  );
  check(
    response.headers.get('content-type')?.includes('javascript') ?? false,
    `${asset}: not served as JavaScript`,
  );
}

const missing = await get('/assets/does-not-exist-0000.js');
check(
  missing.status === 404,
  `missing asset: status ${missing.status} (must be 404, never index.html)`,
);

const icon = await get('/icons/icon-192.png');
check(
  icon.status === 200 && icon.headers.get('content-type') === 'image/png',
  '/icons/icon-192.png: not a PNG',
);
check(
  cacheControl(icon) === 'public, max-age=604800',
  `/icons: Cache-Control "${cacheControl(icon)}"`,
);

const deepLink = await get('/settings');
check(
  deepLink.status === 200 && (await deepLink.text()).includes('<div id="root">'),
  '/settings: no SPA fallback',
);

// The static website copy of the legal texts (LEG-09, TD-71): plain HTML without scripts or
// inline styles, revalidated, and a 404 (not the app shell) for a page that does not exist.
for (const path of [
  '/legal-static/',
  '/legal-static/imprint.html',
  '/legal-static/privacy.html',
  '/legal-static/disclaimer.html',
  '/legal-static/attributions.html',
]) {
  const response = await get(path);
  const page = await response.text();
  check(response.status === 200, `${path}: status ${response.status}`);
  check(
    response.headers.get('content-type')?.startsWith('text/html') ?? false,
    `${path}: not HTML`,
  );
  check(
    cacheControl(response) === 'no-cache',
    `${path}: Cache-Control "${cacheControl(response)}"`,
  );
  check(!/<script/i.test(page), `${path}: has a <script>`);
  check(!/\sstyle=/i.test(page) && !/<style/i.test(page), `${path}: inline style`);
  check(!page.includes('<div id="root">'), `${path}: served the app shell`);
}
const missingLegal = await get('/legal-static/does-not-exist.html');
check(missingLegal.status === 404, `missing legal page: status ${missingLegal.status}`);

if (failures.length > 0) {
  console.error(`Smoke test FAILED for ${baseUrl} (${failures.length} of ${checks} checks):`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`Smoke test passed for ${baseUrl}: ${checks} checks (build ${version.build}).`);
