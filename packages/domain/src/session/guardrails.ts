/**
 * In-session guardrails (WKT-16; EB §Volume › Per-session returns, › Proximity to failure;
 * §Session › Tempo, › Rest). Non-blocking hints after a set, each of which the user can turn off:
 * a muscle's fractional sets in this session above the per-session soft cap (~11 fractional or 8
 * direct, "consider another day"); RIR 0 on a heavy free-weight compound (barbell squat or hinge,
 * or a heavy barbell press: failure adds 24–48 h of recovery and no strength benefit); rest below
 * 2:00 on a competition lift; reps slower than 8–10 s each.
 */
import { explain } from '../explain';
import type { ExerciseId, MuscleId } from '../ids';
import type { LoggedSet, SessionExercise } from '../model';
import { checkSessionVolume, muscleVolume, type MuscleVolume } from '../volume';
import { sortSets } from './history';
import { parseTempo, tempoRepSeconds } from './timers';
import type { Guardrail, SessionContext, SessionState } from './types';

/** Display groups only ('mu.chest', not 'mu.chest.upper'). */
const isGroup = (muscle: MuscleId) => muscle.split('.').length === 2;

/** Fractional and direct sets per muscle group of the session's done sets (WKT-04 credits). */
export function sessionMuscleVolume(
  state: SessionState,
  ctx: SessionContext,
): ReadonlyMap<MuscleId, MuscleVolume> {
  const creditsOf = (id: ExerciseId) => ctx.exercise(id)?.muscles;
  const volume = muscleVolume(
    state.sets.filter((set) => set.state === 'done'),
    creditsOf,
    ctx.rules(null),
  ).value;
  return new Map([...volume].filter(([muscle]) => isGroup(muscle)));
}

/** The hints a newly logged set raises. */
export function setGuardrails(
  before: SessionState,
  after: SessionState,
  set: LoggedSet,
  slot: SessionExercise,
  ctx: SessionContext,
): Guardrail[] {
  const off = new Set(ctx.preferences.hintsOff);
  const exercise = ctx.exercise(set.exerciseId);
  if (!exercise || set.state !== 'done' || set.type === 'warmup') return [];
  const rules = ctx.rules(set.exerciseId);
  const hints: Guardrail[] = [];

  if (!off.has('sessionVolume')) {
    const sessionRules = ctx.rules(null);
    const was = sessionMuscleVolume(before, ctx);
    for (const [muscle, volume] of sessionMuscleVolume(after, ctx)) {
      const check = checkSessionVolume(volume, sessionRules);
      const previous = was.get(muscle);
      if (check.value && !(previous && checkSessionVolume(previous, sessionRules).value)) {
        hints.push({ kind: 'sessionVolume', slotKey: slot.key, muscle, why: check.why });
      }
    }
  }

  const rir = set.effort.source === 'entered' ? set.effort.rir : null;
  const failure = rir === 0 || set.flags?.failure === true;
  if (
    !off.has('failure') &&
    failure &&
    exercise.mechanics === 'compound' &&
    exercise.load.type === 'barbell'
  ) {
    const strength = rules['volume.repRange.strength'];
    const heavy =
      exercise.pattern === 'squat' ||
      exercise.pattern === 'hinge' ||
      (exercise.pattern === 'horizontalPush' &&
        set.reps !== null &&
        set.reps <= strength.value.main.max);
    if (heavy) {
      const spacing = rules['monitoring.spacing'];
      hints.push({
        kind: 'failure',
        slotKey: slot.key,
        why: explain('guardrail.failure', {
          args: {
            extraHoursMin: spacing.value.failureHours.min - spacing.value.nonFailureHours.min,
            extraHoursMax: spacing.value.failureHours.max - spacing.value.nonFailureHours.min,
          },
          params: [spacing, strength],
        }),
      });
    }
  }

  const minimum = rules['session.rest.competitionMinimum'];
  if (
    !off.has('shortRest') &&
    (exercise.competitionLift !== undefined || slot.lift !== undefined) &&
    set.restBeforeMs !== undefined &&
    set.restBeforeMs < minimum.value * 1000
  ) {
    const previous = sortSets(
      before.sets.filter((other) => other.state === 'done' && other.id !== set.id),
    ).at(-1);
    if (previous && previous.slotKey === slot.key && previous.type !== 'warmup') {
      hints.push({
        kind: 'shortRest',
        slotKey: slot.key,
        why: explain('guardrail.shortRest', {
          args: { restSeconds: Math.round(set.restBeforeMs / 1000), minimum: minimum.value },
          params: [minimum],
        }),
      });
    }
  }

  const limit = rules['session.tempo.warnRepSeconds'];
  if (!off.has('slowReps')) {
    const tempo = parseTempo(exercise.defaults.tempo);
    const measured =
      set.durationMs !== undefined && set.reps !== null && set.reps > 0
        ? set.durationMs / 1000 / set.reps
        : null;
    const repSeconds = measured ?? (tempo ? tempoRepSeconds(tempo) : null);
    if (repSeconds !== null && repSeconds > limit.value) {
      hints.push({
        kind: 'slowReps',
        slotKey: slot.key,
        why: explain('guardrail.slowReps', {
          args: { repSeconds: Math.round(repSeconds * 10) / 10, limit: limit.value },
          params: [limit],
        }),
      });
    }
  }
  return hints;
}
