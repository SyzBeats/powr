import type { KnipConfig } from 'knip';

/** Unused files, exports and dependencies (§8.21). Plugins find most entry points themselves. */
const config: KnipConfig = {
  // Types referenced by exported signatures must stay exported for declaration emit.
  ignoreExportsUsedInFile: { interface: true, type: true },
  workspaces: {
    'apps/web': {
      entry: ['src/routes/**/*.tsx', 'scripts/*.ts'],
      project: ['src/**/*.{ts,tsx,css}', 'e2e/**/*.ts', 'scripts/**/*.ts'],
    },
    'packages/*': {
      entry: ['test/**/*.test.ts'],
      project: ['src/**/*.ts', 'test/**/*.ts'],
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
