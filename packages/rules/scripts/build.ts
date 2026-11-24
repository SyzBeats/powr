import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

import { compileRules, type CompiledRules, type RuleFile } from '../src/compile';
import { RULES_VERSION, rulesStamp, type ParamDef } from '../src/index';
import { SOURCES_DIR, loadSourceRegistry } from './sources';

/**
 * The rules build (technical concept §8.6.5): validates the parameter tables in data/*.yaml and
 * the source registry, then compiles a versioned, hashed generated/rules.json and reports every
 * `verified: false` row. Run it with `pnpm --filter @powr/rules build`; the same checks run under
 * Vitest (scripts/build.test.ts) on every `pnpm test`.
 */

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
/**
 * The compiled registry, committed like content.json (technical concept §8.12) so the app, the
 * tests and the type check import it without a build step; `build.test.ts` fails when it is stale.
 */
export const GENERATED_FILE = fileURLToPath(new URL('../generated/rules.json', import.meta.url));

/** The committed file's text: pretty JSON with a final newline. */
export function generatedText(compiled: CompiledRules): string {
  return `${JSON.stringify(compiled, null, 2)}\n`;
}

/** Reads and parses every data/*.yaml file in name order; YAML errors become issues. */
export function loadRuleFiles(dir: string = DATA_DIR): { files: RuleFile[]; issues: string[] } {
  const files: RuleFile[] = [];
  const issues: string[] = [];
  for (const name of readdirSync(dir).toSorted()) {
    if (statSync(join(dir, name)).isDirectory()) continue;
    if (!name.endsWith('.yaml')) {
      issues.push(`${name}: only *.yaml parameter tables belong in data/`);
      continue;
    }
    try {
      files.push({ file: name, data: parse(readFileSync(join(dir, name), 'utf8')) });
    } catch (error) {
      issues.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { files, issues };
}

export interface BuildResult {
  /** Null when any check failed. */
  readonly compiled: CompiledRules | null;
  readonly issues: readonly string[];
}

export function buildRules(
  dataDir: string = DATA_DIR,
  sourcesDir: string = SOURCES_DIR,
): BuildResult {
  const registry = loadSourceRegistry(sourcesDir);
  const loaded = loadRuleFiles(dataDir);
  const result = compileRules(loaded.files, registry.sources);
  const issues = [...registry.issues, ...loaded.issues, ...result.issues];
  if (issues.length > 0) return { compiled: null, issues };
  return {
    compiled: {
      format: 1,
      version: RULES_VERSION,
      hash: hashRules(RULES_VERSION, result.params),
      params: result.params,
    },
    issues,
  };
}

/** SHA-256 of the canonical JSON of the version and the rows: independent of YAML layout. */
export function hashRules(version: string, params: readonly ParamDef[]): string {
  return createHash('sha256').update(canonicalJson({ version, params })).digest('hex');
}

/** JSON with object keys sorted at every level, so equal data always serialises the same. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/** Markdown list of the rows shipped as preliminary values (§8.6.5: printed on every build). */
export function unverifiedReport(compiled: CompiledRules): string {
  const rows = compiled.params.filter((def) => !def.verified);
  return [
    `${rows.length} of ${compiled.params.length} parameters are verified: false (preliminary values):`,
    ...rows.map((def) => `- ${def.id} [${def.evidence.join(', ')}] ${def.ebRef}`),
  ].join('\n');
}

/**
 * Registry diff report (§8.6.5 check 6): added, removed and changed parameters with old and new
 * values and evidence tags, as markdown for the CI run and the release notes.
 */
export function diffRules(previous: CompiledRules, next: CompiledRules): string {
  const before = new Map(previous.params.map((def) => [def.id, def]));
  const after = new Map(next.params.map((def) => [def.id, def]));
  const lines = [`# Rules registry diff: ${rulesStamp(previous)} → ${rulesStamp(next)}`, ''];
  for (const [id, def] of after) {
    const old = before.get(id);
    if (!old) lines.push(`- Added ${id}: ${show(def)}`);
    else if (canonicalJson(old) !== canonicalJson(def)) {
      lines.push(
        `- Changed ${id}: ${show(old)} → ${show(def)}${old.verified !== def.verified ? ` (verified ${old.verified} → ${def.verified})` : ''}`,
      );
    }
  }
  for (const [id, def] of before) if (!after.has(id)) lines.push(`- Removed ${id}: ${show(def)}`);
  if (lines.length === 2) lines.push('No parameter changed.');
  return lines.join('\n');
}

function show(def: ParamDef): string {
  return `\`${canonicalJson(def.value)}\` [${def.evidence.join(', ')}]`;
}

/**
 * Reads an older `rules.json` for the diff report. Unlike `parseCompiledRules` (the app's
 * check of the current file), it does not require today's parameter set or value schemas: an
 * older registry lacks the parameters added since (they are listed as added) and may hold values
 * in an older shape. Only what the report prints is checked. Throws on anything else.
 */
export function parsePreviousRules(json: unknown): CompiledRules {
  const file = json as Partial<Record<keyof CompiledRules, unknown>> | null;
  if (
    file === null ||
    typeof file !== 'object' ||
    file.format !== 1 ||
    typeof file.version !== 'string' ||
    typeof file.hash !== 'string' ||
    !Array.isArray(file.params)
  ) {
    throw new Error('not a compiled rules.json (format 1)');
  }
  for (const [index, def] of (file.params as unknown[]).entries()) {
    const row = def as Partial<Record<keyof ParamDef, unknown>> | null;
    if (
      row === null ||
      typeof row !== 'object' ||
      typeof row.id !== 'string' ||
      !('value' in row) ||
      !Array.isArray(row.evidence) ||
      typeof row.verified !== 'boolean'
    ) {
      throw new Error(`params[${index}] is not a parameter row`);
    }
  }
  return file as unknown as CompiledRules;
}

function main(args: readonly string[]): number {
  const { compiled, issues } = buildRules();
  // Read the older file first: `--diff generated/rules.json` names the file this build rewrites.
  const diffIndex = args.indexOf('--diff');
  const previousFile = diffIndex === -1 ? undefined : args[diffIndex + 1];
  const previous =
    previousFile !== undefined && existsSync(previousFile)
      ? parsePreviousRules(JSON.parse(readFileSync(previousFile, 'utf8')))
      : null;
  if (!compiled) {
    process.stderr.write(
      `Rules build failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}\n`,
    );
    return 1;
  }
  mkdirSync(dirname(GENERATED_FILE), { recursive: true });
  writeFileSync(GENERATED_FILE, generatedText(compiled));
  process.stdout.write(
    `Wrote ${GENERATED_FILE} (${rulesStamp(compiled)}, ${compiled.params.length} parameters)\n`,
  );
  process.stdout.write(`${unverifiedReport(compiled)}\n`);
  if (previous) process.stdout.write(`\n${diffRules(previous, compiled)}\n`);
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
