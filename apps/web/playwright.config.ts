import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the production build with the service worker (§8.20), served with the production
 * headers by e2e/static-server.ts. Chromium with Android-like emulation, 360 × 780 at DPR 3.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'],
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
    // One time zone everywhere: without it the browser takes the host's (Europe/Zurich on the
    // development machines, UTC on GitHub's runners), and tests that turn local times into UTC
    // (the calendar export's DTSTART) pass on one and fail on the other.
    timezoneId: 'Europe/Zurich',
  },
  projects: [{ name: 'chromium-android', use: { browserName: 'chromium' } }],
});
