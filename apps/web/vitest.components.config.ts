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
