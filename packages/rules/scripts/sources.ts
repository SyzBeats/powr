import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { buildSourceRegistry, type SourceFile, type SourceRegistry } from '../src/sources';

/**
 * `@powr/rules/sources/node`: loads the source registry from disk, for the rules build and for
 * build-time tools such as the content build. Node only; it runs under Vitest, because the
 * workspace packages use extensionless imports that plain `node` cannot resolve.
 */

/** packages/rules/data/sources: one YAML file per owner or topic (see its README). */
export const SOURCES_DIR = fileURLToPath(new URL('../data/sources/', import.meta.url));

/**
 * Reads, parses and validates every `*.yaml` file in `dir` (default: the shipped registry), in
 * file-name order. YAML errors and stray files become issues instead of exceptions.
 */
export function loadSourceRegistry(dir: string = SOURCES_DIR): SourceRegistry {
  const files: SourceFile[] = [];
  const issues: string[] = [];
  for (const name of readdirSync(dir).toSorted()) {
    if (name === 'README.md') continue;
    if (!name.endsWith('.yaml')) {
      issues.push(`${name}: only *.yaml files and README.md belong in the source registry`);
      continue;
    }
    try {
      files.push({ file: name, data: parse(readFileSync(join(dir, name), 'utf8')) });
    } catch (error) {
      issues.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const registry = buildSourceRegistry(files);
  return { sources: registry.sources, issues: [...issues, ...registry.issues] };
}
