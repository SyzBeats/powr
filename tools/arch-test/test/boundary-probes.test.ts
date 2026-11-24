import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * Writes deliberately forbidden files into the real source tree, runs the real gates on them
 * and removes them again. This proves the configuration blocks what the concept forbids (§5.2).
 */
const root = fileURLToPath(new URL('../../..', import.meta.url));
const created: string[] = [];

/** Writes a probe file, creating (and later removing) only directories that did not exist. */
function probe(relativePath: string, source: string): string {
  const file = join(root, relativePath);
  let dir = dirname(file);
  const missing: string[] = [];
  while (!existsSync(dir)) {
    missing.unshift(dir);
    dir = dirname(dir);
  }
  for (const newDir of missing) mkdirSync(newDir);
  writeFileSync(file, source);
  created.push(file, ...missing.toReversed());
  return relativePath;
}

function lint(file: string) {
  const result = spawnSync(join(root, 'node_modules/.bin/oxlint'), [file], {
    cwd: root,
    encoding: 'utf8',
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

afterEach(() => {
  // Files first, then the directories this test created (innermost first).
  for (const path of created.splice(0)) {
    rmSync(path, { recursive: true, force: true });
    // tsc -b may have emitted declarations for a probe; drop them too.
    const emitted = path.replace(`${root}packages/domain/src`, `${root}.tsbuild/domain/src`);
    if (emitted !== path)
      rmSync(emitted.replace(/\.ts$/, '.d.ts'), { recursive: true, force: true });
  }
});

describe('layer rules (oxlint overrides)', () => {
  it('blocks Dexie and infrastructure imports in features', () => {
    const file = probe(
      'apps/web/src/features/__probe__/probe.ts',
      "import Dexie from 'dexie';\nimport { openPowrDb } from '../../infrastructure/db';\nexport const probe = [Dexie, openPowrDb];\n",
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output).toContain('Features read and write through hooks');
    expect(output).toContain('Features never touch infrastructure');
  });

  it('keeps adapters away from the design system, also through the #ui alias', () => {
    const file = probe(
      'apps/web/src/infrastructure/__probe__/probe.ts',
      "import { cn } from '#ui/cn';\nimport { Button } from '../../ui/button';\nexport const probe = [cn, Button];\n",
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output.match(/Adapters know nothing about the UI/g)).toHaveLength(2);
  });

  it('keeps the design system free of domain packages', () => {
    const file = probe(
      'apps/web/src/ui/__probe__/probe.ts',
      "import { DATA_VERSION } from '@powr/formats';\nexport const probe = DATA_VERSION;\n",
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output).toContain('The design system is domain-free');
  });

  it('keeps the service worker away from app code', () => {
    const file = probe(
      'apps/web/src/sw/__probe__.ts',
      "import { logSet } from '@powr/application';\nimport { cn } from '../ui/cn';\nimport { Button } from '#ui/button';\nimport { openRuntimeDb } from '../infrastructure/runtime-db';\nexport const probe = [logSet, cn, Button, openRuntimeDb];\n",
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output.match(/The service worker stays tiny/g)).toHaveLength(2);
    expect(output).toContain('may only import src/infrastructure/runtime-db');
    expect(output.match(/may only import/g)).toHaveLength(1);
  });

  it('keeps the backup code path lazy: only type imports and the one loader (§8.19)', () => {
    const file = probe(
      'apps/web/src/features/__probe__/probe.ts',
      [
        "import { exportBackup } from '@powr/application/backup';",
        "import type { DecodedBackup } from '@powr/application/backup';",
        'export const probe: [typeof exportBackup, DecodedBackup | null] = [exportBackup, null];',
        '',
      ].join('\n'),
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output.match(/The backup code path is lazy-loaded/g)).toHaveLength(1);
  });

  it('routes every Zod import in the app through the JIT-less src/zod module (§7.3)', () => {
    const file = probe(
      'apps/web/src/hooks/__probe__.ts',
      "import { z } from 'zod';\nexport const probe = z;\n",
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output).toContain('Import z from src/zod');
  });

  it('keeps the domain free of frameworks, time and randomness', () => {
    const file = probe(
      'packages/domain/src/__probe__/probe.ts',
      "import { useState } from 'react';\nexport const probe = [useState, Date.now(), Math.random(), performance.now()];\n",
    );
    const { status, output } = lint(file);
    expect(status).not.toBe(0);
    expect(output).toContain('The domain is framework-free');
    expect(output).toContain('Use a seeded PRNG passed in');
    expect(output.match(/Time, IDs and I\/O are passed in/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('package boundaries (pnpm isolation + TypeScript project references)', () => {
  it('fails the type check when the domain imports another workspace package', () => {
    probe(
      'packages/domain/src/__probe_ts__/probe.ts',
      "import { DATA_VERSION } from '@powr/formats';\nexport const probe = DATA_VERSION;\n",
    );
    const result = spawnSync(join(root, 'node_modules/.bin/tsc'), ['-b', 'packages/domain'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("Cannot find module '@powr/formats'");
  }, 30_000);
});

describe('alpha JS-plugin rules report warnings without blocking (OQ-T10)', () => {
  it('warns about strings outside JSX that skip Lingui, without failing the lint', () => {
    const file = probe(
      'apps/web/src/features/__probe__/probe.tsx',
      [
        "const savedMessage = 'Workout saved for later';",
        'export function Probe() {',
        '  return <output>{savedMessage}</output>;',
        '}',
        '',
      ].join('\n'),
    );
    const { status, output } = lint(file);
    expect(output).toMatch(/warning lingui\(no-unlocalized-strings\)/);
    expect(status).toBe(0);
  });

  it('runs the React Compiler rules of eslint-plugin-react-hooks as warnings', () => {
    const file = probe(
      'apps/web/src/features/__probe__/probe.tsx',
      ['export function Probe() {', '  return <output>{Math.random()}</output>;', '}', ''].join(
        '\n',
      ),
    );
    const { output } = lint(file);
    expect(output).toMatch(/warning react-hooks-js\(purity\)/);
  });
});
