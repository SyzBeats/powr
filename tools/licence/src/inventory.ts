import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { readLicenceDetails, type PackageRef } from './packages.ts';
import { evaluate, type LicencePolicy, type Verdict } from './policy.ts';

/** What one build (app or service worker) bundled, written by the Vite plugin. */
export interface BundleReport {
  readonly label: string;
  readonly packages: readonly PackageRef[];
}

export interface InventoryEntry {
  readonly name: string;
  readonly version: string;
  readonly licence: string | null;
  readonly chosenLicence: string | null;
  readonly distributed: boolean;
  readonly kind: 'npm' | 'asset';
  readonly verdict: Verdict['status'];
  readonly reason?: string;
}

/**
 * One entry of `attributions.json`, the data of the in-app "Open-source licences and
 * attributions" screen (LEG-06): every distributed package and, since M5s, every distributed
 * asset of assets-inventory.yaml (own artwork and content, data sources) with its copyright line.
 */
export interface Attribution {
  readonly kind: 'npm' | 'asset';
  readonly name: string;
  readonly version: string;
  readonly licence: string;
  readonly copyright: readonly string[];
  readonly licenceText: string | null;
  readonly noticeText: string | null;
}

export interface GateResult {
  readonly entries: readonly InventoryEntry[];
  readonly attributions: readonly Attribution[];
  readonly failures: readonly InventoryEntry[];
}

export function writeBundleReport(reportDir: string, report: BundleReport): void {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, `bundle-${report.label}.json`), JSON.stringify(report, null, 2));
}

/** Union of all bundle reports, one entry per name@version. Workspace packages are own code. */
export function readBundledPackages(reportDir: string): PackageRef[] {
  if (!existsSync(reportDir)) return [];
  const byKey = new Map<string, PackageRef>();
  for (const file of readdirSync(reportDir).filter((name) => /^bundle-.+\.json$/.test(name))) {
    const report = JSON.parse(readFileSync(join(reportDir, file), 'utf8')) as BundleReport;
    for (const pkg of report.packages) {
      if (!pkg.name.startsWith('@powr/')) byKey.set(`${pkg.name}@${pkg.version}`, pkg);
    }
  }
  return [...byKey.values()].toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

interface AssetEntry {
  name: string;
  version?: string;
  licence: string;
  distributed: boolean;
  copyright?: string;
}

/** Evaluates distributed packages and assets (and optionally build-only packages). */
export function runGate(options: {
  policy: LicencePolicy;
  bundled: readonly PackageRef[];
  assetsInventoryFile?: string;
  buildOnly?: readonly { name: string; version: string; licence: string | null }[];
}): GateResult {
  const entries: InventoryEntry[] = [];
  const attributions: Attribution[] = [];

  for (const pkg of options.bundled) {
    const details = readLicenceDetails(pkg.dir);
    const verdict = evaluate(
      { ...pkg, licence: details.licence, distributed: true },
      options.policy,
    );
    entries.push(toEntry(pkg.name, pkg.version, details.licence, true, 'npm', verdict));
    if (verdict.status === 'allowed') {
      attributions.push({
        kind: 'npm',
        name: pkg.name,
        version: pkg.version,
        licence: verdict.chosen,
        copyright: details.copyright,
        licenceText: details.licenceText,
        noticeText: details.noticeText,
      });
    }
  }

  if (options.assetsInventoryFile && existsSync(options.assetsInventoryFile)) {
    const assets =
      (parseYaml(readFileSync(options.assetsInventoryFile, 'utf8')) as { assets?: AssetEntry[] })
        .assets ?? [];
    for (const asset of assets) {
      const version = asset.version ?? '-';
      const verdict = evaluate(
        { name: asset.name, version, licence: asset.licence, distributed: asset.distributed },
        options.policy,
      );
      entries.push(
        toEntry(asset.name, version, asset.licence, asset.distributed, 'asset', verdict),
      );
      if (asset.distributed && verdict.status === 'allowed') {
        attributions.push({
          kind: 'asset',
          name: asset.name,
          version,
          licence: verdict.chosen,
          copyright: asset.copyright ? [asset.copyright] : [],
          licenceText: null,
          noticeText: null,
        });
      }
    }
  }

  const distributedKeys = new Set(options.bundled.map((pkg) => `${pkg.name}@${pkg.version}`));
  for (const tool of options.buildOnly ?? []) {
    if (distributedKeys.has(`${tool.name}@${tool.version}`)) continue;
    const verdict = evaluate({ ...tool, distributed: false }, options.policy);
    entries.push(toEntry(tool.name, tool.version, tool.licence, false, 'npm', verdict));
  }

  return {
    entries,
    attributions,
    failures: entries.filter((entry) => entry.verdict !== 'allowed'),
  };
}

function toEntry(
  name: string,
  version: string,
  licence: string | null,
  distributed: boolean,
  kind: 'npm' | 'asset',
  verdict: Verdict,
): InventoryEntry {
  return {
    name,
    version,
    licence,
    chosenLicence: verdict.status === 'allowed' ? verdict.chosen : null,
    distributed,
    kind,
    verdict: verdict.status,
    ...(verdict.status === 'allowed' ? {} : { reason: verdict.reason }),
  };
}

export function formatFailures(failures: readonly InventoryEntry[]): string {
  return failures
    .map(
      (entry) =>
        `  ✗ ${entry.name}@${entry.version} (${entry.distributed ? 'distributed' : 'build-only'}): ${entry.reason}`,
    )
    .join('\n');
}
