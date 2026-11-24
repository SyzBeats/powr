import { existsSync, readFileSync } from 'node:fs';

import type { ContentBundle } from '@powr/content';
import { loadSourceRegistry } from '@powr/rules/sources/node';

import { compileContent } from './compile.ts';
import { contentCoverage } from './coverage.ts';
import { checkIdLock, nextIdLock, publishedIds } from './ids.ts';
import { contentAssets, withContentAssets } from './inventory.ts';
import { PATHS, readContentSources } from './load.ts';

export interface OutputFile {
  readonly path: string;
  readonly contents: string;
}

export interface BuildResult {
  /** Present only when there are no issues. */
  readonly bundle?: ContentBundle;
  readonly issues: readonly string[];
  /** What the build writes: content.json, ids.lock.json and assets-inventory.yaml. */
  readonly files: readonly OutputFile[];
  /** A short human-readable summary: counts and coverage gaps. */
  readonly summary: readonly string[];
}

/**
 * Runs the whole pipeline in memory (§8.12): read, validate, lint, check sources and the ID
 * lock, compile. Writing is the CLI's job; tests call this to check that the committed outputs
 * are current.
 */
export function buildContent(paths: typeof PATHS = PATHS): BuildResult {
  const read = readContentSources(paths.data);
  const registry = loadSourceRegistry();
  const pending = [...read.issues, ...registry.issues.map((issue) => `source registry: ${issue}`)];
  const { version } = JSON.parse(readFileSync(paths.contentPackage, 'utf8')) as { version: string };
  const compiled = compileContent(read.sources, { version, sources: registry.sources });
  const issues = [...pending, ...compiled.issues];
  const bundle = compiled.bundle;
  if (!bundle || issues.length > 0) return { issues, files: [], summary: [] };

  const locked = existsSync(paths.idLock)
    ? (JSON.parse(readFileSync(paths.idLock, 'utf8')) as string[])
    : [];
  const ids = publishedIds(bundle);
  const lockIssues = checkIdLock(locked, ids);
  if (lockIssues.length > 0) return { issues: lockIssues, files: [], summary: [] };

  const inventory = readFileSync(paths.assetsInventory, 'utf8');
  return {
    bundle,
    issues: [],
    files: [
      { path: paths.bundle, contents: `${JSON.stringify(bundle, null, 2)}\n` },
      { path: paths.idLock, contents: `${JSON.stringify(nextIdLock(locked, ids), null, 2)}\n` },
      {
        path: paths.assetsInventory,
        contents: withContentAssets(inventory, contentAssets(version)),
      },
    ],
    summary: summarize(bundle),
  };
}

function summarize(bundle: ContentBundle): string[] {
  const subRegions = bundle.muscles.flatMap((group) => group.subRegions).length;
  const byPattern = Map.groupBy(bundle.exercises, (exercise) => exercise.pattern);
  const coverage = contentCoverage(bundle);
  const gaps = [...coverage.presets].flatMap(([preset, { groups }]) =>
    [...groups]
      .filter(([group, ids]) => ids.length < 2 && !isOptional(bundle, group))
      .map(([group, ids]) => `${preset} × ${group} (${ids.length})`),
  );
  return [
    `content ${bundle.version}`,
    `muscles: ${bundle.muscles.length} display groups, ${subRegions} sub-regions`,
    `equipment: ${bundle.equipment.length} items, ${bundle.presets.length} presets`,
    `exercises: ${bundle.exercises.length} (${[...byPattern].map(([p, list]) => `${p} ${list.length}`).join(', ')})`,
    `templates: ${bundle.templates.map((template) => template.id).join(', ')}`,
    `preset coverage gaps (< 2 exercises crediting ≥ 0.5): ${gaps.length > 0 ? gaps.join('; ') : 'none'}`,
  ];
}

function isOptional(bundle: ContentBundle, group: string): boolean {
  return bundle.muscles.some((muscle) => muscle.id === group && muscle.optional);
}
