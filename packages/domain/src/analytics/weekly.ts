import { curvePct } from '../e1rm/curves';
/**
 * The derived week (table `dWeekly`, technical concept §8.2.2, TD-43): per user week, the
 * fractional and direct hard sets per muscle (the EXL-05 crediting of `@powr/domain/volume`,
 * techniques included, so it equals the session summaries and the plan editor: ANL-03 "one
 * calculation"), the sets each exercise contributed (MAP-04 drill-down), per competition lift
 * the heavy sets and the tonnage (PLN-03), the sessions and minutes trained, the planned
 * sessions by status, the deload flag, the break days and the plan's targets in force.
 * A week belongs to its session's day, not to each set's (a session past midnight stays whole).
 */
import { effectiveReps } from '../e1rm/effort';
import type { ExerciseId, LocalDate, MuscleId, SessionId } from '../ids';
import type {
  CompetitionLift,
  ExerciseDef,
  LiftTarget,
  LoggedSet,
  MuscleTarget,
  PlanId,
  PlannedSession,
  Session,
  TrainingBreak,
} from '../model';
import { liftOf } from '../planning/credits';
import type { RuleSet } from '../rules';
import { countsForStreak, breakDaysIn } from '../streaks';
import { toKg } from '../units';
import { isHardSet, muscleVolume, setCredit } from '../volume';

/** Bump when the weekly record's meaning changes (part of every week's key). */
export const WEEKLY_VERSION = 1;

export interface WeeklyMuscle {
  readonly muscle: MuscleId;
  readonly fractional: number;
  readonly direct: number;
}

export interface WeeklyExercise {
  readonly exerciseId: ExerciseId;
  /** Credited hard sets (Σ set credit, techniques included). */
  readonly sets: number;
  /** Done working sets, hard or not. */
  readonly workingSets: number;
  /** Σ external load × reps of the working sets, kg. */
  readonly volumeKg: number;
}

export interface WeeklyLift {
  readonly lift: CompetitionLift;
  /** PLN-03 heavy sets: hard sets of the lift or a close variant at ≥ 80% 1RM and ≤ 6 reps. */
  readonly heavySets: number;
  /** Done working sets of the lift and its close variants. */
  readonly sets: number;
  readonly tonnageKg: number;
}

export interface WeeklySessions {
  readonly finished: number;
  readonly partial: number;
  /** MOT-03: finished, or partial with enough working sets. */
  readonly counting: number;
  /** Minutes of the finished and partial sessions. */
  readonly minutes: number;
  readonly ids: readonly SessionId[];
}

export interface WeeklyPlanned {
  /** Planned sessions that ask to be done: planned, done or skipped. */
  readonly asked: number;
  readonly done: number;
  readonly skipped: number;
  readonly open: number;
  readonly onBreak: number;
  readonly merged: number;
  readonly deload: boolean;
}

/** The plan's weekly targets in force that week (PLN-03). */
export interface WeeklyTargets {
  readonly planId: PlanId;
  readonly mesocycleIndex: number;
  readonly muscles: readonly MuscleTarget[];
  readonly lifts: readonly LiftTarget[];
}

/** One user week (table `dWeekly`, key `weekStart`). */
export interface WeeklyRecord {
  readonly weekStart: LocalDate;
  /** Fingerprint of everything the week was built from (versions, settings, its raw records). */
  readonly key: string;
  readonly muscles: readonly WeeklyMuscle[];
  readonly exercises: readonly WeeklyExercise[];
  readonly lifts: readonly WeeklyLift[];
  readonly sessions: WeeklySessions;
  readonly planned: WeeklyPlanned;
  readonly breakDays: number;
  readonly targets: WeeklyTargets | null;
}

export interface WeekSessionInput {
  readonly session: Session;
  readonly sets: readonly LoggedSet[];
}

export interface WeekInput {
  readonly weekStart: LocalDate;
  readonly key: string;
  /** The week's sessions (any status; only finished and partial ones count). */
  readonly sessions: readonly WeekSessionInput[];
  readonly planned: readonly PlannedSession[];
  readonly breaks: readonly Pick<TrainingBreak, 'startDate' | 'endDate'>[];
  readonly targets: WeeklyTargets | null;
}

export interface WeeklyContext {
  readonly exercise: (id: ExerciseId) => ExerciseDef | undefined;
  /** The session-level rules (volume) and an exercise's rules (its load–rep curve). */
  readonly rules: (id: ExerciseId | null) => RuleSet;
}

const COUNTED: ReadonlySet<Session['status']> = new Set(['finished', 'partial']);

/** Builds one week's record (pure; the same inputs give the same record). */
export function buildWeek(input: WeekInput, ctx: WeeklyContext): WeeklyRecord {
  const sessionRules = ctx.rules(null);
  const sessions = input.sessions
    .filter((entry) => COUNTED.has(entry.session.status))
    .toSorted((a, b) => compare(a.session.id, b.session.id));
  const done = sessions.flatMap((entry) => entry.sets.filter((set) => set.state === 'done'));

  const volume = muscleVolume(done, (id) => ctx.exercise(id)?.muscles, sessionRules).value;
  const muscles: WeeklyMuscle[] = [...volume].map(([muscle, entry]) => ({
    muscle,
    fractional: entry.fractional,
    direct: entry.direct,
  }));

  const exercises = new Map<ExerciseId, { sets: number; workingSets: number; volumeKg: number }>();
  const lifts = new Map<CompetitionLift, { heavySets: number; sets: number; tonnageKg: number }>();
  for (const set of done) {
    if (set.type === 'warmup') continue;
    const exercise = ctx.exercise(set.exerciseId);
    const entry = exercises.get(set.exerciseId) ?? { sets: 0, workingSets: 0, volumeKg: 0 };
    const loadKg = set.load ? toKg(set.load) : 0;
    const volumeKg = loadKg > 0 && set.reps !== null ? loadKg * set.reps : 0;
    entry.sets += setCredit(set, sessionRules).value;
    entry.workingSets += 1;
    entry.volumeKg += volumeKg;
    exercises.set(set.exerciseId, entry);
    const lift = exercise ? liftOf(exercise, ctx.exercise) : undefined;
    if (!exercise || lift === undefined) continue;
    const liftEntry = lifts.get(lift) ?? { heavySets: 0, sets: 0, tonnageKg: 0 };
    liftEntry.sets += 1;
    liftEntry.tonnageKg += volumeKg;
    if (isHeavySet(set, exercise, ctx.rules(set.exerciseId))) liftEntry.heavySets += 1;
    lifts.set(lift, liftEntry);
  }

  let minutes = 0;
  let counting = 0;
  let finished = 0;
  let partial = 0;
  for (const { session, sets } of sessions) {
    if (session.status === 'finished') finished++;
    else partial++;
    if (countsForStreak(session, sets, sessionRules)) counting++;
    if (session.endedAt) {
      minutes += Math.max(0, session.endedAt.epochMs - session.startedAt.epochMs) / 60_000;
    }
  }

  const status = (wanted: PlannedSession['status']) =>
    input.planned.filter((entry) => entry.status === wanted).length;
  const planned: WeeklyPlanned = {
    asked: status('planned') + status('done') + status('skipped'),
    done: status('done'),
    skipped: status('skipped'),
    open: status('planned'),
    onBreak: status('onBreak'),
    merged: status('merged'),
    deload: input.planned.some((entry) => entry.kind === 'deload' && entry.status !== 'merged'),
  };

  return {
    weekStart: input.weekStart,
    key: input.key,
    muscles,
    exercises: [...exercises]
      .map(([exerciseId, entry]) => ({ exerciseId, ...entry }))
      .toSorted((a, b) => compare(a.exerciseId, b.exerciseId)),
    lifts: [...lifts]
      .map(([lift, entry]) => ({ lift, ...entry }))
      .toSorted((a, b) => compare(a.lift, b.lift)),
    sessions: {
      finished,
      partial,
      counting,
      minutes: Math.round(minutes),
      ids: sessions.map((entry) => entry.session.id),
    },
    planned,
    breakDays: breakDaysIn(input.weekStart, input.breaks),
    targets: input.targets,
  };
}

/**
 * PLN-03 heavy set: a hard working set at ≤ `maxReps` reps whose load is at least `minPct1rm` of
 * the 1RM it implies, read off the exercise's load–rep curve at reps + RIR (the unknown-effort
 * prior RIR when no effort was entered, E-1).
 */
export function isHeavySet(set: LoggedSet, exercise: ExerciseDef, rules: RuleSet): boolean {
  if (set.state !== 'done' || set.type === 'warmup' || set.type === 'timed') return false;
  if (set.reps === null || set.reps < 1 || !isHardSet(set, rules)) return false;
  const { minPct1rm, maxReps } = rules['volume.strength.heavySet'].value;
  if (set.reps > maxReps) return false;
  const rir =
    set.effort.source === 'entered' && set.effort.rir !== null
      ? set.effort.rir
      : rules['load.unknownEffort.priorRirDefault'].value;
  const pct = curvePct(exercise.load.curveClass, effectiveReps(set.reps, rir, rules), rules);
  return pct !== null && pct * 100 >= minPct1rm - 1e-9;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
