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
/** Folders in which a package keeps the licences of code it embeds (ECharts: `licenses/`). */
const SUBCOMPONENT_DIR = /^licen[cs]es$/i;

/** A line that starts like a copyright notice: "Copyright", "(c)" or "©". */
const NOTICE_START = /^(?:copyright\b|\(c\)|©)/i;
/**
 * After that word and an optional symbol, a notice names a year or a holder (a capital letter).
 * Case-sensitive on purpose: "copyright license to reproduce …" is licence text.
 */
const NOTICE_REST = /^[\s:]*(?:\([cC]\)|©)?[\s,:]*(?:\d{4}|\p{Lu})/u;
/**
 * Licence-text phrases that begin with "copyright" or "(c)" but are not a notice (L-1): Apache's
 * "(c) You must retain …", "copyright license to reproduce …", MIT's "COPYRIGHT HOLDERS BE LIABLE",
 * ISC's "copyright notice and this permission notice appear …".
 */
const BOILERPLATE =
  /\b(?:licen[cs]e[ds]?|notices?|holders?|owners?|permission|you must|retain|statement)\b/i;
/** Template lines, e.g. Apache's "Copyright [yyyy] [name of copyright owner]". */
const TEMPLATE = /[[{<]\s*(?:yyyy|year|name)\b/i;

/**
 * The copyright notices in a licence or NOTICE text: lines that start like a notice and name a
 * year or a holder, without licence boilerplate and template lines (licence review L-1).
 */
export function copyrightLines(text: string | null): string[] {
  const lines = (text ?? '').split('\n').map((line) => line.trim());
  return lines.filter(
    (line) =>
      NOTICE_START.test(line) &&
      NOTICE_REST.test(line.replace(/^copyright\b/i, '')) &&
      !BOILERPLATE.test(line) &&
      !TEMPLATE.test(line),
  );
}

/**
 * Reads the SPDX declaration, licence and NOTICE texts, and copyright lines of a package. The
 * copyright lines come from the licence file; where it has none (an Apache-2.0 licence file is
 * often the bare licence text), from the NOTICE file. Licences of embedded code in a `licenses/`
 * folder (ECharts embeds parts of d3, BSD-3-Clause) are appended to the licence text, and their
 * notices to the copyright lines, because those licences ask for their notice to travel with the
 * binary form too.
 */
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
  const noticeText = read(NOTICE_FILE);
  const own = copyrightLines(licenceText);
  const subcomponents = readSubcomponentLicences(dir, files);
  const copyright = [
    ...(own.length > 0 ? own : copyrightLines(noticeText)),
    ...subcomponents.flatMap((entry) => copyrightLines(entry.text)),
  ];
  const fullText =
    subcomponents.length === 0
      ? licenceText
      : [
          licenceText ?? '',
          ...subcomponents.map((entry) => `${SEPARATOR}\n${entry.path}\n\n${entry.text}`),
        ].join('\n');
  return {
    licence: licenceFromManifest(manifest),
    licenceText: fullText,
    noticeText,
    copyright: [...new Set(copyright)],
  };
}

const SEPARATOR = '-'.repeat(72);

function readSubcomponentLicences(
  dir: string,
  files: readonly string[],
): { readonly path: string; readonly text: string }[] {
  const folder = files.find((name) => SUBCOMPONENT_DIR.test(name));
  if (!folder) return [];
  return readdirSync(join(dir, folder), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .toSorted()
    .map((name) => ({
      path: `${folder}/${name}`,
      text: readFileSync(join(dir, folder, name), 'utf8'),
    }));
}
