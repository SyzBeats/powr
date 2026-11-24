import { expect, test, waitForOfflineReady } from './fixtures';

test.describe('offline (WP0.4, PWA-03)', () => {
  test('after the service worker installs, the app reloads and works offline', async ({
    page,
    context,
    server,
  }) => {
    await page.goto('/');
    await waitForOfflineReady(page);

    // Airplane mode, and (with the local test server) a dead server: everything must come
    // from the precache.
    await context.setOffline(true);
    await server?.close();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();

    // Deep links and lazily loaded route chunks work offline too (PWA-12).
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Train' })
      .click();
    // The exercise library is a lazy chunk (TD-17), precached like every other chunk.
    await page.getByRole('radio', { name: 'Seated leg curl' }).check();
    await page.getByRole('button', { name: 'Confirm set' }).click();
    await expect(page.getByTestId('log-status')).toContainText('Saved');
    await expect(page.getByTestId('session-sets')).toContainText('Seated leg curl');
  });

  test('serves a manifest that meets the installability basics (PWA-01)', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await request.get(href ?? '/manifest.webmanifest');
    expect(response.headers()['content-type']).toContain('application/manifest+json');
    const manifest = (await response.json()) as Record<string, unknown> & {
      icons: { sizes: string; purpose: string; src: string }[];
    };
    expect(manifest).toMatchObject({
      name: 'POWR',
      short_name: 'POWR',
      display: 'standalone',
      start_url: '/',
      scope: '/',
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    );
    for (const icon of manifest.icons) {
      const image = await request.get(icon.src);
      expect(image.headers()['content-type']).toBe('image/png');
    }
  });
});
