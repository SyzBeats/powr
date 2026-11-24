import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const repoFile = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

/** Where the pipeline reads and writes (technical concept §5.3, §8.12). */
export const PATHS = {
  /** Authoring sources: muscles.yaml, equipment.yaml, presets.yaml, exercises/, templates/. */
  data: repoFile('packages/content/data'),
  /** The compiled bundle the app imports (`@powr/content/built-in`). */
  bundle: repoFile('packages/content/generated/content.json'),
  /** Every ID ever published; append-only (§8.1, §8.12 step 4). */
  idLock: repoFile('packages/content/ids.lock.json'),
  /** Its `version` is the content SemVer (§7.8). */
  contentPackage: repoFile('packages/content/package.json'),
  /** Non-npm assets for the licence gate (LEG-08); the build owns the powr-content-* entries. */
  assetsInventory: repoFile('assets-inventory.yaml'),
} as const;

/** One parsed YAML file, named by its path relative to the data directory. */
export interface ContentFile {
  readonly file: string;
  readonly data: unknown;
}

export interface ContentSources {
  readonly muscles?: ContentFile;
  readonly equipment?: ContentFile;
  readonly presets?: ContentFile;
  readonly exercises: readonly ContentFile[];
  readonly templates: readonly ContentFile[];
}

const SINGLE_FILES = ['muscles.yaml', 'equipment.yaml', 'presets.yaml'] as const;
const DIRECTORIES = ['exercises', 'templates'] as const;

/**
 * Reads and parses every source file under `dir`, in file-name order. A missing file, a stray
 * file or a YAML error becomes an issue, so one run reports every problem.
 */
export function readContentSources(dir: string = PATHS.data): {
  sources: ContentSources;
  issues: string[];
} {
  const issues: string[] = [];
  const read = (file: string): ContentFile | undefined => {
    try {
      return { file, data: parse(readFileSync(join(dir, file), 'utf8')) };
    } catch (error) {
      issues.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };

  for (const name of readdirSync(dir).toSorted()) {
    const known = (SINGLE_FILES as readonly string[]).includes(name);
    if (!known && !(DIRECTORIES as readonly string[]).includes(name)) {
      issues.push(
        `${name}: not a content source (expected ${[...SINGLE_FILES, ...DIRECTORIES].join(', ')})`,
      );
    }
  }
  const [muscles, equipment, presets] = SINGLE_FILES.map((name) => {
    if (existsSync(join(dir, name))) return read(name);
    issues.push(`${name}: missing`);
    return undefined;
  });
  const [exercises, templates] = DIRECTORIES.map((sub) => {
    if (!existsSync(join(dir, sub))) return [];
    return readdirSync(join(dir, sub))
      .toSorted()
      .flatMap((name) => {
        if (name.endsWith('.yaml')) return read(`${sub}/${name}`) ?? [];
        issues.push(`${sub}/${name}: only *.yaml files belong here`);
        return [];
      });
  });
  return {
    sources: {
      ...(muscles && { muscles }),
      ...(equipment && { equipment }),
      ...(presets && { presets }),
      exercises: exercises ?? [],
      templates: templates ?? [],
    },
    issues,
  };
}
