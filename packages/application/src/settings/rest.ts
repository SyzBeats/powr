import type { EvidenceTag, ExerciseId, SourceId } from '@powr/domain';
import type { SettingsRecord } from '@powr/formats';
import type { ResolveContext } from '@powr/rules';

import type { Deps } from '../deps';
import { traineeLevel } from '../planning/context';
import { err, ok, type Result } from '../result';
import { changeSettings } from './preferences';

/** SET-03 / TMR-02: the rest times the user can set, one per context, in the table's order. */
export const REST_PARAMS = [
  'session.rest.strength',
  'session.rest.hypertrophyCompound',
  'session.rest.hypertrophyIsolation',
  'session.rest.timeSaver',
  'session.rest.supersetTransition',
  'session.rest.warmupLight',
  'session.rest.warmupBeforeWork',
] as const;
export type RestParamId = (typeof REST_PARAMS)[number];

/** Longest rest a user can set (30 min, as "remember for this exercise", TMR-03). */
export const MAX_REST_SECONDS = 1800;

export function isRestParam(id: string): id is RestParamId {
  return (REST_PARAMS as readonly string[]).includes(id);
}

/** One rest time as Settings shows it: the evidence default, the user's value and why. */
export interface RestTime {
  readonly id: RestParamId;
  /** What applies now (the user's value, else the evidence default), seconds. */
  readonly seconds: number;
  /** The evidence default for the user's style and level (§8.6.3), seconds. */
  readonly evidenceDefault: number;
  /** The default for the competition squat and deadlift where it differs (strength: 4:00). */
  readonly competitionDefault: number | null;
  /** True when the user set it. */
  readonly own: boolean;
  /** The user's value is outside the range the evidence supports (accepted with a note). */
  readonly outOfRange: boolean;
  readonly evidence: readonly EvidenceTag[];
  readonly sources: readonly SourceId[];
  readonly verified: boolean;
}

/** A rest remembered for one exercise (TMR-03), listed so it can be reset too. */
export interface ExerciseRest {
  readonly exerciseId: ExerciseId;
  readonly paramId: string;
  readonly seconds: number;
}

/** The context the defaults are resolved for: the profile's style and level, as the session does. */
export async function restContext(deps: Deps): Promise<ResolveContext> {
  const { profile, plan } = await deps.uow.read(['profile', 'plans'], async (repos) => ({
    profile: await repos.profile.get(),
    plan: await repos.plans.getActive(),
  }));
  const style = profile?.style ?? plan?.style;
  const base = style ? { style } : {};
  if (!profile) return base;
  const unleveled = (await deps.rules.resolve(base)).rules;
  return { ...base, level: traineeLevel(profile, unleveled).value };
}

/**
 * SET-03: every rest time with its evidence default for the user's situation and the user's own
 * value, plus the rests remembered per exercise. Values come from the resolver with the stored
 * overrides, so Settings shows exactly what a workout will use.
 */
export async function restTimes(deps: Deps): Promise<{
  readonly times: readonly RestTime[];
  readonly exercises: readonly ExerciseRest[];
}> {
  const context = await restContext(deps);
  const settings = await deps.uow.read(['settings'], (repos) => repos.settings.get());
  const overrides = settings?.overrides ?? [];
  const global = overrides.filter((entry) => entry.exerciseId === undefined);
  const [current, competition] = await Promise.all([
    deps.rules.resolve(context, global),
    deps.rules.resolve({ ...context, exercise: { competitionLift: 'squat' } }),
  ]);
  const times = REST_PARAMS.map((id): RestTime => {
    const param = current.rules[id];
    const evidenceDefault = param.meta.defaultValue as number;
    const competitionValue = competition.rules[id].value;
    return {
      id,
      seconds: param.value,
      evidenceDefault,
      competitionDefault: competitionValue === evidenceDefault ? null : competitionValue,
      own: param.meta.origin === 'user',
      outOfRange: param.meta.outOfRange,
      evidence: param.meta.evidence,
      sources: param.meta.sources,
      verified: param.meta.verified,
    };
  });
  const exercises = overrides.flatMap((entry): ExerciseRest[] =>
    entry.exerciseId !== undefined &&
    entry.paramId.startsWith('session.rest.') &&
    typeof entry.value === 'number'
      ? [
          {
            exerciseId: entry.exerciseId as ExerciseId,
            paramId: entry.paramId,
            seconds: entry.value,
          },
        ]
      : [],
  );
  return { times, exercises };
}

export type RestTimeError = { readonly kind: 'unknownParam' } | { readonly kind: 'invalidSeconds' };

/**
 * SET-03: sets one rest time for every workout from now on (a global override, §8.6.3). A value
 * equal to the evidence default removes the override, so a later registry update still reaches
 * the user. Values outside the evidence range are accepted (TMR-02); `restTimes` flags them.
 */
export async function setRestTime(
  deps: Deps,
  input: { readonly paramId: string; readonly seconds: number },
): Promise<Result<void, RestTimeError>> {
  if (!isRestParam(input.paramId)) return err({ kind: 'unknownParam' });
  const { seconds } = input;
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_REST_SECONDS)
    return err({ kind: 'invalidSeconds' });
  const context = await restContext(deps);
  const evidenceDefault = (await deps.rules.resolve(context)).rules[input.paramId].value;
  await changeSettings(deps, (settings) => {
    const others = (settings.overrides ?? []).filter(
      (entry) => !(entry.paramId === input.paramId && entry.exerciseId === undefined),
    );
    const next: NonNullable<SettingsRecord['overrides']> =
      seconds === evidenceDefault
        ? others
        : [...others, { paramId: input.paramId, value: seconds }];
    return { ...settings, overrides: next };
  });
  return ok(undefined);
}

/**
 * SET-03 "reset everything to evidence defaults": removes the user's rest times, and with
 * `exercises` also the rests remembered per exercise (TMR-03). Other overrides stay.
 */
export async function resetRestTimes(
  deps: Deps,
  input: { readonly exercises: boolean },
): Promise<{ readonly removed: number }> {
  let removed = 0;
  await changeSettings(deps, (settings) => {
    const kept = (settings.overrides ?? []).filter((entry) => {
      const rest = entry.exerciseId === undefined ? isRestParam(entry.paramId) : input.exercises;
      const drop = rest && entry.paramId.startsWith('session.rest.');
      if (drop) removed += 1;
      return !drop;
    });
    return { ...settings, overrides: kept };
  });
  return { removed };
}

/** TMR-03: forgets the rest remembered for one exercise (it follows the defaults again). */
export async function resetExerciseRest(deps: Deps, exerciseId: ExerciseId): Promise<void> {
  await changeSettings(deps, (settings) => ({
    ...settings,
    overrides: (settings.overrides ?? []).filter(
      (entry) => !(entry.exerciseId === exerciseId && entry.paramId.startsWith('session.rest.')),
    ),
  }));
}
