import { AxeBuilder } from '@axe-core/playwright';

import { expect, test } from './fixtures';

test.describe('app shell (WP0.3)', () => {
  test('renders the mobile shell with bottom navigation under the production CSP', async ({
    page,
  }) => {
    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");

    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const tab of ['Home', 'Plan', 'Train', 'Explore', 'Progress']) {
      await expect(nav.getByRole('link', { name: tab })).toBeVisible();
    }

    // Large tap targets (NFR-A11Y-02): every bottom-nav item is at least 48 px high.
    for (const link of await nav.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }

    await nav.getByRole('link', { name: 'Train' }).click();
    await expect(page).toHaveURL(/\/session$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Log a set' })).toBeVisible();
  });

  test('switches light, dark and system theme without reload and keeps it before first paint', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/settings');
    const html = page.locator('html');
    const background = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    const themeColors = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
          meta.getAttribute('content'),
        ),
      );

    const lightBackground = await background();
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await background()).not.toBe(lightBackground);
    expect(await themeColors()).toEqual(['#101214', '#101214']);

    // The pre-paint script applies the stored theme before the app boots (no flash).
    await page.goto('/settings', { waitUntil: 'commit' });
    await page.waitForFunction(
      () => document.readyState !== 'loading' || document.documentElement.dataset['theme'],
    );
    expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBe('dark');

    await page.getByRole('button', { name: 'System' }).click();
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
    expect(await background()).toBe(lightBackground);
    expect(await themeColors()).toEqual(['#f6f6f4', '#101214']);
  });

  test('shadcn components follow the app theme through the colour bridge (TD-21)', async ({
    page,
  }) => {
    // The shadcn Input (`border-input`, `bg-transparent dark:bg-input/30`) on the alert harness.
    const styles = async (osScheme: 'light' | 'dark', theme: 'Light' | 'Dark' | 'System') => {
      await page.emulateMedia({ colorScheme: osScheme });
      await page.goto('/settings');
      const option = page.getByRole('button', { name: theme });
      await option.click();
      // Pressed once the setting is stored, so the next page boots with it.
      await expect(option).toHaveAttribute('aria-pressed', 'true');
      await page.goto('/debug/alerts');
      return page.getByLabel('Device and browser label').evaluate((input) => {
        const style = getComputedStyle(input);
        return {
          border: style.borderTopColor,
          transparent: style.backgroundColor === 'rgba(0, 0, 0, 0)',
        };
      });
    };
    // --input → --fg-muted: #54595f light, #a9afb6 dark (tokens.css).
    const light = { border: 'rgb(84, 89, 95)', transparent: true };
    const dark = { border: 'rgb(169, 175, 182)', transparent: false };

    // The app theme wins over the OS setting, for the tokens and for `dark:` alike.
    expect(await styles('dark', 'Light')).toEqual(light);
    expect(await styles('light', 'Dark')).toEqual(dark);
    // "System" follows the OS.
    expect(await styles('dark', 'System')).toEqual(dark);
    expect(await styles('light', 'System')).toEqual(light);
  });

  test('deep links work and unknown routes show a not-found screen', async ({ page }) => {
    await page.goto('/data');
    await expect(page.getByRole('heading', { level: 1, name: 'Data and backups' })).toBeVisible();
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  test('the session route validates its search parameters', async ({ page }) => {
    // The manifest shortcut's URL; unknown parameters are ignored.
    for (const path of ['/session?source=shortcut', '/session?utm=x']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: 'Log a set' })).toBeVisible();
    }
    // An invalid value goes to the route error boundary, as with the earlier Zod schema.
    await page.goto('/session?source=elsewhere');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeVisible();
  });

  test('has no serious accessibility violations on the main screens', async ({ page }) => {
    for (const path of ['/', '/session', '/settings', '/data']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      );
      expect(serious.map((violation) => `${path}: ${violation.id}`)).toEqual([]);
    }
  });
});
