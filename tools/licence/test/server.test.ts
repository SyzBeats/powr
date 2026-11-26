import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkImagePin, formatFailures, readServerInventory, runGate } from '../src/inventory.ts';
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

/** A server inventory that lists only the image's reference and digest. */
function inventory(reference: string, pinned: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'powr-pin-')), 'server-inventory.yaml');
  writeFileSync(file, `image:\n  reference: ${reference}\n  digest: ${pinned}\n  packages: []\n`);
  return file;
}

describe('the pinned base image (M6d, runbook §6.1)', () => {
  const digest = `sha256:${'ab'.repeat(32)}`;

  it('passes when the Dockerfile and the inventory name the same digest', () => {
    expect(
      checkImagePin(`FROM nginx:1.30-alpine@${digest}\n`, inventory('nginx:1.30-alpine', digest)),
    ).toBeNull();
  });

  it('fails on a tag without a digest, and on a digest the inventory does not list', () => {
    expect(
      checkImagePin('FROM nginx:1.30-alpine\n', inventory('nginx:1.30-alpine', digest)),
    ).toContain('without a digest');
    const other = `sha256:${'cd'.repeat(32)}`;
    expect(
      checkImagePin(`FROM nginx:1.30-alpine@${other}\n`, inventory('nginx:1.30-alpine', digest)),
    ).toContain('regenerate the inventory');
    expect(
      checkImagePin(`FROM nginx:1.31-alpine@${digest}\n`, inventory('nginx:1.30-alpine', digest)),
    ).toContain('regenerate the inventory');
  });

  it('the real Dockerfile is pinned to the digest of the real inventory', () => {
    const dockerfile = readFileSync(repo('deploy/Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/^FROM nginx:1\.30-alpine@sha256:[0-9a-f]{64}$/m);
    expect(checkImagePin(dockerfile, repo('deploy/server-inventory.yaml'))).toBeNull();
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
