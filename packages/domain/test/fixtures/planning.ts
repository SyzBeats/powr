import type {
  CompetitionLift,
  EquipmentId,
  ExerciseDef,
  ExerciseId,
  IsoWeekday,
  LoadType,
  Mechanics,
  MovementPattern,
  MuscleId,
  PlanDay,
  PlanSlot,
  RestClass,
  SourceId,
  TemplateDef,
  TemplateId,
  TemplateSlot,
} from '../../src';
import type { PlanRequest } from '../../src/planning';

/** A small exercise library for the planning tests (the domain cannot import the content). */
interface ExerciseSpec {
  readonly pattern: MovementPattern;
  readonly mechanics?: Mechanics;
  readonly muscles: readonly (readonly [string, 1 | 0.5 | 0.25])[];
  readonly allOf?: readonly string[];
  readonly anyOf?: readonly (readonly string[])[];
  readonly type?: LoadType;
  readonly lift?: CompetitionLift;
  readonly variantOf?: string;
  readonly rest?: RestClass;
  readonly stretch?: boolean;
  readonly overload?: 0 | 1 | 2 | 3;
  readonly evidence?: 'H' | 'EMG' | 'C';
  readonly subRegions?: readonly string[];
  /** `ranking.standard` (M5z): the standard variant, the tie-break among equal scores. */
  readonly standard?: true;
}

export function exercise(id: string, spec: ExerciseSpec): ExerciseDef {
  const mechanics = spec.mechanics ?? 'compound';
  return {
    id: id as ExerciseId,
    name: { en: id },
    synonyms: [],
    pattern: spec.pattern,
    mechanics,
    ...(spec.lift ? { competitionLift: spec.lift } : {}),
    ...(spec.variantOf ? { variantOf: spec.variantOf as ExerciseId } : {}),
    substitutionGroups: [`sg.${spec.pattern}`],
    equipment: {
      allOf: (spec.allOf ?? []) as EquipmentId[],
      anyOf: (spec.anyOf ?? []) as (readonly EquipmentId[])[],
    },
    muscles: spec.muscles.map(([muscle, credit]) => ({
      muscle: muscle as MuscleId,
      credit,
      evidence: spec.evidence ?? 'C',
      source: 'src.powr-eb-mapping' as SourceId,
    })),
    load: {
      type: spec.type ?? 'barbell',
      curveClass: 'equation',
      unilateral: false,
      bodyweightLoaded: false,
    },
    defaults: {
      repRange: { hypertrophy: mechanics === 'compound' ? [6, 12] : [10, 15], strength: [3, 6] },
      restClass:
        spec.rest ?? (mechanics === 'compound' ? 'hypertrophyCompound' : 'hypertrophyIsolation'),
      tempo: '2-0-X-0',
      fixedRom: spec.lift !== undefined,
      stretchEmphasis: spec.stretch ?? false,
    },
    ranking: {
      overloadSuitability: spec.overload ?? 2,
      ...(spec.subRegions ? { subRegions: spec.subRegions as MuscleId[] } : {}),
      ...(spec.standard ? { standard: true } : {}),
    },
    cues: [{ en: 'Brace.' }, { en: 'Move with control.' }, { en: 'Finish the rep.' }],
    custom: false,
    status: 'active',
  };
}

const BARBELL = ['eq.barbell-olympic', 'eq.plates'];
const RACK = [['eq.power-rack', 'eq.squat-stand']];

export const LIBRARY: readonly ExerciseDef[] = [
  exercise('ex.back-squat', {
    pattern: 'squat',
    lift: 'squat',
    rest: 'strength',
    allOf: BARBELL,
    anyOf: RACK,
    stretch: true,
    overload: 3,
    evidence: 'H',
    muscles: [
      ['mu.quads.vasti', 1],
      ['mu.glutes.max', 0.5],
      ['mu.adductors', 0.5],
    ],
    subRegions: ['mu.quads.vasti'],
  }),
  exercise('ex.pause-squat', {
    pattern: 'squat',
    variantOf: 'ex.back-squat',
    rest: 'strength',
    allOf: BARBELL,
    anyOf: RACK,
    overload: 3,
    muscles: [
      ['mu.quads', 1],
      ['mu.glutes', 0.5],
    ],
  }),
  exercise('ex.goblet-squat', {
    pattern: 'squat',
    type: 'dumbbell',
    allOf: ['eq.dumbbells'],
    stretch: true,
    overload: 1,
    muscles: [
      ['mu.quads', 1],
      ['mu.glutes', 0.5],
    ],
  }),
  exercise('ex.leg-extension', {
    pattern: 'kneeExtension',
    mechanics: 'isolation',
    type: 'machine',
    allOf: ['eq.leg-extension'],
    overload: 3,
    muscles: [['mu.quads.rectus-femoris', 1]],
  }),
  exercise('ex.bench-press', {
    pattern: 'horizontalPush',
    lift: 'bench',
    rest: 'strength',
    allOf: [...BARBELL, 'eq.flat-bench'],
    overload: 3,
    evidence: 'H',
    muscles: [
      ['mu.chest', 1],
      ['mu.triceps', 0.5],
      ['mu.front-delts', 0.5],
    ],
  }),
  exercise('ex.dumbbell-press', {
    pattern: 'horizontalPush',
    type: 'dumbbell',
    allOf: ['eq.dumbbells', 'eq.flat-bench'],
    stretch: true,
    muscles: [
      ['mu.chest', 1],
      ['mu.triceps', 0.5],
      ['mu.front-delts', 0.5],
    ],
  }),
  exercise('ex.push-up', {
    pattern: 'horizontalPush',
    type: 'bodyweightAdded',
    overload: 1,
    muscles: [
      ['mu.chest', 1],
      ['mu.triceps', 0.5],
    ],
  }),
  exercise('ex.deadlift', {
    pattern: 'hinge',
    lift: 'deadlift',
    rest: 'strength',
    allOf: BARBELL,
    overload: 3,
    muscles: [
      ['mu.glutes', 1],
      ['mu.lower-back', 1],
      ['mu.hamstrings', 0.5],
      ['mu.quads', 0.5],
    ],
  }),
  exercise('ex.romanian-deadlift', {
    pattern: 'hinge',
    allOf: BARBELL,
    stretch: true,
    evidence: 'H',
    muscles: [
      ['mu.hamstrings', 1],
      ['mu.glutes', 0.5],
      ['mu.lower-back', 0.5],
    ],
  }),
  exercise('ex.leg-curl', {
    pattern: 'kneeFlexion',
    mechanics: 'isolation',
    type: 'machine',
    allOf: ['eq.seated-leg-curl'],
    stretch: true,
    overload: 3,
    evidence: 'H',
    muscles: [['mu.hamstrings', 1]],
  }),
  exercise('ex.dumbbell-row', {
    pattern: 'horizontalPull',
    type: 'dumbbell',
    allOf: ['eq.dumbbells'],
    muscles: [
      ['mu.lats', 1],
      ['mu.mid-back', 1],
      ['mu.elbow-flexors', 0.5],
      ['mu.rear-delts', 0.5],
    ],
  }),
  exercise('ex.pull-up', {
    pattern: 'verticalPull',
    type: 'bodyweightAdded',
    allOf: ['eq.pull-up-bar'],
    muscles: [
      ['mu.lats', 1],
      ['mu.elbow-flexors', 0.5],
    ],
  }),
  exercise('ex.dumbbell-curl', {
    pattern: 'elbowFlexion',
    mechanics: 'isolation',
    type: 'dumbbell',
    allOf: ['eq.dumbbells'],
    muscles: [['mu.elbow-flexors', 1]],
  }),
  exercise('ex.overhead-extension', {
    pattern: 'elbowExtension',
    mechanics: 'isolation',
    type: 'dumbbell',
    allOf: ['eq.dumbbells'],
    stretch: true,
    muscles: [['mu.triceps.long-head', 1]],
  }),
  exercise('ex.lateral-raise', {
    pattern: 'shoulderAbduction',
    mechanics: 'isolation',
    type: 'dumbbell',
    allOf: ['eq.dumbbells'],
    muscles: [['mu.side-delts', 1]],
  }),
  exercise('ex.calf-raise', {
    pattern: 'calf',
    mechanics: 'isolation',
    type: 'machine',
    allOf: ['eq.standing-calf-raise-machine'],
    muscles: [['mu.calves', 1]],
  }),
];

export const ALL_EQUIPMENT: ReadonlySet<string> = new Set(
  LIBRARY.flatMap((entry) => [...entry.equipment.allOf, ...entry.equipment.anyOf.flat()]),
);

export function lookup(id: ExerciseId): ExerciseDef | undefined {
  return LIBRARY.find((entry) => entry.id === id);
}

function slot(
  key: string,
  pattern: MovementPattern,
  targets: readonly string[],
  extra: Partial<TemplateSlot> = {},
): TemplateSlot {
  return {
    key,
    pattern,
    targets: targets as MuscleId[],
    priority: 'primary',
    goal: 'hypertrophy',
    mode: 'doubleProgression',
    ...extra,
  };
}

export const BB_TEMPLATE: TemplateDef = {
  id: 'tpl.test-bb-3day' as TemplateId,
  name: { en: 'Test full body' },
  description: { en: 'Test.' },
  style: 'bodybuilding',
  daysPerWeek: 3,
  split: 'fullBody',
  levels: ['novice', 'intermediate', 'advanced'],
  default: true,
  periodization: 'linear',
  progression: {
    main: 'doubleProgression',
    accessory: 'doubleProgression',
    novice: 'doubleProgression',
  },
  mesocycle: { accumulationWeeks: 5, deloadWeeks: 1, deloadRule: 'deload.content' },
  days: ['a', 'b', 'c'].map((key) => ({
    key,
    name: { en: `Day ${key}` },
    slots: [
      slot(`${key}.squat`, 'squat', ['mu.quads', 'mu.glutes']),
      slot(`${key}.press`, 'horizontalPush', ['mu.chest']),
      slot(`${key}.row`, 'horizontalPull', ['mu.lats', 'mu.mid-back']),
      slot(`${key}.hinge`, 'hinge', ['mu.hamstrings'], { priority: 'secondary' }),
      slot(`${key}.curl`, 'elbowFlexion', ['mu.elbow-flexors'], { priority: 'secondary' }),
      slot(`${key}.triceps`, 'elbowExtension', ['mu.triceps.long-head'], { priority: 'optional' }),
      slot(`${key}.calf`, 'calf', ['mu.calves'], { priority: 'optional' }),
    ],
  })),
};

const liftSlot = (
  key: string,
  lift: CompetitionLift,
  intensity: 'heavy' | 'moderate' | 'light',
): TemplateSlot =>
  slot(
    key,
    lift === 'squat' ? 'squat' : lift === 'bench' ? 'horizontalPush' : 'hinge',
    lift === 'bench' ? ['mu.chest'] : lift === 'squat' ? ['mu.quads'] : ['mu.glutes'],
    {
      lift,
      intensity,
      goal: 'strength',
      mode: intensity === 'heavy' ? 'topBackoff' : 'rpe',
      repRange: intensity === 'heavy' ? [1, 3] : [3, 5],
      effort: { rpe: intensity === 'light' ? [6, 7] : [8, 9] },
      ...(intensity === 'heavy'
        ? { backoff: { repRange: [3, 5] as const, effort: { rpe: [7, 8] as const } } }
        : {}),
      ...(intensity === 'light' ? { allowVariants: true, priority: 'secondary' as const } : {}),
    },
  );

export const PL_TEMPLATE: TemplateDef = {
  ...BB_TEMPLATE,
  id: 'tpl.test-pl-3day' as TemplateId,
  style: 'powerlifting',
  split: 'sbd',
  periodization: 'block',
  progression: { main: 'rpe', accessory: 'doubleProgression', novice: 'linear' },
  days: [
    {
      key: 'h',
      name: { en: 'Heavy' },
      slots: [
        liftSlot('h.squat', 'squat', 'heavy'),
        liftSlot('h.bench', 'bench', 'heavy'),
        slot('h.row', 'horizontalPull', ['mu.lats'], { goal: 'strength', priority: 'secondary' }),
      ],
    },
    {
      key: 'l',
      name: { en: 'Light' },
      slots: [
        liftSlot('l.deadlift', 'deadlift', 'heavy'),
        liftSlot('l.bench', 'bench', 'light'),
        liftSlot('l.squat', 'squat', 'light'),
      ],
    },
    {
      key: 'm',
      name: { en: 'Moderate' },
      slots: [
        liftSlot('m.squat', 'squat', 'moderate'),
        liftSlot('m.bench', 'bench', 'moderate'),
        liftSlot('m.deadlift', 'deadlift', 'light'),
      ],
    },
  ],
};

export const TEMPLATES: readonly TemplateDef[] = [BB_TEMPLATE, PL_TEMPLATE];

export function request(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    style: 'bodybuilding',
    level: 'intermediate',
    weekdays: [1, 3, 5] as IsoWeekday[],
    weekStartsOn: 1,
    sessionMinutes: null,
    equipment: ALL_EQUIPMENT,
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferred: [],
    recentVolume: [],
    variety: false,
    seed: 1,
    ...overrides,
  };
}

/** A plan slot for validation and schedule tests. */
export function planSlot(
  key: string,
  exerciseId: string,
  sets: number,
  extra: Partial<PlanSlot> = {},
): PlanSlot {
  const def = lookup(exerciseId as ExerciseId)!;
  return {
    key,
    exerciseId: def.id,
    pattern: def.pattern,
    targets: def.muscles.filter((credit) => credit.credit === 1).map((credit) => credit.muscle),
    priority: 'primary',
    goal: 'hypertrophy',
    prescription: { mode: 'doubleProgression', sets, repRange: [8, 12], rir: [1, 2] },
    progression: 'doubleProgression',
    restSeconds: 120,
    ...extra,
  };
}

export function day(key: string, weekday: IsoWeekday, slots: readonly PlanSlot[]): PlanDay {
  return { key, name: { en: key }, weekday, slots };
}
