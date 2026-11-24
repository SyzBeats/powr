import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const setup = fileURLToPath(new URL('./vitest.setup.ts', import.meta.url));

const packages = ['domain', 'rules', 'content', 'formats', 'application'];

export default defineConfig({
  test: {
    projects: [
      ...packages.map((name) => ({
        test: {
          name,
          root: `packages/${name}`,
          include: ['test/**/*.test.ts'],
          setupFiles: [setup],
        },
      })),
      {
        test: {
          name: 'tools',
          root: 'tools',
          include: ['*/test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          include: ['src/**/*.test.ts'],
          setupFiles: [setup, './vitest.setup.ts'],
        },
      },
    ],
  },
});
