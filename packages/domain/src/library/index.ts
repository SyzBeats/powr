/**
 * `@powr/domain/library`: the exercise library (EXL-02…05, EXL-07…09). Search by name and
 * synonyms (accent- and case-insensitive, word prefixes; under 100 ms for the whole library),
 * filters by muscle, equipment, movement pattern, mechanics and "available with my equipment"
 * (AND across filters, OR within one), the detail data of an exercise (muscles with credits and
 * evidence tags, equipment with what is missing, defaults, variants, substitutes and competition
 * lift), and the validation of custom exercises (EXL-04: credits 1.0/0.5/0.25/0, load type,
 * curve class `equation`/`legPressLike`/`pooled`, never a muscle group together with one of its
 * own sub-regions, as the content lint requires, so volume counting stays exact).
 */
import { isAvailable, missingEquipment, type MissingEquipment } from '../equipment';
import type { EquipmentId, ExerciseId, MuscleId, SourceId } from '../ids';
import {
  CREDIT_VALUES,
  CURVE_CLASSES,
  LOAD_TYPES,
  MECHANICS,
  MOVEMENT_PATTERNS,
  REST_CLASSES,
  type AvoidList,
  type CompetitionLift,
  type CreditValue,
  type CurveClass,
  type CustomExercise,
  type EquipmentRequirement,
  type ExerciseDef,
  type LoadType,
  type Mechanics,
  type MovementPattern,
  type MuscleCredit,
  type RepRange,
  type RestClass,
} from '../model';
import { creditFor, evidenceFor, liftOf } from '../planning/credits';
import type { InstantTz } from '../time';
import { toKg, type Mass } from '../units';
import { parentMuscle } from '../volume';

// --- Search and filters (EXL-02) -----------------------------------------------------------

export interface LibraryQuery {
  readonly text?: string;
  /** Exercises that credit one of these muscles at least `minCredit` (default 0.5). */
  readonly muscles?: readonly MuscleId[];
  readonly minCredit?: number;
  /** Exercises that use one of these equipment items. */
  readonly equipment?: readonly string[];
  readonly patterns?: readonly MovementPattern[];
  readonly mechanics?: readonly Mechanics[];
  /** Only exercises the user's equipment allows (EQP-04). */
  readonly availableOnly?: boolean;
  readonly favouritesOnly?: boolean;
  readonly customOnly?: boolean;
  /** Hidden exercises are left out unless asked for (EXL-08). */
  readonly includeHidden?: boolean;
  /** Retired exercises are left out unless asked for. */
  readonly includeDeprecated?: boolean;
}

export interface LibraryUser {
  /** The active equipment profile's items; null: no profile (everything available). */
  readonly equipment: ReadonlySet<string> | null;
  readonly favourites: readonly ExerciseId[];
  readonly hidden: readonly ExerciseId[];
  readonly avoid: AvoidList;
}

export interface LibraryItem {
  readonly exerciseId: ExerciseId;
  /** Search relevance (0 without a text query). */
  readonly relevance: number;
  readonly match: 'name' | 'synonym' | null;
  readonly available: boolean;
  readonly favourite: boolean;
  readonly hidden: boolean;
  readonly avoided: boolean;
  readonly custom: boolean;
  /** Display groups credited 1.0 (primary) and 0.5 (secondary). */
  readonly primary: readonly MuscleId[];
  readonly secondary: readonly MuscleId[];
}

/** EXL-02: the exercises matching every filter, best match first (then favourites, then name). */
export function searchLibrary(
  exercises: readonly ExerciseDef[],
  query: LibraryQuery,
  user: LibraryUser,
): LibraryItem[] {
  const words = query.text
    ? fold(query.text)
        .split(/[\s,]+/)
        .filter(Boolean)
    : [];
  const favourites = new Set<string>(user.favourites);
  const hidden = new Set<string>(user.hidden);
  const minCredit = query.minCredit ?? 0.5;
  const items: (LibraryItem & { readonly name: string })[] = [];
  for (const exercise of exercises) {
    if (exercise.status !== 'active' && !query.includeDeprecated) continue;
    const isHidden = hidden.has(exercise.id);
    if (isHidden && !query.includeHidden) continue;
    if (query.customOnly && !exercise.custom) continue;
    if (query.favouritesOnly && !favourites.has(exercise.id)) continue;
    if (query.patterns?.length && !query.patterns.includes(exercise.pattern)) continue;
    if (query.mechanics?.length && !query.mechanics.includes(exercise.mechanics)) continue;
    if (
      query.muscles?.length &&
      !query.muscles.some((muscle) => creditFor(exercise, muscle) >= minCredit)
    ) {
      continue;
    }
    if (query.equipment?.length && !query.equipment.some((item) => uses(exercise, item))) continue;
    const available = user.equipment === null || isAvailable(exercise, user.equipment);
    if (query.availableOnly && !available) continue;
    const scored = words.length > 0 ? relevance(exercise, words) : { score: 0, match: null };
    if (words.length > 0 && scored.score === 0) continue;
    const groups = groupRoles(exercise);
    items.push({
      exerciseId: exercise.id,
      relevance: scored.score,
      match: scored.match,
      available,
      favourite: favourites.has(exercise.id),
      hidden: isHidden,
      avoided:
        user.avoid.exercises.includes(exercise.id) ||
        user.avoid.patterns.includes(exercise.pattern),
      custom: exercise.custom,
      primary: groups.primary,
      secondary: groups.secondary,
      name: fold(exercise.name.en),
    });
  }
  return items
    .toSorted(
      (a, b) =>
        b.relevance - a.relevance ||
        Number(b.favourite) - Number(a.favourite) ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
        (a.exerciseId < b.exerciseId ? -1 : 1),
    )
    .map(({ name: _name, ...item }) => item);
}

/** Lower case without diacritics ("Développé" matches "developpe"). */
export function fold(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase().trim();
}

function uses(exercise: ExerciseDef, item: string): boolean {
  return (
    exercise.equipment.allOf.some((id) => id === item) ||
    exercise.equipment.anyOf.some((group) => group.some((id) => id === item))
  );
}

/**
 * Relevance of a text query: 100 exact name, 90 name starts with the query, 70 every word starts
 * a word of the name, 50/40/30 the same for a synonym, 20 every word inside the name or a synonym.
 */
function relevance(
  exercise: ExerciseDef,
  words: readonly string[],
): { score: number; match: 'name' | 'synonym' | null } {
  const query = words.join(' ');
  const name = fold(exercise.name.en);
  const scoreText = (text: string, top: number): number => {
    if (text === query) return top;
    if (text.startsWith(query)) return top - 10;
    const tokens = text.split(/[\s\-(),/]+/).filter(Boolean);
    if (words.every((word) => tokens.some((token) => token.startsWith(word)))) return top - 30;
    if (words.every((word) => text.includes(word))) return 20;
    return 0;
  };
  const byName = scoreText(name, 100);
  const bySynonym = Math.max(
    0,
    ...exercise.synonyms.map((synonym) => scoreText(fold(synonym), 50)),
  );
  if (byName === 0 && bySynonym === 0) return { score: 0, match: null };
  return byName >= bySynonym
    ? { score: byName, match: 'name' }
    : { score: bySynonym, match: 'synonym' };
}

function groupRoles(exercise: ExerciseDef): { primary: MuscleId[]; secondary: MuscleId[] } {
  const groups = new Map<MuscleId, number>();
  for (const credit of exercise.muscles) {
    const group = parentMuscle(credit.muscle);
    groups.set(group, Math.max(groups.get(group) ?? 0, credit.credit));
  }
  const sorted = [...groups].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    primary: sorted.filter(([, credit]) => credit >= 1).map(([muscle]) => muscle),
    secondary: sorted.filter(([, credit]) => credit >= 0.5 && credit < 1).map(([muscle]) => muscle),
  };
}

// --- Detail (EXL-03, EXL-05, EXL-07) -------------------------------------------------------

export interface DetailMuscle {
  readonly muscle: MuscleId;
  /** The display group it rolls up to (itself for a group). */
  readonly group: MuscleId;
  readonly credit: number;
  readonly role: 'primary' | 'secondary' | 'minor' | 'none';
  readonly evidence: MuscleCredit['evidence'];
  readonly source: SourceId;
  /** Credit 0.25 or convention-only mappings are labelled "unvalidated convention" (EXL-05). */
  readonly convention: boolean;
}

export interface ExerciseRelations {
  readonly lift: CompetitionLift | null;
  /** The competition lift it is, or the exercise it is a close variant of. */
  readonly variantOf: ExerciseId | null;
  /** Close variants of this exercise (or its siblings when it is a variant itself). */
  readonly variants: readonly ExerciseId[];
  /** Exercises sharing a substitution group, available ones first. */
  readonly substitutes: readonly { readonly exerciseId: ExerciseId; readonly available: boolean }[];
}

export interface ExerciseInfo {
  readonly exercise: ExerciseDef;
  readonly muscles: readonly DetailMuscle[];
  readonly equipment: {
    readonly requirement: EquipmentRequirement;
    readonly available: boolean;
    readonly missing: MissingEquipment;
  };
  readonly relations: ExerciseRelations;
  readonly flags: {
    readonly favourite: boolean;
    readonly hidden: boolean;
    readonly avoided: boolean;
    readonly avoidedPattern: boolean;
    readonly custom: boolean;
  };
}

/** EXL-03: what the detail view shows besides the user's history. */
export function exerciseInfo(
  exercise: ExerciseDef,
  exercises: readonly ExerciseDef[],
  user: LibraryUser,
): ExerciseInfo {
  const lookup = (id: ExerciseId) => exercises.find((entry) => entry.id === id);
  const muscles = exercise.muscles
    .map((credit): DetailMuscle => ({
      muscle: credit.muscle,
      group: parentMuscle(credit.muscle),
      credit: credit.credit,
      role:
        credit.credit >= 1
          ? 'primary'
          : credit.credit >= 0.5
            ? 'secondary'
            : credit.credit > 0
              ? 'minor'
              : 'none',
      evidence: credit.evidence,
      source: credit.source,
      convention: credit.credit === 0.25 || credit.evidence === 'C',
    }))
    .toSorted(
      (a, b) => b.credit - a.credit || (a.muscle < b.muscle ? -1 : a.muscle > b.muscle ? 1 : 0),
    );
  const equipment = user.equipment ?? new Set<string>();
  const available = user.equipment === null || isAvailable(exercise, equipment);
  const parent = exercise.variantOf ?? null;
  const family = parent ?? exercise.id;
  const variants = exercises
    .filter(
      (entry) =>
        entry.status === 'active' &&
        entry.id !== exercise.id &&
        (entry.variantOf === family || (parent !== null && entry.id === parent)),
    )
    .map((entry) => entry.id)
    .toSorted();
  const groups = new Set(exercise.substitutionGroups);
  const hidden = new Set<string>(user.hidden);
  const substitutes = exercises
    .filter(
      (entry) =>
        entry.status === 'active' &&
        entry.id !== exercise.id &&
        !hidden.has(entry.id) &&
        entry.substitutionGroups.some((group) => groups.has(group)),
    )
    .map((entry) => ({
      exerciseId: entry.id,
      available: user.equipment === null || isAvailable(entry, equipment),
    }))
    .toSorted(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        (a.exerciseId < b.exerciseId ? -1 : a.exerciseId > b.exerciseId ? 1 : 0),
    );
  return {
    exercise,
    muscles,
    equipment: {
      requirement: exercise.equipment,
      available,
      missing:
        user.equipment === null
          ? { allOf: [], anyOf: [] }
          : missingEquipment(exercise, user.equipment).value,
    },
    relations: {
      lift: liftOf(exercise, lookup) ?? null,
      variantOf: parent,
      variants,
      substitutes,
    },
    flags: {
      favourite: user.favourites.includes(exercise.id),
      hidden: user.hidden.includes(exercise.id),
      avoided: user.avoid.exercises.includes(exercise.id),
      avoidedPattern: user.avoid.patterns.includes(exercise.pattern),
      custom: exercise.custom,
    },
  };
}

/** The evidence tag of an exercise's credit for a muscle (MAP-02 list item). */
export const evidenceOf = evidenceFor;

// --- Custom exercises (EXL-04) -------------------------------------------------------------

/** The source custom credits cite: the user's own convention (labelled as such, EXL-05). */
export const USER_DEFINED_SOURCE = 'src.powr-user-defined' as SourceId;

export interface CustomExerciseInput {
  readonly name: string;
  readonly synonyms?: readonly string[];
  readonly pattern: MovementPattern;
  readonly mechanics: Mechanics;
  readonly equipment: EquipmentRequirement;
  readonly muscles: readonly { readonly muscle: MuscleId; readonly credit: CreditValue }[];
  readonly load: {
    readonly type: LoadType;
    readonly curveClass: CurveClass;
    readonly unilateral: boolean;
    readonly bodyweightLoaded?: boolean;
    readonly increment?: Mass;
  };
  readonly repRange: { readonly strength: RepRange; readonly hypertrophy: RepRange };
  readonly restClass: RestClass;
  readonly tempo?: string;
  readonly stretchEmphasis?: boolean;
  /** 0–3 (MAP-03 d); with `userRated` the ranking uses it. */
  readonly overloadSuitability?: 0 | 1 | 2 | 3;
  readonly userRated?: boolean;
  /** A close variant of a built-in exercise (EXL-07). */
  readonly variantOf?: ExerciseId;
  readonly substitutionGroups?: readonly string[];
  /** The user's own cues (0–6, each ≤ 140 characters). */
  readonly cues?: readonly string[];
}

export type CustomExerciseIssue =
  | { readonly field: 'name'; readonly code: 'empty' | 'tooLong' | 'duplicate' }
  | { readonly field: 'synonyms'; readonly code: 'tooMany' | 'tooLong' | 'duplicate' }
  | { readonly field: 'pattern' | 'mechanics' | 'restClass'; readonly code: 'unknown' }
  | { readonly field: 'equipment'; readonly code: 'unknownItem'; readonly item: string }
  | { readonly field: 'equipment'; readonly code: 'tooMany' | 'emptyGroup' }
  | {
      readonly field: 'muscles';
      readonly code: 'none' | 'noPrimary' | 'tooMany';
    }
  | {
      readonly field: 'muscles';
      readonly code: 'unknownMuscle' | 'duplicate' | 'groupAndSubRegion' | 'invalidCredit';
      readonly muscle: string;
    }
  | {
      readonly field: 'load';
      readonly code: 'unknownType' | 'unknownCurve' | 'bodyweightFlag' | 'increment';
    }
  | { readonly field: 'repRange'; readonly code: 'invalid' }
  | { readonly field: 'tempo'; readonly code: 'invalid' }
  | { readonly field: 'variantOf'; readonly code: 'unknown' | 'variantOfVariant' }
  | { readonly field: 'cues'; readonly code: 'tooMany' | 'tooLong' };

export interface CustomExerciseContext {
  readonly id: ExerciseId;
  readonly now: InstantTz;
  /** The stored record when editing (keeps `createdAt` and `copiedFrom`). */
  readonly previous?: CustomExercise;
  readonly copiedFrom?: ExerciseId;
  /** Every other exercise (built-in and custom), for unique names and `variantOf`. */
  readonly exercises: readonly ExerciseDef[];
  readonly isMuscle: (id: MuscleId) => boolean;
  /** Catalog items and the user's custom equipment items (EQP-07). */
  readonly isEquipment: (id: string) => boolean;
}

const NAME_MAX = 120;
const CUE_MAX = 140;
const TEMPO = /^\d{1,2}-\d{1,2}-(?:X|\d{1,2})-\d{1,2}$/;

const validRange = (range: RepRange) =>
  Number.isInteger(range[0]) &&
  Number.isInteger(range[1]) &&
  range[0] >= 1 &&
  range[0] <= range[1] &&
  range[1] <= 100;

/** EXL-04: validates the input and builds the custom exercise, or lists every problem. */
export function buildCustomExercise(
  input: CustomExerciseInput,
  ctx: CustomExerciseContext,
):
  | { readonly ok: true; readonly exercise: CustomExercise }
  | { readonly ok: false; readonly issues: readonly CustomExerciseIssue[] } {
  const issues: CustomExerciseIssue[] = [];
  const name = input.name.trim();
  const others = ctx.exercises.filter((exercise) => exercise.id !== ctx.id);
  const taken = new Set(
    others.flatMap((exercise) => [exercise.name.en, ...exercise.synonyms].map(fold)),
  );
  if (name === '') issues.push({ field: 'name', code: 'empty' });
  else if (name.length > NAME_MAX) issues.push({ field: 'name', code: 'tooLong' });
  else if (taken.has(fold(name))) issues.push({ field: 'name', code: 'duplicate' });

  const synonyms = (input.synonyms ?? []).map((synonym) => synonym.trim()).filter(Boolean);
  if (synonyms.length > 10) issues.push({ field: 'synonyms', code: 'tooMany' });
  if (synonyms.some((synonym) => synonym.length > NAME_MAX))
    issues.push({ field: 'synonyms', code: 'tooLong' });
  if (synonyms.some((synonym) => taken.has(fold(synonym)) || fold(synonym) === fold(name)))
    issues.push({ field: 'synonyms', code: 'duplicate' });

  if (!(MOVEMENT_PATTERNS as readonly string[]).includes(input.pattern))
    issues.push({ field: 'pattern', code: 'unknown' });
  if (!(MECHANICS as readonly string[]).includes(input.mechanics))
    issues.push({ field: 'mechanics', code: 'unknown' });
  if (!(REST_CLASSES as readonly string[]).includes(input.restClass))
    issues.push({ field: 'restClass', code: 'unknown' });

  const items = [...input.equipment.allOf, ...input.equipment.anyOf.flat()];
  if (items.length > 30) issues.push({ field: 'equipment', code: 'tooMany' });
  if (input.equipment.anyOf.some((group) => group.length === 0))
    issues.push({ field: 'equipment', code: 'emptyGroup' });
  for (const item of new Set(items)) {
    if (!ctx.isEquipment(item)) issues.push({ field: 'equipment', code: 'unknownItem', item });
  }

  if (input.muscles.length === 0) issues.push({ field: 'muscles', code: 'none' });
  if (input.muscles.length > 20) issues.push({ field: 'muscles', code: 'tooMany' });
  if (input.muscles.length > 0 && !input.muscles.some((entry) => entry.credit === 1))
    issues.push({ field: 'muscles', code: 'noPrimary' });
  const seen = new Set<string>();
  for (const entry of input.muscles) {
    if (!ctx.isMuscle(entry.muscle))
      issues.push({ field: 'muscles', code: 'unknownMuscle', muscle: entry.muscle });
    if (!(CREDIT_VALUES as readonly number[]).includes(entry.credit))
      issues.push({ field: 'muscles', code: 'invalidCredit', muscle: entry.muscle });
    if (seen.has(entry.muscle))
      issues.push({ field: 'muscles', code: 'duplicate', muscle: entry.muscle });
    seen.add(entry.muscle);
  }
  for (const entry of input.muscles) {
    const group = parentMuscle(entry.muscle);
    if (group !== entry.muscle && seen.has(group))
      issues.push({ field: 'muscles', code: 'groupAndSubRegion', muscle: entry.muscle });
  }

  if (!(LOAD_TYPES as readonly string[]).includes(input.load.type))
    issues.push({ field: 'load', code: 'unknownType' });
  if (!(CURVE_CLASSES as readonly string[]).includes(input.load.curveClass))
    issues.push({ field: 'load', code: 'unknownCurve' });
  const bodyweightLoaded = input.load.bodyweightLoaded ?? false;
  if (
    bodyweightLoaded &&
    input.load.type !== 'bodyweightAdded' &&
    input.load.type !== 'bodyweightAssisted'
  ) {
    issues.push({ field: 'load', code: 'bodyweightFlag' });
  }
  if (input.load.increment) {
    const kg = toKg(input.load.increment);
    if (!(kg > 0 && kg <= 50)) issues.push({ field: 'load', code: 'increment' });
  }
  if (!validRange(input.repRange.strength) || !validRange(input.repRange.hypertrophy))
    issues.push({ field: 'repRange', code: 'invalid' });
  const tempo = input.tempo?.trim() || '2-0-X-0';
  if (!TEMPO.test(tempo)) issues.push({ field: 'tempo', code: 'invalid' });

  let variantOf: ExerciseDef | undefined;
  if (input.variantOf !== undefined) {
    variantOf = others.find((exercise) => exercise.id === input.variantOf);
    if (!variantOf || variantOf.status !== 'active')
      issues.push({ field: 'variantOf', code: 'unknown' });
    else if (variantOf.variantOf !== undefined)
      issues.push({ field: 'variantOf', code: 'variantOfVariant' });
  }
  const cues = (input.cues ?? []).map((cue) => cue.trim()).filter(Boolean);
  if (cues.length > 6) issues.push({ field: 'cues', code: 'tooMany' });
  if (cues.some((cue) => cue.length > CUE_MAX)) issues.push({ field: 'cues', code: 'tooLong' });
  if (issues.length > 0) return { ok: false, issues };

  const copiedFrom = ctx.previous?.copiedFrom ?? ctx.copiedFrom;
  const exercise: CustomExercise = {
    id: ctx.id,
    name: { en: name },
    synonyms,
    pattern: input.pattern,
    mechanics: input.mechanics,
    ...(variantOf ? { variantOf: variantOf.id } : {}),
    substitutionGroups: [
      ...new Set(input.substitutionGroups ?? variantOf?.substitutionGroups ?? []),
    ],
    equipment: {
      allOf: [...new Set(input.equipment.allOf)] as EquipmentId[],
      anyOf: input.equipment.anyOf.map((group) => [...new Set(group)] as EquipmentId[]),
    },
    muscles: input.muscles.map((entry) => ({
      muscle: entry.muscle,
      credit: entry.credit,
      evidence: 'C',
      source: USER_DEFINED_SOURCE,
    })),
    load: {
      type: input.load.type,
      curveClass: input.load.curveClass,
      unilateral: input.load.unilateral,
      bodyweightLoaded,
      ...(input.load.increment ? { increment: input.load.increment } : {}),
    },
    defaults: {
      repRange: {
        strength: [input.repRange.strength[0], input.repRange.strength[1]],
        hypertrophy: [input.repRange.hypertrophy[0], input.repRange.hypertrophy[1]],
      },
      restClass: input.restClass,
      tempo,
      fixedRom: false,
      stretchEmphasis: input.stretchEmphasis ?? false,
    },
    ranking: { overloadSuitability: input.overloadSuitability ?? 2 },
    cues: cues.map((cue) => ({ en: cue })),
    custom: true,
    ...(input.userRated ? { userRated: true } : {}),
    status: 'active',
    createdAt: ctx.previous?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
    ...(copiedFrom ? { copiedFrom } : {}),
  };
  return { ok: true, exercise };
}

/** EXL-04 "copy a built-in one": the form's starting values (the name is the user's to give). */
export function customDraftFrom(exercise: ExerciseDef): CustomExerciseInput {
  return {
    name: '',
    synonyms: [],
    pattern: exercise.pattern,
    mechanics: exercise.mechanics,
    equipment: {
      allOf: [...exercise.equipment.allOf],
      anyOf: exercise.equipment.anyOf.map((group) => [...group]),
    },
    muscles: exercise.muscles.map((entry) => ({ muscle: entry.muscle, credit: entry.credit })),
    load: {
      type: exercise.load.type,
      curveClass: exercise.load.curveClass,
      unilateral: exercise.load.unilateral,
      bodyweightLoaded: exercise.load.bodyweightLoaded,
      ...(exercise.load.increment ? { increment: exercise.load.increment } : {}),
    },
    repRange: {
      strength: exercise.defaults.repRange.strength,
      hypertrophy: exercise.defaults.repRange.hypertrophy,
    },
    restClass: exercise.defaults.restClass,
    tempo: exercise.defaults.tempo,
    stretchEmphasis: exercise.defaults.stretchEmphasis,
    overloadSuitability: exercise.ranking.overloadSuitability,
    ...(exercise.variantOf
      ? { variantOf: exercise.variantOf }
      : exercise.competitionLift
        ? { variantOf: exercise.id }
        : {}),
    substitutionGroups: [...exercise.substitutionGroups],
    cues: [],
  };
}
