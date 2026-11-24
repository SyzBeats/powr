import { createHash } from 'node:crypto';

import {
  CONTENT_FORMAT,
  type ContentBundle,
  type EquipmentDef,
  type EquipmentPresetDef,
  type MuscleGroupDef,
  type TemplateDef,
} from '@powr/content';
import {
  equipmentDefSchema,
  equipmentPresetDefSchema,
  exerciseDefSchema,
  muscleGroupSchema,
  templateDefSchema,
} from '@powr/content/schema';
import {
  COMPETITION_LIFTS,
  MOVEMENT_PATTERNS,
  TRAINING_STYLES,
  type ExerciseDef,
  type SourceId,
} from '@powr/domain';
import { checkSourceRefs, type SourceDef } from '@powr/rules/sources';

import { lintContent } from './lint.ts';
import type { ContentFile, ContentSources } from './load.ts';

/** Everything a bundle holds except its stamp (format, version, hash). */
export type ContentDraft = Omit<ContentBundle, 'format' | 'version' | 'hash'>;

export interface CompileOptions {
  /** SemVer of @powr/content; the bundle version appends the content hash. */
  readonly version: string;
  /** The source registry (`loadSourceRegistry()` from @powr/rules/sources/node). */
  readonly sources: ReadonlyMap<SourceId, SourceDef>;
}

export interface CompileResult {
  /** Present only when there are no issues. */
  readonly bundle?: ContentBundle;
  readonly issues: readonly string[];
}

/**
 * The content build (technical concept §8.12): schema validation of every entry, then the
 * content lint and the source check (every credit cites an existing, non-excluded registry
 * source), then a deterministic order and the content hash. Lint runs only on schema-valid
 * content, so one bad entry does not cascade into reference errors elsewhere.
 */
export function compileContent(input: ContentSources, options: CompileOptions): CompileResult {
  const parsed = parseContentSources(input);
  if (parsed.issues.length > 0) return { issues: parsed.issues };

  const draft = parsed.draft;
  const issues = [...lintContent(draft), ...checkSourceRefs(options.sources, sourceRefs(draft))];
  if (issues.length > 0) return { issues };

  const ordered = orderDraft(draft);
  const hash = createHash('sha256').update(canonicalJson(ordered)).digest('hex');
  return {
    bundle: {
      format: CONTENT_FORMAT,
      version: `${options.version}+sha.${hash.slice(0, 8)}`,
      hash,
      ...ordered,
    },
    issues: [],
  };
}

/** Validates every entry against its schema and the file layout conventions. */
function parseContentSources(input: ContentSources): {
  draft: ContentDraft;
  issues: string[];
} {
  const issues: string[] = [];
  const list = <T>(file: ContentFile | undefined, schema: Schema<T>): T[] => {
    if (!file) return [];
    if (!Array.isArray(file.data)) {
      issues.push(`${file.file}: expected a list`);
      return [];
    }
    return file.data.flatMap((entry: unknown, index) => {
      const parsed = schema.safeParse(entry);
      if (parsed.success) return [parsed.data];
      issues.push(...describeIssues(`${file.file} entry ${index + 1}${idOf(entry)}`, parsed));
      return [];
    });
  };

  const muscles: MuscleGroupDef[] = list(input.muscles, muscleGroupSchema);
  const equipment: EquipmentDef[] = list(input.equipment, equipmentDefSchema);
  const presets: EquipmentPresetDef[] = list(input.presets, equipmentPresetDefSchema);
  const exercises: ExerciseDef[] = input.exercises.flatMap((file) =>
    list(file, exerciseDefSchema).filter((exercise) => {
      // One file per movement pattern keeps "where does this go?" obvious (§8.12).
      const expected = `exercises/${kebab(exercise.pattern)}.yaml`;
      if (file.file === expected) return true;
      issues.push(
        `${file.file}: ${exercise.id} has pattern ${exercise.pattern}; move it to ${expected}`,
      );
      return false;
    }),
  );
  const templates: TemplateDef[] = input.templates.flatMap((file) => {
    const parsed = templateDefSchema.safeParse(file.data);
    if (!parsed.success) {
      issues.push(...describeIssues(`${file.file}${idOf(file.data)}`, parsed));
      return [];
    }
    const expected = `templates/${parsed.data.id.replace(/^tpl\./, '')}.yaml`;
    if (file.file !== expected)
      issues.push(`${file.file}: ${parsed.data.id} belongs in ${expected}`);
    return [parsed.data];
  });
  return { draft: { muscles, equipment, presets, exercises, templates }, issues };
}

/** Every muscle credit's citation, for `checkSourceRefs`. */
function sourceRefs(draft: ContentDraft) {
  return draft.exercises.flatMap((exercise) =>
    exercise.muscles.map((credit) => ({
      sourceId: credit.source,
      usedBy: `${exercise.id} ${credit.muscle}`,
    })),
  );
}

/**
 * Library order: competition lifts first, then by movement pattern (the MOVEMENT_PATTERNS order),
 * then as authored. Templates by style, then days per week. Taxonomy, equipment and presets
 * keep their authored order (PRD §7.2 and EQP-01 order).
 */
function orderDraft(draft: ContentDraft): ContentDraft {
  const exercises = draft.exercises.toSorted(
    (a, b) =>
      liftRank(a) - liftRank(b) ||
      MOVEMENT_PATTERNS.indexOf(a.pattern) - MOVEMENT_PATTERNS.indexOf(b.pattern),
  );
  const templates = draft.templates.toSorted(
    (a, b) =>
      TRAINING_STYLES.indexOf(a.style) - TRAINING_STYLES.indexOf(b.style) ||
      a.daysPerWeek - b.daysPerWeek ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return { ...draft, exercises, templates };
}

function liftRank(exercise: ExerciseDef): number {
  return exercise.competitionLift === undefined
    ? COMPETITION_LIFTS.length
    : COMPETITION_LIFTS.indexOf(exercise.competitionLift);
}

/** JSON with object keys sorted at every level: equal content gives equal bytes and hash. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).toSorted(([a], [b]) => (a < b ? -1 : 1)))
      : item,
  );
}

const kebab = (camel: string) => camel.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

// Structural view of a Zod schema, so this package needs no direct Zod dependency.
interface SchemaIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}
type SafeParse<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: { readonly issues: readonly SchemaIssue[] } };
interface Schema<T> {
  safeParse(input: unknown): SafeParse<T>;
}

function describeIssues<T>(where: string, result: SafeParse<T> & { success: false }): string[] {
  return result.error.issues.map((issue) => {
    const field = issue.path.length > 0 ? `${issue.path.map(String).join('.')}: ` : '';
    return `${where}: ${field}${issue.message}`;
  });
}

function idOf(entry: unknown): string {
  return typeof entry === 'object' && entry !== null && 'id' in entry
    ? ` (${String(entry.id)})`
    : '';
}
