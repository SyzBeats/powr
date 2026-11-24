import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluate, licenceFromManifest, loadPolicy, type LicencePolicy } from '../src/policy.ts';

const policy: LicencePolicy = {
  allowed: ['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', 'CC0-1.0'],
  denied: ['GPL-*', 'AGPL-*', 'LGPL-*', 'MPL-*'],
  devOnlyAllowed: ['MPL-2.0'],
  deniedPackages: [
    { package: 'sentry', reason: 'no Sentry' },
    { package: '@sentry/*', reason: 'no Sentry' },
  ],
  exceptions: [
    {
      package: 'spdx-exceptions',
      version: '2.5.0',
      licence: 'CC-BY-3.0',
      scope: 'build-only',
      reviewer: 'test',
      approval: 'approved by test, 2026-11-24',
      date: '2026-11-24',
      rationale: 'data file used at build time',
    },
  ],
};

const shipped = (licence: string | null, name = 'pkg') => ({
  name,
  version: '1.0.0',
  licence,
  distributed: true,
});

describe('licence policy', () => {
  it('allows permissive licences', () => {
    expect(evaluate(shipped('MIT'), policy)).toEqual({ status: 'allowed', chosen: 'MIT' });
    expect(evaluate(shipped('(MIT AND ISC)'), policy)).toEqual({
      status: 'allowed',
      chosen: 'MIT AND ISC',
    });
  });

  it('denies copyleft licences, including "or later" and LGPL', () => {
    expect(evaluate(shipped('GPL-3.0-only'), policy)).toMatchObject({ status: 'denied' });
    expect(evaluate(shipped('GPL-2.0+'), policy)).toMatchObject({ status: 'denied' });
    expect(evaluate(shipped('LGPL-3.0-or-later'), policy)).toMatchObject({ status: 'denied' });
    expect(evaluate(shipped('AGPL-3.0-only'), policy)).toMatchObject({ status: 'denied' });
    expect(evaluate(shipped('MIT AND GPL-3.0-only'), policy)).toMatchObject({ status: 'denied' });
  });

  it('chooses the permissive option of a dual licence (ADR-0018)', () => {
    expect(evaluate(shipped('MIT OR GPL-3.0-or-later'), policy)).toEqual({
      status: 'allowed',
      chosen: 'MIT',
    });
    expect(evaluate(shipped('GPL-3.0-or-later OR Apache-2.0'), policy)).toEqual({
      status: 'allowed',
      chosen: 'Apache-2.0',
    });
  });

  it('fails on missing, unparseable and unlisted licences', () => {
    expect(evaluate(shipped(null), policy)).toMatchObject({ status: 'unknown' });
    expect(evaluate(shipped('Some custom terms'), policy)).toMatchObject({ status: 'unknown' });
    expect(evaluate(shipped('WTFPL'), policy)).toMatchObject({ status: 'unapproved' });
    expect(evaluate(shipped('MIT WITH Classpath-exception-2.0'), policy)).toMatchObject({
      status: 'unapproved',
    });
  });

  it('allows MPL-2.0 only for components that are never distributed (axe-core)', () => {
    expect(evaluate(shipped('MPL-2.0'), policy)).toMatchObject({ status: 'denied' });
    expect(evaluate({ ...shipped('MPL-2.0'), distributed: false }, policy)).toEqual({
      status: 'allowed',
      chosen: 'MPL-2.0',
    });
  });

  it('applies reviewed exceptions only to the exact version and scope', () => {
    const tool = {
      name: 'spdx-exceptions',
      version: '2.5.0',
      licence: 'CC-BY-3.0',
      distributed: false,
    };
    expect(evaluate(tool, policy)).toMatchObject({ status: 'allowed', via: 'exception' });
    expect(evaluate({ ...tool, version: '2.6.0' }, policy)).toMatchObject({ status: 'unapproved' });
    expect(evaluate({ ...tool, distributed: true }, policy)).toMatchObject({
      status: 'unapproved',
    });
  });

  it('ignores an exception without a recorded product-owner approval', () => {
    const [exception] = policy.exceptions;
    const unapproved = { ...policy, exceptions: [{ ...exception!, approval: ' ' }] };
    const tool = { name: 'spdx-exceptions', version: '2.5.0', licence: 'CC-BY-3.0' };
    expect(evaluate({ ...tool, distributed: false }, unapproved)).toMatchObject({
      status: 'unapproved',
    });
  });

  it('refuses denied packages whatever their licence, scope or exception', () => {
    expect(evaluate(shipped('MIT', '@sentry/node'), policy)).toMatchObject({
      status: 'denied',
      reason: 'package @sentry/node is denied: no Sentry',
    });
    expect(evaluate({ ...shipped('MIT', 'sentry'), distributed: false }, policy)).toMatchObject({
      status: 'denied',
    });
    const excepted: LicencePolicy = {
      ...policy,
      exceptions: [{ ...policy.exceptions[0]!, package: 'sentry', version: '1.0.0' }],
    };
    expect(evaluate({ ...shipped('MIT', 'sentry'), distributed: false }, excepted)).toMatchObject({
      status: 'denied',
    });
    expect(evaluate(shipped('MIT', 'sentinel-logger'), policy)).toMatchObject({
      status: 'allowed',
    });
  });

  it('the real policy refuses every Sentry package (product-owner decision 2026-11-24)', () => {
    const real = loadPolicy(
      fileURLToPath(new URL('../../../licence-policy.yaml', import.meta.url)),
    );
    for (const name of [
      'sentry',
      'sentry-cli-binaries',
      '@sentry/node',
      '@sentry-internal/tracing',
    ]) {
      for (const distributed of [true, false]) {
        expect(evaluate({ ...shipped('MIT', name), distributed }, real)).toMatchObject({
          status: 'denied',
        });
      }
    }
    expect(evaluate(shipped('MIT', 'sentinel-logger'), real)).toMatchObject({ status: 'allowed' });
  });

  it('normalizes legacy package.json licence fields', () => {
    expect(licenceFromManifest({ license: 'MIT' })).toBe('MIT');
    expect(licenceFromManifest({ license: { type: 'ISC' } })).toBe('ISC');
    expect(licenceFromManifest({ licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] })).toBe(
      '(MIT OR Apache-2.0)',
    );
    expect(licenceFromManifest({ license: 'SEE LICENSE IN LICENSE.txt' })).toBeNull();
    expect(licenceFromManifest({ license: 'UNLICENSED' })).toBeNull();
    expect(licenceFromManifest({})).toBeNull();
  });
});
