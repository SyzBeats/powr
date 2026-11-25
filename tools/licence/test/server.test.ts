import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatFailures, readServerInventory, runGate } from '../src/inventory.ts';
import { evaluate, evaluateServer, loadPolicy, type LicencePolicy } from '../src/policy.ts';

/*
 * Licence review L-2 and L-4 (M6c, product owner 2026-11-25): the programs the publisher runs on
 * its server are in the inventory as `kind: server`, never distributed; and Python-2.0 is off
 * the allowlist.
 */
const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const realPolicy = loadPolicy(repo('licence-policy.yaml'));

const policy: LicencePolicy = {
  allowed: ['MIT'],
  denied: ['GPL-*', 'AGPL-*'],
  devOnlyAllowed: [],
  deniedPackages: [],
  exceptions: [],
  serverDenied: ['AGPL-*', 'SSPL-*', 'Commons-Clause'],
};
const program = (licence: string | null) => ({ name: 'server-thing', version: '1.0', licence });

describe('server-side programs (L-2)', () => {
  it('allows copyleft on the server, where nothing is distributed', () => {
    expect(evaluateServer(program('GPL-2.0-only'), policy)).toEqual({
      status: 'allowed',
      chosen: 'GPL-2.0-only',
    });
    // Declared licences need not be SPDX: Alpine's wording is recorded as it is.
    expect(evaluateServer(program('2-clause BSD-like license'), policy)).toMatchObject({
      status: 'allowed',
    });
    // The same licence on a distributed component stays denied.
    expect(evaluate({ ...program('GPL-2.0-only'), distributed: true }, policy).status).toBe(
      'denied',
    );
  });

  it('denies network-use and source-available licences, and a missing licence', () => {
    expect(evaluateServer(program('AGPL-3.0-only'), policy)).toMatchObject({
      status: 'denied',
      reason: expect.stringContaining('AGPL-3.0-only'),
    });
    expect(evaluateServer(program('(MIT AND Commons-Clause)'), policy).status).toBe('denied');
    expect(evaluateServer(program('SSPL-1.0 OR MIT'), policy).status).toBe('denied');
    expect(evaluateServer(program(null), policy).status).toBe('unknown');
    expect(evaluateServer(program('  '), policy).status).toBe('unknown');
  });

  it('records server programs as kind "server", not distributed, and names them in failures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'powr-server-'));
    const file = join(dir, 'server-inventory.yaml');
    writeFileSync(
      file,
      [
        'server:',
        '  - { name: proxy, version: "3.7", licence: MIT }',
        'image:',
        '  packages:',
        '    - { name: busybox, version: 1.37.0-r31, licence: GPL-2.0-only }',
        '    - { name: dashboard, version: "2.0", licence: AGPL-3.0-only }',
      ].join('\n'),
    );
    const result = runGate({ policy, bundled: [], serverInventoryFile: file });
    expect(result.entries.map((entry) => [entry.name, entry.kind, entry.distributed])).toEqual([
      ['proxy', 'server', false],
      ['busybox', 'server', false],
      ['dashboard', 'server', false],
    ]);
    expect(result.attributions).toEqual([]);
    expect(formatFailures(result.failures)).toContain('dashboard@2.0 (server): AGPL-3.0-only');
  });

  it('the real server inventory passes the real policy: Coolify, Traefik and the image', () => {
    const programs = readServerInventory(repo('deploy/server-inventory.yaml'));
    const names = programs.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining(['coolify', 'traefik', 'nginx', 'busybox']));
    expect(programs.length).toBeGreaterThan(50);
    expect(programs.filter((entry) => !entry.licence?.trim())).toEqual([]);
    for (const entry of programs) {
      expect(evaluateServer({ ...entry, version: entry.version ?? '-' }, realPolicy)).toMatchObject(
        { status: 'allowed' },
      );
    }
  });
});

describe('the allowlist (L-4)', () => {
  it('no longer allows Python-2.0, which no component used', () => {
    expect(realPolicy.allowed).not.toContain('Python-2.0');
    expect(
      evaluate({ name: 'py', version: '1', licence: 'Python-2.0', distributed: true }, realPolicy)
        .status,
    ).toBe('unapproved');
  });
});
