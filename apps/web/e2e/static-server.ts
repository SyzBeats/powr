import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Serves the production build the way deploy/nginx.conf does: the same security headers (read
 * from deploy/security-headers.conf), cache rules and SPA fallback. E2E tests run against it;
 * the Docker image run proves the real nginx (WP0.7).
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const distDir = fileURLToPath(new URL('../dist', import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
const NO_CACHE =
  /^\/(sw\.js|index\.html|manifest\.webmanifest|changelog\.json|version\.json|theme-init\.js)$/;

function securityHeaders(): Record<string, string> {
  const conf = readFileSync(join(repoRoot, 'deploy/security-headers.conf'), 'utf8');
  const headers: Record<string, string> = {};
  for (const match of conf.matchAll(/^add_header\s+(\S+)\s+"([^"]*)"\s+always;$/gm)) {
    headers[match[1]!] = match[2]!;
  }
  return headers;
}

export interface StaticServer {
  readonly url: string;
  /** Serve the next app version: sw.js and version.json get a different build ID. */
  deployNextVersion(): void;
  close(): Promise<void>;
}

export async function startStaticServer(): Promise<StaticServer> {
  if (!existsSync(join(distDir, 'index.html'))) {
    throw new Error('apps/web/dist is missing. Run `pnpm build` before the E2E tests.');
  }
  const headers = securityHeaders();
  const build = (
    JSON.parse(readFileSync(join(distDir, 'version.json'), 'utf8')) as { build: string }
  ).build;
  let nextVersion = false;

  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    let file = normalize(join(distDir, path));
    if (!file.startsWith(distDir)) file = join(distDir, 'index.html');

    const exists = existsSync(file) && statSync(file).isFile();
    if (!exists && (path.startsWith('/assets/') || path.startsWith('/icons/'))) {
      response.writeHead(404, headers).end();
      return;
    }
    const served = exists ? file : join(distDir, 'index.html');
    const servedPath = exists ? path : '/index.html';

    let body: string | Buffer = readFileSync(served);
    if (nextVersion && (servedPath === '/sw.js' || servedPath === '/version.json')) {
      body = body.toString('utf8').replaceAll(build, `${build}-next`);
    }

    const cacheControl = NO_CACHE.test(servedPath)
      ? 'no-cache'
      : servedPath.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : servedPath.startsWith('/icons/')
          ? 'public, max-age=604800'
          : undefined;
    response.writeHead(200, {
      ...headers,
      'Content-Type': CONTENT_TYPES[extname(served)] ?? 'application/octet-stream',
      ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    deployNextVersion: () => {
      nextVersion = true;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
