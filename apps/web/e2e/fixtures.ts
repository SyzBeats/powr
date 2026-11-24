import { expect, test as base, type Page } from '@playwright/test';

import { startStaticServer, type StaticServer } from './static-server';

export interface Recorded {
  /** Content-Security-Policy violations reported by the page (must stay empty). */
  cspViolations: string[];
  /** Requests that leave the origin or are not GET (must stay empty, NFR-PRIV-02). */
  foreignRequests: string[];
}

/**
 * Each test serves the build on its own port: its own origin, so storage and service workers are
 * isolated, and tests may stop the server or deploy a new version without affecting others.
 * Set E2E_BASE_URL to test a running server instead, e.g. the Docker image on :8080.
 */
export const test = base.extend<{ recorded: Recorded; server: StaticServer | null }>({
  server: async ({}, use) => {
    if (process.env['E2E_BASE_URL']) {
      await use(null);
      return;
    }
    const server = await startStaticServer();
    await use(server);
    await server.close();
  },
  baseURL: async ({ server }, use) => use(process.env['E2E_BASE_URL'] ?? server?.url),

  recorded: [
    async ({ context, baseURL }, use) => {
      const recorded: Recorded = { cspViolations: [], foreignRequests: [] };
      const origin = new URL(baseURL ?? 'http://invalid').origin;
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(
            `CSP violation: ${event.violatedDirective} ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
          );
        });
      });
      context.on('console', (message) => {
        const text = message.text();
        if (text.includes('CSP violation') || text.includes('Content Security Policy')) {
          recorded.cspViolations.push(text);
        }
      });
      context.on('request', (request) => {
        const url = new URL(request.url());
        const sameOrigin =
          url.origin === origin || url.protocol === 'blob:' || url.protocol === 'data:';
        if (!sameOrigin || request.method() !== 'GET') {
          recorded.foreignRequests.push(`${request.method()} ${request.url()}`);
        }
      });
      await use(recorded);
      // Every test doubles as a privacy and CSP check (QS-06, §7.3).
      expect(recorded.foreignRequests, 'requests to other origins or non-GET').toEqual([]);
      expect(recorded.cspViolations, 'CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * The first-run path without a plan (ONB-01, PLN-15): the legal gate, then "Just let me log".
 * Every training screen is behind it since M2b. Ends on the log screen.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to POWR' })).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'I have read the health notice and the privacy summary.' })
    .click();
  await page.getByRole('checkbox', { name: 'I am 16 or older.' }).click();
  await page.getByRole('button', { name: 'Just let me log' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Log a set' })).toBeVisible();
}

/** Waits until the service worker is active and the precache install has completed. */
export async function waitForOfflineReady(page: Page): Promise<void> {
  await expect(page.getByTestId('offline-status')).toHaveText('Ready for offline use', {
    timeout: 20_000,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
}

/** The build ID reported by the service worker that controls the page. */
export async function controllerBuild(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) {
          resolve(null);
          return;
        }
        const channel = new MessageChannel();
        channel.port1.addEventListener('message', (event) =>
          resolve((event.data as { build: string }).build),
        );
        channel.port1.start();
        controller.postMessage({ type: 'GET_BUILD' }, [channel.port2]);
      }),
  );
}
