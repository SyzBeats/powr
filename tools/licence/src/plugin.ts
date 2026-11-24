import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Plugin } from 'vite';

import { formatFailures, readBundledPackages, runGate, writeBundleReport } from './inventory.ts';
import { packageOfModule, type PackageRef } from './packages.ts';
import { loadPolicy } from './policy.ts';

export interface LicenceCollectorOptions {
  /** Name of this build, e.g. "app" or "sw". */
  readonly label: string;
  /** Where bundle reports are written (outside dist). */
  readonly reportDir: string;
  /**
   * Set on the last build (the service worker): evaluates all reports, writes
   * `attributions.json` into dist before the precache manifest is built, and fails the build
   * on any unknown, denied or unapproved licence.
   */
  readonly finalize?: {
    readonly distDir: string;
    readonly policyFile: string;
    readonly assetsInventoryFile: string;
  };
}

/**
 * Collects the packages that actually end up in the emitted chunks (ADR-0018), not an
 * over-approximation from package.json.
 */
export function licenceCollector(options: LicenceCollectorOptions): Plugin {
  return {
    name: `powr-licence-collector:${options.label}`,
    apply: 'build',
    generateBundle(_outputOptions, bundle) {
      const packages = new Map<string, PackageRef>();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const moduleId of output.moduleIds) {
          const pkg = packageOfModule(moduleId);
          if (pkg) packages.set(`${pkg.name}@${pkg.version}`, pkg);
        }
      }
      writeBundleReport(options.reportDir, {
        label: options.label,
        packages: [...packages.values()],
      });
    },
    writeBundle() {
      if (!options.finalize) return;
      const result = runGate({
        policy: loadPolicy(options.finalize.policyFile),
        bundled: readBundledPackages(options.reportDir),
        assetsInventoryFile: options.finalize.assetsInventoryFile,
      });
      writeFileSync(
        join(options.finalize.distDir, 'attributions.json'),
        JSON.stringify(result.attributions),
      );
      writeFileSync(
        join(options.reportDir, 'licence-inventory.distributed.json'),
        JSON.stringify(result.entries, null, 2),
      );
      if (result.failures.length > 0) {
        this.error(
          `Licence gate failed (licence-policy.yaml):\n${formatFailures(result.failures)}`,
        );
      }
    },
  };
}
