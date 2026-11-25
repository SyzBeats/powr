import { fileURLToPath } from 'node:url';

import { playwright } from '@vitest/browser-playwright';
import { defineProject, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

// `pnpm test` runs from the repository root; Lingui's macro looks for its config from the
// working directory unless told where it is.
process.env['LINGUI_CONFIG'] ??= fileURLToPath(new URL('lingui.config.ts', import.meta.url));

/**
 * Component tests (TD-11, §8.20): Vitest browser mode in real Chromium with the app's own Vite
 * plugins (Lingui, React Compiler, Tailwind), a phone-sized viewport and a real IndexedDB.
 */
export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: 'components',
      include: ['test/**/*.test.tsx'],
      setupFiles: ['./test/setup.ts'],
      // Browser tests (charts, the body-map pixel scan, real-time timers) share the CPU with the
      // unit project when `pnpm test` runs both; 2–5 s in isolation, they exceeded the 15 s
      // default under that load (and CI runners have fewer cores). 30 s keeps them meaningful.
      testTimeout: 30_000,
      // One test file at a time: in parallel tabs, real-time tests (timers, the lead-in, form
      // flows with live queries) raced each other for the CPU and a different one flaked each run.
      fileParallelism: false,
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        viewport: { width: 360, height: 780 },
        instances: [{ browser: 'chromium' }],
      },
    },
  }),
);
