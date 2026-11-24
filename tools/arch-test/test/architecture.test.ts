import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkDependencyMatrix, findImpureCalls, readWorkspace } from '../src';

const root = fileURLToPath(new URL('../../..', import.meta.url));

describe('internal dependency matrix', () => {
  const workspace = readWorkspace(root);

  it('finds every workspace package', () => {
    expect(workspace.map((pkg) => pkg.name).toSorted()).toEqual([
      '@powr/application',
      '@powr/content',
      '@powr/domain',
      '@powr/formats',
      '@powr/rules',
      '@powr/tools-arch-test',
      '@powr/tools-icons',
      '@powr/tools-licence',
      '@powr/web',
    ]);
  });

  it('allows only inward dependencies, declared in package.json and tsconfig alike', () => {
    expect(checkDependencyMatrix(workspace)).toEqual([]);
  });

  it('reports a forbidden cross-layer dependency', () => {
    const bad = [
      {
        name: '@powr/domain',
        dir: 'packages/domain',
        internalDeps: ['@powr/formats'],
        tsReferences: ['@powr/formats'],
      },
      {
        name: '@powr/formats',
        dir: 'packages/formats',
        internalDeps: ['@powr/domain'],
        tsReferences: [],
      },
    ];
    expect(checkDependencyMatrix(bad)).toEqual([
      { packageName: '@powr/domain', problem: 'must not depend on @powr/formats' },
      { packageName: '@powr/domain', problem: 'must not reference @powr/formats in tsconfig' },
      { packageName: '@powr/formats', problem: 'has no tsconfig reference for @powr/domain' },
    ]);
  });

  it('keeps runtime libraries out of the root manifest (they would leak into every package)', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(manifest.dependencies ?? {}).toEqual({});
    const runtimeLibs = ['react', 'react-dom', 'dexie', 'zod', 'fflate', 'temporal-polyfill'];
    expect(
      Object.keys(manifest.devDependencies).filter((dep) => runtimeLibs.includes(dep)),
    ).toEqual([]);
  });
});

describe('domain purity', () => {
  it('never reads the clock or randomness in packages/domain/src', () => {
    const srcDir = join(root, 'packages/domain/src');
    const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter((file) =>
      file.endsWith('.ts'),
    );
    expect(files.length).toBeGreaterThan(0);
    const problems = files.flatMap((file) =>
      findImpureCalls(relative(root, join(srcDir, file)), readFileSync(join(srcDir, file), 'utf8')),
    );
    expect(problems).toEqual([]);
  });

  it('detects the forbidden calls', () => {
    expect(findImpureCalls('x.ts', 'const id = Math.random();')).toEqual(['x.ts uses Math.random']);
    expect(findImpureCalls('x.ts', 'const t = Date.now(); const d = new Date (0);')).toEqual([
      'x.ts uses Date.now',
      'x.ts uses new Date(',
    ]);
    expect(findImpureCalls('x.ts', 'const updated = lastDate.nowish;')).toEqual([]);
  });
});
