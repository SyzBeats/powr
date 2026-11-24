import type {
  EquipmentDef,
  MuscleGroupDef,
  MuscleSubRegionDef,
  TemplateDef,
  TemplateSlot,
} from '@powr/content';
import type {
  CompetitionLift,
  EquipmentId,
  ExerciseDef,
  Goal,
  MovementPattern,
  MuscleId,
  RepRange,
  TrainingStyle,
} from '@powr/domain';
import type { ParamId, ParamValues } from '@powr/domain/rules';
import { BUILT_IN_RULES } from '@powr/rules/built-in';
import { isParamId } from '@powr/rules/schema';

import type { ContentDraft } from './compile.ts';

/**
 * The content lint (technical concept §8.12 step 2) on schema-valid content: cross-references,
 * ID conventions and the content rules the schema cannot express per entry. Each rule returns
 * one message per finding, prefixed with the entry ID. The source check (registry citations) is
 * in compile.ts, because it needs the rules registry.
 */
export function lintContent(draft: ContentDraft): string[] {
  const index = new ContentIndex(draft);
  return [
    ...lintTaxonomy(draft.muscles),
    ...lintEquipment(draft.equipment),
    ...lintPresets(draft, index),
    ...lintExercises(draft, index),
    ...lintTemplates(draft, index),
  ];
}

/** The EB uses this registry entry for every credit it rates C (convention). */
const CONVENTION_SOURCE = 'src.powr-eb-mapping';

/** A default value of the compiled rules registry (the lint reads the shipped defaults). */
function registry<K extends ParamId>(id: K): ParamValues[K] {
  const def = BUILT_IN_RULES.params.find((row) => row.id === id);
  if (!def) throw new Error(`The rules registry has no ${id}`);
  return def.value as ParamValues[K];
}

const hypertrophyReps = registry('volume.repRange.hypertrophy');
const strengthReps = registry('volume.repRange.strength');
const strengthRpe = registry('volume.effort.strengthRpe');

/**
 * Rep-range and effort bands of EB §Defaults › Volume, read from the rules registry (M2; M1
 * mirrored them as constants): hypertrophy reps 5–30 (allowed), strength main work 1–6 and
 * accessories up to 12, hypertrophy RIR 0 up to the hard-set limit (> 4 reduced stimulus),
 * strength RPE from the work band's low end to the heavy-single cap (6–9.5).
 */
const BANDS = {
  hypertrophyReps: [hypertrophyReps.allowed.min, hypertrophyReps.allowed.max],
  strengthReps: [strengthReps.main.min, strengthReps.accessory.max],
  mainLiftStrengthReps: [strengthReps.main.min, strengthReps.main.max],
  hypertrophyRir: [0, registry('volume.hardSet.maxRir')],
  strengthRpe: [strengthRpe.work.min, strengthRpe.heavySingle.max],
} as const;

const STYLE_GOALS: Record<TrainingStyle, readonly Goal[]> = {
  bodybuilding: ['hypertrophy'],
  powerlifting: ['strength'],
  powerbuilding: ['hypertrophy', 'strength'],
};

const LIFT_PATTERN: Record<CompetitionLift, MovementPattern> = {
  squat: 'squat',
  bench: 'horizontalPush',
  deadlift: 'hinge',
};

// ---------------------------------------------------------------------------------------------

function lintTaxonomy(groups: readonly MuscleGroupDef[]): string[] {
  const issues: string[] = [];
  const regions = new Map<string, string>();
  for (const group of groups) {
    if (group.id.split('.').length !== 2) {
      issues.push(`${group.id}: a display group ID has one segment after mu. (PRD §7.2)`);
    }
    for (const sub of group.subRegions) {
      if (!sub.id.startsWith(`${group.id}.`) || sub.id.split('.').length !== 3) {
        issues.push(`${sub.id}: a sub-region of ${group.id} is ${group.id}.<sub-region>`);
      }
      for (const view of Object.keys(sub.bodyMap) as (keyof typeof sub.bodyMap)[]) {
        if (group.bodyMap[view] === undefined) {
          issues.push(`${sub.id}: ${group.id} is not drawn in the ${view} view`);
        }
      }
    }
    for (const muscle of [group, ...group.subRegions]) {
      for (const region of Object.values(muscle.bodyMap)) {
        const owner = regions.get(region);
        if (owner) issues.push(`${muscle.id}: body-map region ${region} is already ${owner}'s`);
        regions.set(region, muscle.id);
      }
    }
  }
  const all = groups.flatMap((group) => [group, ...group.subRegions]);
  issues.push(...duplicateIds(all), ...duplicateTerms(all));
  return issues;
}

function lintEquipment(items: readonly EquipmentDef[]): string[] {
  return [...duplicateIds(items), ...duplicateTerms(items)];
}

/** Inventory fields of a preset and the catalog item each one belongs to (EQP-03). */
const INVENTORY_ITEMS = {
  plates: 'eq.plates',
  microplates: 'eq.microplates',
  dumbbells: 'eq.dumbbells',
  kettlebells: 'eq.kettlebells',
} as const;

function lintPresets(draft: ContentDraft, index: ContentIndex): string[] {
  const issues = duplicateIds(draft.presets);
  for (const preset of draft.presets) {
    const report = (message: string) => issues.push(`${preset.id}: ${message}`);
    const items = new Set<string>(preset.items);
    if (items.size !== preset.items.length) report('an item is listed twice');
    for (const item of preset.items) {
      if (!index.equipment.has(item)) report(`unknown equipment ${item}`);
    }
    const needsInventory = Object.values(INVENTORY_ITEMS).some((item) => items.has(item));
    if (needsInventory && Object.keys(preset.inventory).length !== 2) {
      report('give the inventory in both kg and lb');
    }
    for (const [unit, inventory] of Object.entries(preset.inventory)) {
      for (const [field, item] of Object.entries(INVENTORY_ITEMS)) {
        const listed = field in inventory;
        if (listed && !items.has(item)) report(`${unit}.${field} given but ${item} is not an item`);
        if (!listed && items.has(item))
          report(`${item} is an item but ${unit}.${field} is missing`);
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------

function lintExercises(draft: ContentDraft, index: ContentIndex): string[] {
  const issues = [...duplicateIds(draft.exercises), ...duplicateTerms(draft.exercises)];
  for (const exercise of draft.exercises) {
    const report = (message: string) => issues.push(`${exercise.id}: ${message}`);
    lintRequirement(exercise, index, report);
    lintCredits(exercise, index, report);
    lintLinks(exercise, index, report);
    lintDefaults(exercise, index, report);
    const cues = exercise.cues.map((cue) => cue.en.toLowerCase());
    if (new Set(cues).size !== cues.length) report('a cue is repeated');
  }
  return issues;
}

type Report = (message: string) => void;

function lintRequirement(exercise: ExerciseDef, index: ContentIndex, report: Report) {
  const { allOf, anyOf } = exercise.equipment;
  const all = [...allOf, ...anyOf.flat()];
  for (const item of all) {
    if (!index.equipment.has(item)) report(`unknown equipment ${item}`);
  }
  if (new Set(all).size !== all.length) report('an equipment item appears twice');

  // The load type must match what the requirement provides (EXL-04 load model).
  const requires = (test: (item: EquipmentDef) => boolean) =>
    allOf.some((id) => index.matches(id, test)) ||
    anyOf.some((group) => group.every((id) => index.matches(id, test)));
  const needed: Partial<Record<ExerciseDef['load']['type'], [string, boolean]>> = {
    barbell: ['a bar and plates', requires(kind('bar')) && requires(kind('plates'))],
    dumbbell: ['dumbbells or kettlebells', requires(kind('dumbbells', 'kettlebells'))],
    machine: [
      'a machine or cable',
      requires((item) => item.category === 'machine' || item.category === 'cable'),
    ],
    band: ['bands', requires(kind('bands'))],
  };
  const check = needed[exercise.load.type];
  if (check && !check[1]) report(`load type ${exercise.load.type} needs ${check[0]}`);

  const { type, bodyweightLoaded } = exercise.load;
  if (type === 'bodyweightAssisted' && !bodyweightLoaded) {
    report('bodyweightAssisted implies bodyweightLoaded');
  }
  if (bodyweightLoaded && type !== 'bodyweightAdded' && type !== 'bodyweightAssisted') {
    report(`bodyweightLoaded needs a bodyweight load type, not ${type}`);
  }
}

function lintCredits(exercise: ExerciseDef, index: ContentIndex, report: Report) {
  const credited = new Set<MuscleId>();
  for (const { muscle, credit, evidence, source } of exercise.muscles) {
    if (!index.muscles.has(muscle)) report(`unknown muscle ${muscle}`);
    if (credited.has(muscle)) report(`${muscle} is credited twice`);
    credited.add(muscle);
    // EXL-05, E-4: the optional 0.25 credits are unvalidated conventions.
    if (credit === 0.25 && evidence !== 'C') report(`${muscle}: a 0.25 credit is tagged C`);
    if ((evidence === 'C') !== (source === CONVENTION_SOURCE)) {
      report(`${muscle}: C credits cite ${CONVENTION_SOURCE}, H and EMG credits cite a study`);
    }
  }
  // A group and one of its sub-regions together would count one set twice when rolled up.
  for (const muscle of credited) {
    const group = groupOf(muscle);
    if (group !== muscle && credited.has(group)) {
      report(`credits both ${group} and its sub-region ${muscle}`);
    }
  }
  if (!exercise.muscles.some((credit) => credit.credit === 1)) {
    report('has no primary muscle (credit 1)');
  }
  for (const sub of exercise.ranking.subRegions ?? []) {
    if (!index.muscles.has(sub) || groupOf(sub) === sub) {
      report(`ranking.subRegions: ${sub} is not a sub-region`);
    } else if (index.creditFor(exercise, sub) < 0.5) {
      report(`ranking.subRegions: ${sub} needs a credit of at least 0.5 (itself or its group)`);
    }
  }
}

function lintLinks(exercise: ExerciseDef, index: ContentIndex, report: Report) {
  const { variantOf, replacedBy, competitionLift, status } = exercise;
  if (variantOf !== undefined) {
    const target = index.exercises.get(variantOf);
    if (!target) report(`variantOf ${variantOf} does not exist`);
    else if (variantOf === exercise.id) report('is a variant of itself');
    else if (target.variantOf !== undefined) report(`variantOf ${variantOf}, itself a variant`);
    else if (target.status !== 'active') report(`variantOf ${variantOf}, which is deprecated`);
    if (competitionLift !== undefined) report('has competitionLift and variantOf; pick one');
  }
  if (replacedBy !== undefined) {
    const target = index.exercises.get(replacedBy);
    if (!target) report(`replacedBy ${replacedBy} does not exist`);
    else if (target.status !== 'active') report(`replacedBy ${replacedBy}, which is deprecated`);
  }
  if ((status === 'deprecated') !== (replacedBy !== undefined)) {
    report('a deprecated exercise names its replacement (replacedBy), an active one does not');
  }
}

function lintDefaults(exercise: ExerciseDef, index: ContentIndex, report: Report) {
  const { defaults, mechanics } = exercise;
  const lift = index.liftOf(exercise);
  if (lift !== undefined) {
    // EXL-07 fixed-ROM semantics; TMR-02: competition lifts and close variants rest as strength.
    if (!defaults.fixedRom) report('competition lifts and their variants have fixedRom');
    if (defaults.restClass !== 'strength') report('competition lifts rest as strength');
    if (exercise.pattern !== LIFT_PATTERN[lift]) {
      report(`a ${lift} variant has pattern ${LIFT_PATTERN[lift]}`);
    }
    outside(defaults.repRange.strength, BANDS.mainLiftStrengthReps, report, 'strength reps');
  }
  if (mechanics === 'isolation' && defaults.restClass !== 'hypertrophyIsolation') {
    report('isolation exercises use rest class hypertrophyIsolation');
  }
  outside(defaults.repRange.hypertrophy, BANDS.hypertrophyReps, report, 'hypertrophy reps');
  outside(defaults.repRange.strength, BANDS.strengthReps, report, 'strength reps');
}

// ---------------------------------------------------------------------------------------------

function lintTemplates(draft: ContentDraft, index: ContentIndex): string[] {
  const issues = duplicateIds(draft.templates);
  const defaults = new Map<string, TemplateDef>();
  for (const template of draft.templates) {
    const report = (message: string) => issues.push(`${template.id}: ${message}`);
    if (template.default) {
      const cell = `${template.style} × ${template.daysPerWeek} days`;
      const other = defaults.get(cell);
      if (other) report(`${other.id} is already the default for ${cell}`);
      defaults.set(cell, template);
    }
    if (!isParamId(template.mesocycle.deloadRule)) {
      report(`mesocycle.deloadRule ${template.mesocycle.deloadRule} is not a rules parameter`);
    }
    const dayKeys = template.days.map((day) => day.key);
    if (new Set(dayKeys).size !== dayKeys.length) report('a day key is used twice');
    const slots = template.days.flatMap((day) => day.slots);
    const slotKeys = slots.map((slot) => slot.key);
    if (new Set(slotKeys).size !== slotKeys.length) report('a slot key is used twice');
    for (const slot of slots) lintSlot(template, slot, index, (m) => report(`${slot.key}: ${m}`));
  }
  return issues;
}

function lintSlot(template: TemplateDef, slot: TemplateSlot, index: ContentIndex, report: Report) {
  for (const target of slot.targets) {
    if (!index.muscles.has(target)) report(`unknown target ${target}`);
  }
  if (!STYLE_GOALS[template.style].includes(slot.goal)) {
    report(`goal ${slot.goal} does not fit a ${template.style} template`);
  }
  if (slot.lift !== undefined && slot.pattern !== LIFT_PATTERN[slot.lift]) {
    report(`a ${slot.lift} slot has pattern ${LIFT_PATTERN[slot.lift]}`);
  }
  const repBand =
    slot.goal === 'hypertrophy'
      ? BANDS.hypertrophyReps
      : slot.lift !== undefined
        ? BANDS.mainLiftStrengthReps
        : BANDS.strengthReps;
  const ranges = [slot, ...(slot.backoff ? [slot.backoff] : [])];
  for (const { repRange, effort } of ranges) {
    if (repRange) outside(repRange, repBand, report, 'reps');
    if (effort && 'rir' in effort) outside(effort.rir, BANDS.hypertrophyRir, report, 'RIR');
    if (effort && 'rpe' in effort) outside(effort.rpe, BANDS.strengthRpe, report, 'RPE');
  }
  // A reference check, not plan generation (M2): the library must offer a candidate at all.
  const candidates = [...index.exercises.values()].filter(
    (exercise) =>
      exercise.status === 'active' &&
      exercise.pattern === slot.pattern &&
      slot.targets.some((target) => index.creditFor(exercise, target) >= 0.5) &&
      (slot.lift === undefined ||
        exercise.competitionLift === slot.lift ||
        (slot.allowVariants === true && index.liftOf(exercise) === slot.lift)),
  );
  if (candidates.length === 0) report('no exercise in the library fits this slot');
}

/** Matches equipment whose loading is one of `kinds` (bar, plates, dumbbells, …). */
function kind(...kinds: string[]) {
  return (item: EquipmentDef) => kinds.includes(item.loading?.kind ?? '');
}

// ---------------------------------------------------------------------------------------------

/** Lookups shared by the rules. */
export class ContentIndex {
  readonly muscles: ReadonlyMap<MuscleId, MuscleGroupDef | MuscleSubRegionDef>;
  readonly equipment: ReadonlyMap<EquipmentId, EquipmentDef>;
  readonly exercises: ReadonlyMap<string, ExerciseDef>;

  constructor(draft: Pick<ContentDraft, 'muscles' | 'equipment' | 'exercises'>) {
    this.muscles = new Map(
      draft.muscles.flatMap((group) => [group, ...group.subRegions].map((m) => [m.id, m])),
    );
    this.equipment = new Map(draft.equipment.map((item) => [item.id, item]));
    this.exercises = new Map(draft.exercises.map((exercise) => [exercise.id, exercise]));
  }

  matches(id: EquipmentId, test: (item: EquipmentDef) => boolean): boolean {
    const item = this.equipment.get(id);
    return item !== undefined && test(item);
  }

  /** The competition lift an exercise is, or is a close variant of. */
  liftOf(exercise: ExerciseDef): CompetitionLift | undefined {
    if (exercise.competitionLift !== undefined) return exercise.competitionLift;
    if (exercise.variantOf === undefined) return undefined;
    return this.exercises.get(exercise.variantOf)?.competitionLift;
  }

  /**
   * The credit an exercise gives `muscle`. For a display group: the largest credit of the group
   * or any of its sub-regions (the roll-up, EXL-05). For a sub-region: its own credit, or the
   * group's credit, which covers every sub-region.
   */
  creditFor(exercise: ExerciseDef, muscle: MuscleId): number {
    const isGroup = groupOf(muscle) === muscle;
    const credits = exercise.muscles
      .filter((credit) =>
        isGroup
          ? groupOf(credit.muscle) === muscle
          : credit.muscle === muscle || credit.muscle === groupOf(muscle),
      )
      .map((credit) => credit.credit);
    return Math.max(0, ...credits);
  }
}

/** `mu.quads.vasti` → `mu.quads`: sub-regions roll up to their group by ID (EXL-05). */
function groupOf(muscle: MuscleId): MuscleId {
  return muscle.split('.').slice(0, 2).join('.') as MuscleId;
}

function outside(
  range: RepRange | readonly [number, number],
  [low, high]: readonly [number, number],
  report: Report,
  label: string,
) {
  if (range[0] < low || range[1] > high) {
    report(`${label} ${range[0]}–${range[1]} lie outside the band ${low}–${high}`);
  }
}

function duplicateIds(entries: readonly { readonly id: string }[]): string[] {
  const seen = new Set<string>();
  return entries.flatMap(({ id }) => {
    if (seen.has(id)) return [`${id}: duplicate ID`];
    seen.add(id);
    return [];
  });
}

/** Names and synonyms must identify one entry, case-insensitively (§8.12, EXL-02 search). */
function duplicateTerms(
  entries: readonly {
    readonly id: string;
    readonly name: { readonly en: string };
    readonly synonyms: readonly string[];
  }[],
): string[] {
  const owner = new Map<string, string>();
  const issues: string[] = [];
  for (const entry of entries) {
    for (const term of new Set([entry.name.en, ...entry.synonyms].map((t) => t.toLowerCase()))) {
      const first = owner.get(term);
      if (first) issues.push(`${entry.id}: "${term}" already names ${first}`);
      else owner.set(term, entry.id);
    }
  }
  return issues;
}
