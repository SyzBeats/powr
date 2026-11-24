import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const FIXTURES = {
  gpl: fileURLToPath(new URL('../fixtures/gpl-widget/index.js', import.meta.url)),
  'mit-or-gpl': fileURLToPath(new URL('../fixtures/dual-licensed/index.js', import.meta.url)),
} as const;

type LicenceFixture = keyof typeof FIXTURES;

/**
 * Test-only: pulls a fixture package into the app bundle, to prove the gate fails on a
 * GPL dependency (QS-11) and accepts a dual licence with a permissive option.
 * Enabled with POWR_LICENCE_FIXTURE=gpl | mit-or-gpl; never set in normal builds.
 */
export function licenceFixturePlugin(fixture: string | undefined, entry: string): Plugin | null {
  if (!fixture) return null;
  if (!(fixture in FIXTURES)) throw new Error(`Unknown licence fixture "${fixture}"`);
  const file = FIXTURES[fixture as LicenceFixture];
  return {
    name: 'powr-licence-fixture',
    apply: 'build',
    transform(code, id) {
      if (id !== entry) return null;
      return `import ${JSON.stringify(file)};\n${code}`;
    },
  };
}
