import {
  ENGINE_VERSION,
  TRAINING_AGE_MONTHS,
  addDays,
  toLocalDate,
  type Baseline,
  type EquipmentProfile,
  type ExerciseDef,
  type ExerciseId,
  type InstantTz,
  type LocalDate,
  type Plan,
  type Profile,
  type ReadinessEntry,
} from '@powr/domain';
import { bodyweightTrend } from '@powr/domain/bodyweight';
import { implementFor } from '@powr/domain/equipment';
import { classifyTrainee } from '@powr/domain/progression';
import type { RuleSet, TraineeLevel } from '@powr/domain/rules';
import {
  DEFAULT_SESSION_PREFERENCES,
  derivationKey,
  type ExerciseEquipment,
  type ExerciseState,
  type SessionContext,
  type SessionPreferences,
} from '@powr/domain/session';
import type { SettingsRecord } from '@powr/formats';
import type { ParamOverride, ResolveContext } from '@powr/rules';

import type { Deps } from '../deps';

/*
 * What every session use case needs besides the session itself, prepared before any transaction
 * (rules resolve asynchronously, §8.2.4): the rules for the session and for every exercise
 * context, the trainee level, the session preferences, the equipment and the bodyweight trend.
 */

/** Session-core preferences from the settings record (defaults for what is not set). */
export function preferencesOf(settings: SettingsRecord | undefined): SessionPreferences {
  const stored = settings?.session;
  return {
    restAutoStart: stored?.restAutoStart ?? DEFAULT_SESSION_PREFERENCES.restAutoStart,
    restMode: stored?.restMode ?? DEFAULT_SESSION_PREFERENCES.restMode,
    readinessCheckIn: stored?.readinessCheckIn ?? DEFAULT_SESSION_PREFERENCES.readinessCheckIn,
    hintsOff: stored?.hintsOff ?? [],
    rounding: stored?.rounding ?? DEFAULT_SESSION_PREFERENCES.rounding,
    exercises: (stored?.exercises ?? []).map((entry) => ({
      ...entry,
      exerciseId: entry.exerciseId as ExerciseId,
    })),
  };
}

/** The current mesocycle of a plan (the active one, else the last). */
function currentLevel(plan: Plan | undefined): TraineeLevel | null {
  if (!plan) return null;
  const mesocycle =
    plan.mesocycles.find((entry) => entry.status === 'active') ?? plan.mesocycles.at(-1);
  return mesocycle?.level ?? null;
}

function exerciseContext(
  exercise: ExerciseDef,
  withId: boolean,
): NonNullable<ResolveContext['exercise']> {
  return {
    ...(withId ? { id: exercise.id } : {}),
    ...(exercise.competitionLift ? { competitionLift: exercise.competitionLift } : {}),
    restClass: exercise.defaults.restClass,
    pattern: exercise.pattern,
    mechanics: exercise.mechanics,
    curveClass: exercise.load.curveClass,
  };
}

function contextKey(exercise: ExerciseDef, withId: boolean): string {
  return [
    withId ? exercise.id : '-',
    exercise.competitionLift ?? '-',
    exercise.defaults.restClass,
    exercise.pattern,
    exercise.mechanics,
    exercise.load.curveClass,
  ].join('|');
}

interface RulesCache {
  readonly session: RuleSet;
  readonly byKey: ReadonlyMap<string, RuleSet>;
}

/** Resolved rule sets per deps, keyed by everything they depend on (versions, overrides, level). */
const RULES_CACHE = new WeakMap<Deps, Map<string, RulesCache>>();

async function resolveAll(
  deps: Deps,
  base: Omit<ResolveContext, 'exercise'>,
  overrides: readonly ParamOverride[],
): Promise<RulesCache> {
  const cacheKey = JSON.stringify([deps.rules.version, deps.content.version, base, overrides]);
  let perDeps = RULES_CACHE.get(deps);
  if (!perDeps) {
    perDeps = new Map();
    RULES_CACHE.set(deps, perDeps);
  }
  const cached = perDeps.get(cacheKey);
  if (cached) return cached;
  const named = new Set(overrides.flatMap((override) => override.exerciseId ?? []));
  const contexts = new Map<string, NonNullable<ResolveContext['exercise']>>();
  for (const exercise of deps.content.exercises()) {
    const withId = named.has(exercise.id);
    const key = contextKey(exercise, withId);
    if (!contexts.has(key)) contexts.set(key, exerciseContext(exercise, withId));
  }
  const session = (await deps.rules.resolve(base, overrides)).rules;
  const byKey = new Map<string, RuleSet>();
  await Promise.all(
    [...contexts].map(async ([key, exercise]) => {
      byKey.set(key, (await deps.rules.resolve({ ...base, exercise }, overrides)).rules);
    }),
  );
  const result: RulesCache = { session, byKey };
  perDeps.clear();
  perDeps.set(cacheKey, result);
  return result;
}

export interface Prepared {
  readonly rules: (id: ExerciseId | null) => RuleSet;
  readonly level: TraineeLevel;
  readonly preferences: SessionPreferences;
  readonly settings: SettingsRecord | undefined;
  readonly profile: Profile | undefined;
  readonly plan: Plan | undefined;
  readonly equipmentProfiles: readonly EquipmentProfile[];
  readonly bodyweightAt: (date: LocalDate) => number | null;
  readonly baseline: (id: ExerciseId) => Baseline | null;
  /** The derived-state fingerprint of an exercise (§8.2.8). */
  readonly keyOf: (id: ExerciseId) => string;
}

export async function prepare(deps: Deps): Promise<Prepared> {
  const loaded = await deps.uow.read(
    ['settings', 'profile', 'plans', 'equipmentProfiles', 'bodyweights'],
    async (repos) => ({
      settings: await repos.settings.get(),
      profile: await repos.profile.get(),
      plan: await repos.plans.getActive(),
      equipmentProfiles: await repos.equipment.list(),
      bodyweights: await repos.bodyweights.list(),
    }),
  );
  const { settings, profile, plan } = loaded;
  const style = profile?.style ?? plan?.style;
  const overrides = settings?.overrides ?? [];
  const sessionBase = style ? { style } : {};
  const unleveled = (await deps.rules.resolve(sessionBase, overrides)).rules;
  const level =
    profile?.levelOverride ??
    currentLevel(plan) ??
    (profile
      ? classifyTrainee(
          {
            trainingAgeMonths: TRAINING_AGE_MONTHS[profile.experience.trainingAge],
            slopePctPerWeek: null,
            weeksOfData: 0,
          },
          unleveled,
        ).value
      : 'intermediate');
  const cache = await resolveAll(deps, { ...sessionBase, level }, overrides);
  const named = new Set(overrides.flatMap((override) => override.exerciseId ?? []));
  const rules = (id: ExerciseId | null): RuleSet => {
    if (id === null) return cache.session;
    const exercise = deps.content.exercise(id);
    if (!exercise) return cache.session;
    return cache.byKey.get(contextKey(exercise, named.has(exercise.id))) ?? cache.session;
  };

  const trend = bodyweightTrend(
    loaded.bodyweights.map((entry) => ({ localDate: entry.localDate, mass: entry.mass })),
    cache.session,
  ).value;
  const bodyweightAt = (date: LocalDate): number | null => {
    let value: number | null = null;
    for (const point of trend) {
      if (point.localDate > date) break;
      value = point.trendKg ?? point.rawKg;
    }
    return value;
  };
  const bodyweightDigest = `${loaded.bodyweights.length}:${loaded.bodyweights.reduce(
    (latest, entry) => Math.max(latest, entry.measuredAt.epochMs),
    0,
  )}`;
  const baselines = new Map((profile?.baselines ?? []).map((entry) => [entry.exerciseId, entry]));
  const base = {
    engine: ENGINE_VERSION,
    rules: deps.rules.version,
    content: deps.content.version,
    overrides,
    level,
  };
  return {
    rules,
    level,
    preferences: preferencesOf(settings),
    settings,
    profile,
    plan,
    equipmentProfiles: loaded.equipmentProfiles,
    bodyweightAt,
    baseline: (id) => baselines.get(id) ?? null,
    keyOf: (id) =>
      derivationKey({
        ...base,
        baseline: baselines.get(id) ?? null,
        bodyweight: deps.content.exercise(id)?.load.bodyweightLoaded ? bodyweightDigest : null,
      }),
  };
}

/** The equipment profile a session uses: its own, the plan's, else the default one. */
export function equipmentProfileFor(
  prepared: Prepared,
  id: string | null | undefined,
): EquipmentProfile | undefined {
  const profiles = prepared.equipmentProfiles;
  return (
    profiles.find((entry) => entry.id === id) ??
    profiles.find((entry) => entry.id === prepared.plan?.equipmentProfileId) ??
    profiles.find((entry) => entry.isDefault)
  );
}

/** The reducer's context for one event. */
export function sessionContext(
  deps: Deps,
  prepared: Prepared,
  input: {
    readonly now: InstantTz;
    readonly ids: readonly string[];
    readonly states: readonly ExerciseState[];
    readonly readiness: readonly ReadinessEntry[];
    readonly equipmentProfileId: string | null;
  },
): SessionContext {
  const states = new Map(input.states.map((state) => [state.exerciseId, state]));
  const profile = equipmentProfileFor(prepared, input.equipmentProfileId);
  const catalog = deps.content.equipment().items;
  const equipmentCache = new Map<ExerciseId, ExerciseEquipment>();
  return {
    now: input.now,
    ids: input.ids,
    exercise: (id) => deps.content.exercise(id),
    rules: prepared.rules,
    equipment: (id) => {
      const cached = equipmentCache.get(id);
      if (cached) return cached;
      const exercise = deps.content.exercise(id);
      const implement = exercise && profile ? implementFor(exercise, profile, catalog) : null;
      const equipment: ExerciseEquipment = {
        implement,
        ...(exercise?.load.bodyweightLoaded && implement
          ? { bodyweight: { added: implement } }
          : {}),
        mode: prepared.preferences.rounding,
      };
      equipmentCache.set(id, equipment);
      return equipment;
    },
    history: (id) => states.get(id) ?? null,
    bodyweightKg: prepared.bodyweightAt(toLocalDate(input.now)),
    level: prepared.level,
    preferences: prepared.preferences,
    readiness: input.readiness,
  };
}

/** The readiness check-ins of the RDY-02 baseline window before `today`. */
export function readinessWindow(
  prepared: Prepared,
  today: LocalDate,
): readonly [LocalDate, LocalDate] {
  const days = prepared.rules(null)['monitoring.readiness.baseline'].value.windowDays;
  return [addDays(today, -days), today];
}

/** IDs for one event (the reducer consumes them in order). */
export function idPool(deps: Deps, size = 64): string[] {
  return Array.from({ length: size }, () => deps.ids.next());
}
