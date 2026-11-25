import { readFileSync } from 'node:fs';

import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { undersizedTargets } from './a11y';
import { expect, skipOnboarding, test, waitForOfflineReady } from './fixtures';

/*
 * The static website copy of the legal texts (LEG-09, TD-71; M6c): dist/legal-static/*.html, built
 * from the app's own texts. Read with JavaScript turned off, as a visitor of the website (or a
 * search engine) might: every page loads with the production headers, has no script or inline
 * style, passes axe (WCAG 2.2 A/AA) in light and dark, keeps its targets at 24 px and reflows at
 * 320 px with 200% text. The publisher, the e-mail and the placeholders are those of the app, the
 * attributions page lists exactly the build's attributions, and the service worker leaves the
 * pages to the server once the app is installed.
 */

const PAGES = [
  { path: '/legal-static/', title: 'Legal texts' },
  { path: '/legal-static/imprint.html', title: 'Publisher and imprint', app: '/legal/imprint' },
  { path: '/legal-static/privacy.html', title: 'Privacy notice', app: '/legal/privacy' },
  {
    path: '/legal-static/disclaimer.html',
    title: 'Health and safety notice',
    app: '/legal/disclaimer',
  },
  { path: '/legal-static/attributions.html', title: 'Open-source licences and attributions' },
] as const;

/** The production CSP, from the file nginx includes (the E2E server appends Trusted Types). */
const PRODUCTION_CSP = /Content-Security-Policy\s+"([^"]+)"/.exec(
  readFileSync(new URL('../../../deploy/security-headers.conf', import.meta.url), 'utf8'),
)?.[1];

const byName = (a: string, b: string) => a.localeCompare(b);
const squash = (value: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();

async function axeBothThemes(page: Page, name: string): Promise<void> {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations
        .filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
        .map(
          (violation) =>
            `${name} (${colorScheme}): ${violation.id} ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
        ),
    ).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

/** WCAG 1.4.4/1.4.10: 320 CSS px and 200% text without horizontal scrolling. */
async function checkReflow(page: Page, name: string): Promise<void> {
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    `${name}: horizontal scrolling at 320 px and 200% text`,
  ).toBeLessThanOrEqual(320);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  if (viewport) await page.setViewportSize(viewport);
}

test.describe('static website copy of the legal texts (LEG-09, TD-71)', () => {
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('every page loads with the production headers and has no script or inline style', async ({
      page,
    }) => {
      expect(PRODUCTION_CSP).toBeTruthy();
      for (const { path, title } of PAGES) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        const headers = response?.headers() ?? {};
        expect(headers['content-type'], path).toMatch(/^text\/html/);
        expect(headers['content-security-policy'], path).toContain(PRODUCTION_CSP);
        expect(headers['cache-control'], path).toBe('no-cache');
        expect(await page.locator('script, style, [style]').count(), path).toBe(0);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(page).toHaveTitle(`${title} · POWR`);
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Legal texts' })).toBeVisible();
        // The stylesheet loaded (the CSP allows same-origin styles only): the tokens apply.
        expect(
          await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
          path,
        ).not.toBe('rgba(0, 0, 0, 0)');
      }
    });

    test('names the publisher with the e-mail and the placeholders, as the app does', async ({
      page,
    }) => {
      for (const path of ['/legal-static/', '/legal-static/imprint.html'] as const) {
        await page.goto(path);
        const main = page.getByRole('main');
        await expect(main).toContainText('Simeon Zimmermann');
        await expect(main).toContainText('SZ WEB DEVELOPMENT');
        await expect(main).toContainText('Switzerland');
        await expect(main.getByRole('link', { name: 'tools@sz-development.com' })).toHaveAttribute(
          'href',
          'mailto:tools@sz-development.com',
        );
      }
      await page.goto('/legal-static/imprint.html');
      await expect(page.getByTestId('address-placeholder')).toHaveText(
        'Postal address: to be added before the public release.',
      );
      await expect(page.getByTestId('legal-draft')).toContainText("the publisher's postal address");
      await expect(page.getByTestId('legal-draft')).toContainText('the legal review');

      // The index.html of the app links the pages for visitors without JavaScript.
      await page.goto('/');
      await page.getByRole('link', { name: 'legal texts' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Legal texts');
    });

    test('the attributions page lists exactly the build’s attributions (LEG-06)', async ({
      page,
      request,
    }) => {
      await page.goto('/legal-static/attributions.html');
      const shown = await page
        .getByTestId('attribution')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-name') ?? ''));
      const built = (await (await request.get('/attributions.json')).json()) as {
        name: string;
        noticeText: string | null;
      }[];
      expect(shown.toSorted(byName)).toEqual(built.map((entry) => entry.name).toSorted(byName));
      // The NOTICE texts are shown unchanged (Apache-2.0 §4(d): ECharts, Dexie).
      const notices = await page.getByTestId('notice-text').allTextContents();
      expect(notices.toSorted(byName)).toEqual(
        built.flatMap((entry) => (entry.noticeText ? [entry.noticeText] : [])).toSorted(byName),
      );
      // A page that does not exist is a 404, never the app shell.
      const missing = await page.goto('/legal-static/does-not-exist.html');
      expect(missing?.status()).toBe(404);
    });
  });

  // The pages have no script, so they render the same with JavaScript on; axe needs it to run.
  test('every page passes axe in both themes, keeps 24 px targets and reflows at 320 px', async ({
    page,
  }) => {
    for (const { path } of PAGES) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await axeBothThemes(page, path);
      expect(await undersizedTargets(page), path).toEqual([]);
      await checkReflow(page, path);
    }
  });

  test('the same words as the app, and the service worker leaves the pages to the server', async ({
    page,
    context,
  }) => {
    // The app's legal screens and the website copy show the same text (one source).
    const reader = await context.newPage();
    for (const entry of PAGES) {
      if (!('app' in entry)) continue;
      await page.goto(entry.app);
      const screen = page.getByRole('heading', { level: 1 }).locator('xpath=..');
      await expect(screen.getByRole('heading', { level: 2 }).first()).toBeVisible();
      await reader.goto(entry.path);
      expect(squash(await reader.getByRole('main').textContent()), entry.path).toBe(
        squash(await screen.textContent()),
      );
    }
    await reader.close();

    // Once the service worker controls the origin, a navigation to the website copy still gets
    // the static page from the server, not the app shell (sw.ts: the navigation denylist).
    await skipOnboarding(page);
    await page.goto('/');
    await waitForOfflineReady(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
    await page.goto('/legal-static/privacy.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy notice');
    expect(await page.locator('#root').count()).toBe(0);
    expect(await page.locator('script').count()).toBe(0);
  });
});
