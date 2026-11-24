import type { SourceId } from '@powr/domain';

import { PARAM_IDS, PARAM_SCHEMAS, isParamId } from './params';
import { paramDefSchema, type ParamDef } from './schema';
import { checkSourceRefs, type SourceDef } from './sources';

/** One parsed parameter table (`data/<topic>.yaml`). */
export interface RuleFile {
  readonly file: string;
  readonly data: unknown;
}

/** The compiled registry, as shipped in `rules.json` (§8.6.5). */
export interface CompiledRules {
  /** Format of this file; bumped when its shape changes. */
  readonly format: 1;
  /** Registry SemVer (RULES_VERSION). */
  readonly version: string;
  /** SHA-256 (hex) of the canonical JSON of `version` and `params`. */
  readonly hash: string;
  /** Every row, sorted by ID. */
  readonly params: readonly ParamDef[];
}

export interface CompileResult {
  readonly params: readonly ParamDef[];
  /** One line per problem; the registry is valid when this is empty. */
  readonly issues: readonly string[];
}

/**
 * Validates and merges the parameter tables (§8.6.5 checks 1–3): every row matches the row schema
 * and its parameter's value schema (value, variant values, range bounds); IDs are unique across
 * files; the set of IDs is exactly the MVP set; every cited source exists and is not excluded; no
 * MVP parameter is blocked until verified. Pure: the Node build reads the files.
 */
export function compileRules(
  files: readonly RuleFile[],
  sources: ReadonlyMap<SourceId, SourceDef>,
): CompileResult {
  const issues: string[] = [];
  const byId = new Map<string, { def: ParamDef; file: string }>();

  for (const { file, data } of files) {
    if (!Array.isArray(data)) {
      issues.push(`${file}: expected a list of parameters`);
      continue;
    }
    data.forEach((row: unknown, index) => {
      const where = `${file} row ${index + 1}${describe(row)}`;
      const parsed = paramDefSchema.safeParse(row);
      if (!parsed.success) {
        issues.push(...parsed.error.issues.map((issue) => `${where}: ${formatIssue(issue)}`));
        return;
      }
      const def = parsed.data;
      const first = byId.get(def.id);
      if (first) {
        issues.push(`${where}: duplicate ID, already defined in ${first.file}`);
        return;
      }
      byId.set(def.id, { def, file });
      issues.push(...checkValues(def, where));
      issues.push(
        ...checkSourceRefs(
          sources,
          def.sources.map((sourceId) => ({ sourceId, usedBy: `${file} ${def.id}` })),
        ),
      );
    });
  }

  for (const id of PARAM_IDS) {
    if (!byId.has(id)) issues.push(`missing parameter ${id} (it has a schema in src/params.ts)`);
  }

  const params = [...byId.values()]
    .map(({ def }) => def)
    .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { params, issues };
}

function checkValues(def: ParamDef, where: string): string[] {
  if (!isParamId(def.id)) {
    return [`${where}: unknown parameter (add its value schema to src/params.ts)`];
  }
  const schema = PARAM_SCHEMAS[def.id];
  const issues: string[] = [];
  const check = (value: unknown, label: string) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      issues.push(
        ...result.error.issues.map((issue) => `${where}: ${label} ${formatIssue(issue)}`),
      );
    }
  };
  check(def.value, 'value');
  def.variants?.forEach((variant, i) => check(variant.value, `variant ${i + 1}`));
  if (def.range?.min !== undefined) check(def.range.min, 'range.min');
  if (def.range?.max !== undefined) check(def.range.max, 'range.max');
  if (def.blockedUntilVerified && !def.verified) {
    issues.push(`${where}: an MVP parameter cannot be blocked until verified (E-5)`);
  }
  return issues;
}

function formatIssue(issue: { readonly path: readonly PropertyKey[]; readonly message: string }) {
  const path = issue.path.map(String).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

function describe(row: unknown): string {
  const id = typeof row === 'object' && row !== null && 'id' in row ? String(row.id) : undefined;
  return id === undefined ? '' : ` (${id})`;
}
