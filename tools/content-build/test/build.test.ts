import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildContent } from '../src/build.ts';
import { checkIdLock, nextIdLock } from '../src/ids.ts';
import { contentAssets, contentAssetsIn, withContentAssets } from '../src/inventory.ts';
import { PATHS, readContentSources } from '../src/load.ts';

const root = join(PATHS.data, '../../..');

describe('content build', () => {
  const result = buildContent();

  it('compiles the shipped content without issues', () => {
    expect(result.issues).toEqual([]);
    expect(result.bundle?.version).toMatch(/^\d+\.\d+\.\d+\+sha\.[0-9a-f]{8}$/);
  });

  // Like the Lingui catalog check: the committed outputs must be what the build produces.
  it.each(['packages/content/generated/content.json', 'packages/content/ids.lock.json'])(
    '%s is up to date (run `pnpm content:build` if not)',
    (path) => {
      const expected = result.files.find((file) => relative(root, file.path) === path);
      const stale =
        expected === undefined || readFileSync(expected.path, 'utf8') !== expected.contents;
      expect(stale ? `${path} is stale: run pnpm content:build` : 'current').toBe('current');
    },
  );

  it('keeps the content entries of assets-inventory.yaml current', () => {
    const { version } = JSON.parse(readFileSync(PATHS.contentPackage, 'utf8')) as {
      version: string;
    };
    expect(contentAssetsIn(readFileSync(PATHS.assetsInventory, 'utf8'))).toEqual(
      contentAssets(version),
    );
  });
});

describe('inventory entries', () => {
  it('replaces only the powr-content-* entries and keeps comments', () => {
    const before = [
      '# Assets (LEG-08)',
      'assets:',
      '  - name: powr-app-icons',
      '    licence: LicenseRef-Own-Work',
      '  - name: powr-content-stub',
      '    licence: LicenseRef-Own-Work',
      '',
    ].join('\n');
    const after = withContentAssets(before, contentAssets('9.9.9'));
    expect(after).toContain('# Assets (LEG-08)');
    expect(after).toContain('powr-app-icons');
    expect(after).not.toContain('powr-content-stub');
    expect(contentAssetsIn(after).map((asset) => [asset.name, asset.version])).toEqual([
      ['powr-content-exercises', '9.9.9'],
      ['powr-content-muscle-taxonomy', '9.9.9'],
      ['powr-content-equipment', '9.9.9'],
      ['powr-content-templates', '9.9.9'],
    ]);
    expect(contentAssets('9.9.9').every((asset) => asset.licence === 'LicenseRef-Own-Work')).toBe(
      true,
    );
  });
});

describe('ID lock', () => {
  it('reports a published ID that disappeared and only ever grows', () => {
    expect(checkIdLock(['ex.a', 'ex.b'], ['ex.b', 'ex.c'])).toEqual([
      'ex.a: published in ids.lock.json but gone; deprecate it instead (§8.1)',
    ]);
    expect(nextIdLock(['ex.b', 'ex.a'], ['ex.c', 'ex.b'])).toEqual(['ex.a', 'ex.b', 'ex.c']);
  });

  it('fails the build when a locked ID is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'powr-content-'));
    const lock = join(dir, 'ids.lock.json');
    writeFileSync(lock, JSON.stringify(['ex.retired-without-replacement']));
    const result = buildContent({ ...PATHS, idLock: lock });
    expect(result.issues).toEqual([
      'ex.retired-without-replacement: published in ids.lock.json but gone; deprecate it instead (§8.1)',
    ]);
  });
});

describe('source files', () => {
  it('reports stray files, missing files and YAML errors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'powr-content-'));
    mkdirSync(join(dir, 'exercises'));
    writeFileSync(join(dir, 'notes.txt'), 'hello');
    writeFileSync(join(dir, 'muscles.yaml'), '- id: [unclosed');
    writeFileSync(join(dir, 'exercises', 'squat.yml'), '[]');
    const { issues } = readContentSources(dir);
    expect(issues).toEqual([
      expect.stringMatching(/^notes\.txt: not a content source/),
      expect.stringMatching(/^muscles\.yaml: /),
      'equipment.yaml: missing',
      'presets.yaml: missing',
      'exercises/squat.yml: only *.yaml files belong here',
    ]);
  });
});

describe('startup path of @powr/content', () => {
  // TD-17: the app imports these modules (root entry and the lazy built-in entry); none of them
  // may pull in Zod or the schemas, which belong to the build.
  it.each(['index.ts', 'catalog.ts', 'types.ts', 'built-in.ts'])(
    'src/%s imports no schema code',
    (file) => {
      const source = readFileSync(join(PATHS.data, '../src', file), 'utf8');
      expect(source).not.toMatch(/from '(?:zod|\.\/zod|\.\/schema[^']*)'/);
    },
  );
});
