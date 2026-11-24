/**
 * Read models of a session for the screens (WKT-02, WKT-13, TMR-11): the session view with
 * every planned set, its logged record or its suggestion, the last-time panel, the timer and the
 * clock with the estimated remaining time (PLN-14); and the summary at the end.
 */
import type { Explained } from '../explain';
import type { ExerciseId, MuscleId } from '../ids';
import type {
  LoggedSet,
  PlannedSet,
  Session,
  SessionChange,
  SessionExercise,
  TimerState,
} from '../model';
import type { InstantTz } from '../time';
import { labelChange, type ChangeLabel } from '../trend';
import { sessionMuscleVolume } from './guardrails';
import {
  calibrationStatus,
  currentE1rm,
  emptyExerciseState,
  foldExposure,
  type CalibrationStatus,
  type ExposureSummary,
} from './history';
import { sessionPrs } from './live';
import type { PrRecord } from './prs';
import { restSecondsFor } from './reduce';
import { exerciseSetsOf, groupOf, isWorking, loggedOf } from './slots';
import { suggestSet } from './suggest';
import { STALE_SESSION_MS, sessionElapsedMs, timerView, type TimerView } from './timers';
import type { SessionContext, SessionState, SetSuggestion } from './types';

export interface PlannedSetView {
  readonly set: PlannedSet;
  readonly status: 'pending' | 'done' | 'skipped';
  readonly logged: LoggedSet | null;
  /** Pending sets: the pre-filled values with "Why?" (PRG-03). */
  readonly suggestion: Explained<SetSuggestion> | null;
  readonly prs: readonly PrRecord[];
}

export interface ExerciseView {
  readonly slot: SessionExercise;
  readonly groupKey: string | null;
  readonly sets: readonly PlannedSetView[];
  /** WKT-02 "last time" with its note (WKT-10). */
  readonly lastTime: ExposureSummary | null;
  readonly calibration: CalibrationStatus;
  readonly e1rmKg: number | null;
  /** ONB-08: the starting e1RM came from a 1RM older than 3 months (refined from logged sets). */
  readonly baselineOld: boolean;
}

export interface MuscleVolumeRow {
  readonly muscle: MuscleId;
  readonly fractional: number;
  readonly direct: number;
}

export interface SessionView {
  readonly session: Session;
  readonly exercises: readonly ExerciseView[];
  /** M0 quick-log sets without a slot. */
  readonly unslotted: readonly LoggedSet[];
  readonly current: Explained<SetSuggestion> | null;
  readonly timer: { readonly state: TimerState; readonly view: TimerView } | null;
  /** TMR-11: elapsed time and the estimated remaining time (PLN-14). */
  readonly clock: { readonly elapsedMs: number; readonly remainingS: number };
  readonly prs: readonly PrRecord[];
  readonly volume: readonly MuscleVolumeRow[];
  /** WKT-14: open for more than 6 hours ("Finish session at last logged set?"). */
  readonly stale: boolean;
  readonly undo: { readonly token: string; readonly expiresAtEpochMs: number } | null;
}

function volumeRows(state: SessionState, ctx: SessionContext): MuscleVolumeRow[] {
  return [...sessionMuscleVolume(state, ctx)].map(([muscle, volume]) => ({
    muscle,
    fractional: volume.fractional,
    direct: volume.direct,
  }));
}

/** PLN-14: seconds of the pending planned work (sets, rests, warm-ups, transitions). */
export function estimateRemainingS(state: SessionState, ctx: SessionContext): number {
  const rules = ctx.rules(null);
  const repSeconds = rules['session.duration.repSeconds'].value;
  const warmupSeconds = rules['session.duration.warmupSetSeconds'].value;
  const transition = rules['session.duration.transitionSeconds'].value;
  let total = 0;
  for (const slot of state.session.exercises) {
    if (slot.skipped) continue;
    const pending = slot.sets.filter((set) => !loggedOf(state.sets, slot.key, set.key));
    if (pending.length === 0) continue;
    const rest = restSecondsFor(slot, ctx);
    total += transition;
    for (const set of pending) {
      if (!isWorking(set)) total += warmupSeconds;
      else if (set.durationS !== undefined) total += set.durationS + rest;
      else total += (set.reps ? (set.reps[0] + set.reps[1]) / 2 : 8) * repSeconds + rest;
    }
  }
  const timer = state.session.timer;
  if (timer) total += timerView(timer, ctx.now.epochMs).remainingMs / 1000;
  return Math.round(total);
}

export function sessionView(state: SessionState, ctx: SessionContext): SessionView {
  const { session } = state;
  const prs = sessionPrs(state, ctx).prs;
  const exercises = session.exercises.map((slot): ExerciseView => {
    const history = ctx.history(slot.exerciseId);
    return {
      slot,
      groupKey: groupOf(session, slot.key)?.key ?? null,
      sets: slot.sets.map((set): PlannedSetView => {
        const logged = loggedOf(state.sets, slot.key, set.key) ?? null;
        return {
          set,
          status: logged ? logged.state : 'pending',
          logged,
          suggestion: logged || slot.skipped ? null : suggestSet(state, slot.key, set.key, ctx),
          prs: logged ? prs.filter((pr) => pr.setId === logged.id) : [],
        };
      }),
      lastTime: history?.last ?? null,
      calibration: calibrationStatus(history, ctx.rules(slot.exerciseId)),
      e1rmKg: currentE1rm(history),
      baselineOld: (history?.baseline?.old ?? false) && (history?.exposures ?? 0) === 0,
    };
  });
  const cursor = session.cursor;
  const last = state.sets.reduce(
    (latest, set) => Math.max(latest, set.performedAt.epochMs),
    session.startedAt.epochMs,
  );
  return {
    session,
    exercises,
    unslotted: state.sets.filter((set) => set.slotKey === undefined),
    current: cursor ? suggestSet(state, cursor.slotKey, cursor.setKey, ctx) : null,
    timer: session.timer
      ? { state: session.timer, view: timerView(session.timer, ctx.now.epochMs) }
      : null,
    clock: {
      elapsedMs: sessionElapsedMs(session, ctx.now.epochMs),
      remainingS: estimateRemainingS(state, ctx),
    },
    prs,
    volume: volumeRows(state, ctx),
    stale: session.status === 'active' && ctx.now.epochMs - last > STALE_SESSION_MS,
    undo:
      session.undo && ctx.now.epochMs <= session.undo.expiresAtEpochMs
        ? { token: session.undo.token, expiresAtEpochMs: session.undo.expiresAtEpochMs }
        : null,
  };
}

export interface E1rmChange {
  readonly exerciseId: ExerciseId;
  readonly beforeKg: number | null;
  readonly afterKg: number | null;
  /** PRG-02 label of the smoothed change (strength trend). */
  readonly change: Explained<ChangeLabel> | null;
}

/** WKT-13: the summary of a finished (or partial) session. */
export interface SessionSummary {
  readonly sessionId: Session['id'];
  readonly status: Session['status'];
  readonly startedAt: InstantTz;
  readonly endedAt: InstantTz | null;
  readonly durationMs: number;
  readonly sets: {
    readonly done: number;
    readonly skipped: number;
    readonly plannedWorking: number;
    readonly doneWorking: number;
  };
  /** MOT-03: finished, or partial with at least half of the planned working sets done. */
  readonly countsForStreak: boolean;
  readonly volume: readonly MuscleVolumeRow[];
  /** MOT-02: the best PR per exercise, type and rep count. */
  readonly prs: readonly PrRecord[];
  readonly firstTimes: readonly ExerciseId[];
  readonly e1rm: readonly E1rmChange[];
  readonly changes: readonly SessionChange[];
  readonly note?: string;
}

export function sessionSummary(state: SessionState, ctx: SessionContext): SessionSummary {
  const { session } = state;
  const plannedWorking = session.exercises
    .filter((slot) => slot.origin !== 'added')
    .reduce((sum, slot) => sum + slot.sets.filter(isWorking).length, 0);
  const done = state.sets.filter((set) => set.state === 'done');
  const doneWorking = done.filter((set) => set.type !== 'warmup').length;
  const live = sessionPrs(state, ctx);
  const best = new Map<string, PrRecord>();
  for (const pr of live.prs) {
    const key = `${pr.exerciseId}|${pr.type}|${pr.type === 'rep' ? pr.reps : ''}`;
    const current = best.get(key);
    if (!current || pr.valueKg > current.valueKg) best.set(key, pr);
  }
  const exerciseIds = [...new Set(done.map((set) => set.exerciseId))];
  const e1rm = exerciseIds.flatMap((exerciseId): E1rmChange[] => {
    const exercise = ctx.exercise(exerciseId);
    if (!exercise) return [];
    const rules = ctx.rules(exerciseId);
    const history = ctx.history(exerciseId) ?? emptyExerciseState(exerciseId, '');
    const note = session.exercises.find((slot) => slot.exerciseId === exerciseId)?.note;
    const folded = foldExposure(
      history,
      {
        sessionId: session.id,
        localDate: session.localDate,
        sets: exerciseSetsOf(state, exerciseId),
        ...(note ? { note } : {}),
      },
      { exercise, rules, level: ctx.level, bodyweightAt: () => ctx.bodyweightKg },
    ).state;
    const beforeKg = currentE1rm(history);
    const afterKg = currentE1rm(folded);
    if (beforeKg === null && afterKg === null) return [];
    return [
      {
        exerciseId,
        beforeKg,
        afterKg,
        change:
          folded.points.length > history.points.length
            ? labelChange(folded.points, ctx.level, rules)
            : null,
      },
    ];
  });
  const endedAt = session.endedAt ?? null;
  const durationMs = Math.max(0, (endedAt?.epochMs ?? ctx.now.epochMs) - session.startedAt.epochMs);
  const countsForStreak =
    session.status === 'finished' ||
    ((session.status === 'partial' || session.status === 'active') &&
      plannedWorking > 0 &&
      doneWorking >= plannedWorking / 2);
  return {
    sessionId: session.id,
    status: session.status,
    startedAt: session.startedAt,
    endedAt,
    durationMs,
    sets: {
      done: done.length,
      skipped: state.sets.filter((set) => set.state === 'skipped').length,
      plannedWorking,
      doneWorking,
    },
    countsForStreak,
    volume: volumeRows(state, ctx),
    prs: [...best.values()],
    firstTimes: live.firstTimes.map((entry) => entry.exerciseId),
    e1rm,
    changes: session.changes,
    ...(session.note ? { note: session.note } : {}),
  };
}
