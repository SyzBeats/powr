import {
  ENGINE_VERSION,
  TRAINING_AGE_MONTHS,
  toLocalDate,
  type AvoidList,
  type EquipmentProfile,
  type ExerciseDef,
  type ExerciseId,
  type IsoWeekday,
  type LocalDate,
  type MuscleId,
  type Profile,
  type RecentVolume,
  type TemplateId,
  type TrainingStyle,
  type VersionStamp,
} from '@powr/domain';
import { itemsOf } from '@powr/domain/equipment';
import type { Explained } from '@powr/domain/explain';
import type { PlanRequest, PlanningCatalog, RestRules } from '@powr/domain/planning';
import { classifyTrainee } from '@powr/domain/progression';
import type { RuleSet, SexReference, TraineeLevel } from '@powr/domain/rules';
import type { ParamOverride, ResolveContext } from '@powr/rules';

import type { Deps } from '../deps';

/** What plan generation needs from the user (onboarding answers or the stored profile). */
export interface PlanningAnswers {
  readonly style: TrainingStyle;
  readonly experience: Profile['experience'];
  readonly levelOverride: TraineeLevel | null;
  readonly referenceSet: SexReference | null;
  readonly schedule: {
    readonly weekdays: readonly IsoWeekday[];
    /** Minutes; null = "90+" (ONB-05). */
    readonly sessionMinutes: number | null;
  };
  readonly equipment: EquipmentProfile;
  readonly priorities: readonly MuscleId[];
  readonly avoid: AvoidList;
  readonly preferredExercises: readonly ExerciseId[];
}

/** The planning answers of a stored profile, its equipment profile and the plan's schedule. */
export function answersFromProfile(
  profile: Profile,
  equipment: EquipmentProfile,
  schedule: PlanningAnswers['schedule'],
): PlanningAnswers {
  return {
    style: profile.style,
    experience: profile.experience,
    levelOverride: profile.levelOverride,
    referenceSet: profile.referenceSet,
    schedule,
    equipment,
    priorities: profile.priorities,
    avoid: profile.avoid,
    preferredExercises: profile.preferredExercises,
  };
}

/**
 * PRG-10: the user's own level label if set, else the classification from the training age
 * (the observed e1RM slope takes over once ≥ 8 weeks of data exist: `slopePctPerWeek`).
 */
export function traineeLevel(
  answers: Pick<PlanningAnswers, 'levelOverride' | 'experience'>,
  rules: RuleSet,
  slope: { readonly slopePctPerWeek: number | null; readonly weeksOfData: number } = {
    slopePctPerWeek: null,
    weeksOfData: 0,
  },
): Explained<TraineeLevel> {
  const classified = classifyTrainee(
    { trainingAgeMonths: TRAINING_AGE_MONTHS[answers.experience.trainingAge], ...slope },
    rules,
  );
  return answers.levelOverride ? { value: answers.levelOverride, why: classified.why } : classified;
}

/** The user's parameter overrides from settings (§8.6.3). */
export async function userOverrides(deps: Deps): Promise<readonly ParamOverride[]> {
  const settings = await deps.uow.read(['settings'], (repos) => repos.settings.get());
  return settings?.overrides ?? [];
}

/** The planner's rules for a level and style, plus the rest rules per exercise context. */
export async function planningRules(
  deps: Deps,
  context: ResolveContext,
): Promise<{ readonly rules: RuleSet; readonly restRules: (exercise: ExerciseDef) => RestRules }> {
  const overrides = await userOverrides(deps);
  const { rules } = await deps.rules.resolve(context, overrides);
  // Rest times have exercise variants (4:00 for the competition squat and deadlift, TMR-02).
  const byContext = new Map<string, RestRules>();
  const contexts = new Map<string, ResolveContext['exercise']>();
  for (const exercise of deps.content.exercises()) {
    const key = exerciseContextKey(exercise);
    if (!contexts.has(key)) contexts.set(key, exerciseContext(exercise));
  }
  await Promise.all(
    [...contexts].map(async ([key, exercise]) => {
      const resolved = await deps.rules.resolve(
        { ...context, ...(exercise ? { exercise } : {}) },
        overrides,
      );
      byContext.set(key, resolved.rules);
    }),
  );
  return { rules, restRules: (exercise) => byContext.get(exerciseContextKey(exercise)) ?? rules };
}

/** The rules for one exercise (its curve class, rest class and lift), with the user's overrides. */
export async function exerciseRules(
  deps: Deps,
  context: Omit<ResolveContext, 'exercise'>,
  exercise: ExerciseDef,
): Promise<RuleSet> {
  const overrides = await userOverrides(deps);
  return (await deps.rules.resolve({ ...context, exercise: exerciseContext(exercise) }, overrides))
    .rules;
}

function exerciseContext(exercise: ExerciseDef): NonNullable<ResolveContext['exercise']> {
  return {
    ...(exercise.competitionLift ? { competitionLift: exercise.competitionLift } : {}),
    restClass: exercise.defaults.restClass,
    pattern: exercise.pattern,
    mechanics: exercise.mechanics,
    curveClass: exercise.load.curveClass,
  };
}

function exerciseContextKey(exercise: ExerciseDef): string {
  return [
    exercise.competitionLift ?? '-',
    exercise.defaults.restClass,
    exercise.pattern,
    exercise.mechanics,
    exercise.load.curveClass,
  ].join('|');
}

/** The content the planner chooses from. */
export function planningCatalog(
  deps: Deps,
  restRules?: (exercise: ExerciseDef) => RestRules,
): PlanningCatalog {
  return {
    exercises: deps.content.exercises(),
    templates: deps.content.templates(),
    ...(restRules ? { restRules } : {}),
  };
}

export interface PlanOptions {
  /** PLN-02 override: a template of the user's style and days. */
  readonly templateId?: TemplateId;
  /** PLN-08: 3–8 accumulation weeks. */
  readonly accumulationWeeks?: number;
  /** PLN-05 opt-in variety mode. */
  readonly variety?: boolean;
  readonly seed?: number;
  /** Week start (SET-11); default from settings, else Monday. */
  readonly weekStartsOn?: IsoWeekday;
}

/** The generator's request from the answers and options (PLN-01 inputs). */
export function planRequest(
  answers: PlanningAnswers,
  level: TraineeLevel,
  options: PlanOptions,
  weekStartsOn: IsoWeekday,
): PlanRequest {
  const recentVolume: readonly RecentVolume[] = answers.experience.recentVolume;
  return {
    style: answers.style,
    level,
    weekdays: answers.schedule.weekdays,
    weekStartsOn,
    sessionMinutes: answers.schedule.sessionMinutes,
    equipment: itemsOf(answers.equipment),
    priorities: answers.priorities,
    avoid: answers.avoid,
    preferred: answers.preferredExercises,
    recentVolume,
    ...(options.templateId !== undefined ? { templateId: options.templateId } : {}),
    ...(options.accumulationWeeks !== undefined
      ? { accumulationWeeks: options.accumulationWeeks }
      : {}),
    variety: options.variety ?? false,
    seed: options.seed ?? 0,
  };
}

/** The user's week start (SET-11): settings, else Monday. */
export async function weekStart(deps: Deps): Promise<IsoWeekday> {
  const settings = await deps.uow.read(['settings'], (repos) => repos.settings.get());
  return (settings?.weekStart ?? 1) as IsoWeekday;
}

/** Versions an output was computed with (PRG-18), with the hashed rules version (TD-31). */
export function versionStamp(deps: Deps): VersionStamp {
  return { engine: ENGINE_VERSION, rules: deps.rules.version, content: deps.content.version };
}

/** Today in the device's zone. */
export function today(deps: Deps): LocalDate {
  return toLocalDate(deps.clock.now());
}

/** A content exercise lookup. */
export function exerciseLookup(deps: Deps): (id: ExerciseId) => ExerciseDef | undefined {
  return (id) => deps.content.exercise(id);
}
