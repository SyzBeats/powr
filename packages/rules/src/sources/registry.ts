import type { SourceId } from '@powr/domain';

import { sourceDefSchema, type SourceDef } from './schema';

/** One parsed file of the registry directory. */
export interface SourceFile {
  /** File name used in issue messages, e.g. "excluded.yaml". */
  readonly file: string;
  /** The parsed YAML document: a list of source entries. */
  readonly data: unknown;
}

export interface SourceRegistry {
  /** Every valid entry by ID. On a duplicate ID the first definition is kept. */
  readonly sources: ReadonlyMap<SourceId, SourceDef>;
  /** One line per problem, naming the file and entry. The registry is valid when this is empty. */
  readonly issues: readonly string[];
}

/**
 * Merges and validates the registry files: every entry matches the schema (required fields,
 * ID format, known tag, a reason on excluded entries), and every ID is unique across all files.
 * Pure: the Node loader (`@powr/rules/sources/node`) reads and parses the files.
 */
export function buildSourceRegistry(files: readonly SourceFile[]): SourceRegistry {
  const sources = new Map<SourceId, SourceDef>();
  const definedIn = new Map<SourceId, string>();
  const issues: string[] = [];

  for (const { file, data } of files) {
    if (!Array.isArray(data)) {
      issues.push(`${file}: expected a list of sources`);
      continue;
    }
    data.forEach((entry: unknown, index) => {
      const where = `${file} entry ${index + 1}${describe(entry)}`;
      const parsed = sourceDefSchema.safeParse(entry);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
          issues.push(`${where}: ${field}${issue.message}`);
        }
        return;
      }
      const source = parsed.data;
      const first = definedIn.get(source.id);
      if (first !== undefined) {
        issues.push(`${where}: duplicate ID, already defined in ${first}`);
        return;
      }
      definedIn.set(source.id, file);
      sources.set(source.id, source);
    });
  }
  return { sources, issues };
}

/** A citation of a source, e.g. by a rules parameter or a muscle credit. */
export interface SourceRef {
  readonly sourceId: string;
  /** Where the citation is, for the issue message, e.g. "volume.yaml volume.hypertrophy.band". */
  readonly usedBy: string;
}

/**
 * Every cited source must exist and must not be excluded (technical concept §8.6.5 check 2,
 * §8.12 content lint). Returns one issue per bad citation.
 */
export function checkSourceRefs(
  sources: ReadonlyMap<SourceId, SourceDef>,
  refs: readonly SourceRef[],
): string[] {
  return refs.flatMap(({ sourceId, usedBy }) => {
    const source = sources.get(sourceId as SourceId);
    if (!source) return [`${usedBy}: unknown source ${sourceId}`];
    if (source.status === 'excluded') {
      return [`${usedBy}: cites excluded source ${sourceId} (${source.reason ?? 'no reason'})`];
    }
    return [];
  });
}

function describe(entry: unknown): string {
  const id =
    typeof entry === 'object' && entry !== null && 'id' in entry ? String(entry.id) : undefined;
  return id === undefined ? '' : ` (${id})`;
}
