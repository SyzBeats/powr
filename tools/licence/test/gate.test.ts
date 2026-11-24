import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatFailures, runGate } from '../src/inventory.ts';
import { packageOfModule } from '../src/packages.ts';
import type { LicencePolicy } from '../src/policy.ts';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}/index.js`, import.meta.url));

const policy: LicencePolicy = {
  allowed: ['MIT'],
  denied: ['GPL-*'],
  devOnlyAllowed: [],
  deniedPackages: [],
  exceptions: [],
};

describe('licence gate over bundled modules', () => {
  it('maps a bundled module to the package that ships it', () => {
    expect(packageOfModule(fixture('gpl-widget'))).toMatchObject({
      name: 'gpl-widget',
      version: '1.0.0',
    });
    expect(packageOfModule('\0vite/preload-helper')).toBeNull();
  });

  it('fails when a GPL package is bundled and names it (QS-11)', () => {
    const gpl = packageOfModule(fixture('gpl-widget'))!;
    const result = runGate({ policy, bundled: [gpl] });
    expect(result.failures).toHaveLength(1);
    expect(formatFailures(result.failures)).toContain(
      'gpl-widget@1.0.0 (distributed): GPL-3.0-only is denied',
    );
    expect(result.attributions).toEqual([]);
  });

  it('passes a dual-licensed package as MIT and emits its attribution', () => {
    const dual = packageOfModule(fixture('dual-licensed'))!;
    const result = runGate({ policy, bundled: [dual] });
    expect(result.failures).toEqual([]);
    expect(result.attributions).toEqual([
      expect.objectContaining({
        name: 'dual-licensed',
        licence: 'MIT',
        copyright: ['Copyright (c) 2026 Fixture Author'],
      }),
    ]);
  });
});
