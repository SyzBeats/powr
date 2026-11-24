import type { KnipConfig } from 'knip';

/** Unused files, exports and dependencies (§8.21). Plugins find most entry points themselves. */
const config: KnipConfig = {
  // Types referenced by exported signatures must stay exported for declaration emit.
  ignoreExportsUsedInFile: { interface: true, type: true },
  workspaces: {
    'apps/web': {
      // Unit tests and the browser-mode component tests (two Vitest projects) are entries too.
      entry: ['src/routes/**/*.tsx', 'scripts/*.ts', 'src/**/*.test.ts', 'test/**/*.test.tsx'],
      project: ['src/**/*.{ts,tsx,css}', 'e2e/**/*.ts', 'scripts/**/*.ts', 'test/**/*.{ts,tsx}'],
    },
    'packages/*': {
      entry: ['test/**/*.test.ts', 'scripts/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts', 'scripts/**/*.ts'],
    },
    'tools/*': {
      entry: [
        'src/index.ts',
        'src/cli.ts',
        'src/demo-gpl.ts',
        'src/generate.ts',
        'test/**/*.test.ts',
      ],
      project: ['src/**/*.ts', 'test/**/*.ts'],
    },
  },
};

export default config;
