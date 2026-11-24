import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { licenceFromManifest } from './policy.ts';

export interface PackageRef {
  readonly name: string;
  readonly version: string;
  readonly dir: string;
}

const manifestCache = new Map<string, PackageRef | null>();

/**
 * Maps a bundled module ID to the package that ships it, by walking up to the nearest
 * package.json that has a name and version (nested `{"type":"module"}` manifests are skipped).
 * Returns null for virtual modules and files outside any package.
 */
export function packageOfModule(moduleId: string): PackageRef | null {
  if (moduleId.startsWith('\0') || !moduleId.startsWith('/')) return null;
  let dir = dirname(moduleId.split('?')[0] ?? moduleId);
  for (;;) {
    const cached = manifestCache.get(dir);
    if (cached !== undefined) return cached;
    const manifestPath = join(dir, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (manifest.name && manifest.version) {
        const ref = { name: manifest.name, version: manifest.version, dir };
        manifestCache.set(dir, ref);
        return ref;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface LicenceDetails {
  readonly licence: string | null;
  readonly licenceText: string | null;
  readonly noticeText: string | null;
  readonly copyright: readonly string[];
}

const LICENCE_FILE = /^(licen[cs]e|copying)(\..*)?$/i;
const NOTICE_FILE = /^notice(\..*)?$/i;

/** Reads the SPDX declaration, licence and NOTICE texts, and copyright lines of a package. */
export function readLicenceDetails(dir: string): LicenceDetails {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const files = readdirSync(dir);
  const read = (pattern: RegExp) => {
    const file = files.find((name) => pattern.test(name));
    return file ? readFileSync(join(dir, file), 'utf8') : null;
  };
  const licenceText = read(LICENCE_FILE);
  const copyright = (licenceText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(\(c\)|copyright\b|©)/i.test(line));
  return {
    licence: licenceFromManifest(manifest),
    licenceText,
    noticeText: read(NOTICE_FILE),
    copyright,
  };
}
