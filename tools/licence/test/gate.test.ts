import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
        kind: 'npm',
        name: 'dual-licensed',
        licence: 'MIT',
        copyright: ['Copyright (c) 2026 Fixture Author'],
      }),
    ]);
  });

  it('lists distributed own-work assets in the attributions, never build-only ones (LEG-06, M5s)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'powr-assets-'));
    const file = join(dir, 'assets-inventory.yaml');
    writeFileSync(
      file,
      [
        'assets:',
        '  - name: own-artwork',
        '    version: 1.0.0',
        '    licence: LicenseRef-Own-Work',
        '    distributed: true',
        '    copyright: Original artwork (own work)',
        '  - name: design-sketches',
        '    licence: LicenseRef-Own-Work',
        '    distributed: false',
      ].join('\n'),
    );
    try {
      const result = runGate({
        policy: { ...policy, allowed: ['MIT', 'LicenseRef-Own-Work'] },
        bundled: [],
        assetsInventoryFile: file,
      });
      expect(result.failures).toEqual([]);
      expect(result.attributions).toEqual([
        {
          kind: 'asset',
          name: 'own-artwork',
          version: '1.0.0',
          licence: 'LicenseRef-Own-Work',
          copyright: ['Original artwork (own work)'],
          licenceText: null,
          noticeText: null,
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
