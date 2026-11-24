import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSourceRegistry } from './sources';

const tempDirs: string[] = [];

function registryDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'powr-sources-'));
  tempDirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

function entry(id: string): string {
  return `- id: ${id}\n  citation: Someone 2020.\n  tag: OBS\n  status: active\n`;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('shipped source registry (data/sources)', () => {
  const { sources, issues } = loadSourceRegistry();

  it('is valid: schema, unique IDs across files, reasons on excluded entries', () => {
    expect(issues).toEqual([]);
    expect(sources.size).toBeGreaterThan(0);
  });

  it('excludes the retracted Barbalho trials and the 2020 EJSS paper (EB §Gaps #23)', () => {
    const excluded = [...sources.values()].filter((source) => source.status === 'excluded');
    expect(excluded.map((source) => source.id).toSorted()).toEqual([
      'src.barbalho2019',
      'src.barbalho2020a',
      'src.barbalho2020b',
    ]);
  });
});

describe('loadSourceRegistry', () => {
  it('reports YAML errors and stray files instead of throwing', () => {
    const dir = registryDir({
      'README.md': '# ignored',
      'broken.yaml': '- id: src.kubo2019\n  citation: [unclosed\n',
      'notes.yml': '[]',
    });
    const { sources, issues } = loadSourceRegistry(dir);
    expect(sources.size).toBe(0);
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatch(/^broken\.yaml: /);
    expect(issues[1]).toBe(
      'notes.yml: only *.yaml files and README.md belong in the source registry',
    );
  });

  it('merges the files in name order', () => {
    const dir = registryDir({ 'b.yaml': entry('src.bravo2020'), 'a.yaml': entry('src.alpha2020') });
    const { sources, issues } = loadSourceRegistry(dir);
    expect(issues).toEqual([]);
    expect([...sources.keys()]).toEqual(['src.alpha2020', 'src.bravo2020']);
  });
});
