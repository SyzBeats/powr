import type { ExerciseId, LocalDate, MuscleId, SessionId, SetId } from '../ids';
import type { Range } from '../rules/params';
import type { Technique } from '../rules/techniques';
import type { InstantTz } from '../time';
import type { Mass } from '../units';
import type { VersionStamp } from '../version';
import type { CompetitionLift, RepRange } from './exercise';
import type { AdjustmentKind, PlannedSessionId, Prescription, RirRange } from './plan';
import type { LiftIntensity, SlotPriority } from './template';
import type { Goal } from './training';

/*
 * The workout session (WKT-01…16, TMR-01…13; technical concept §5.6, §6.2, §8.5, §8.8.1). A
 * session record holds the planned side (exercise slots with their planned sets, superset groups,
 * the cursor, the running timer, notes, readiness and accepted adjustments); every logged set is
 * its own record in `sets` (one strict transaction per logged set, §8.2.4). M0's quick-log
 * sessions have no slots: their sets carry no `slotKey` and are matched by exercise.
 */

/** Set types (WKT-04). Failure is a flag of a set, not a type. */
export const SET_TYPES = ['warmup', 'working', 'top', 'backoff', 'amrap', 'timed'] as const;
export type SetType = (typeof SET_TYPES)[number];

/**
 * RPE = 10 - rir. `source: 'none'` means no effort value exists (§8.7.7, E-1). `openEnded`: the
 * "5+" chip (WKT-03), stored as rir 5.
 */
export interface Effort {
  readonly rir: number | null;
  readonly source: 'entered' | 'none';
  readonly openEnded?: boolean;
}

/** WKT-03 markers of a set: taken to failure, a failed rep, pain (RDY-04 links here later). */
export interface SetFlags {
  readonly failure?: boolean;
  readonly failedRep?: boolean;
  readonly pain?: boolean;
}

/** What the engine suggested for a set when it was confirmed (PRG-03: overrides are recorded). */
export interface SetPrescriptionSnapshot {
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly rir: number | null;
  readonly durationS?: number;
}

export interface LoggedSet {
  readonly id: SetId;
  readonly sessionId: SessionId;
  readonly exerciseId: ExerciseId;
  /** Order of this exercise's logged sets within the session (0, 1, …). */
  readonly index: number;
  readonly type: SetType;
  /** External load; negative for assistance (WKT-11). Null for pure bodyweight or timed work. */
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly effort: Effort;
  readonly state: 'done' | 'skipped';
  readonly performedAt: InstantTz;
  /** Denormalized for indexes (§8.2.2). */
  readonly localDate: LocalDate;
  /** The session exercise slot (`SessionExercise.key`); absent for M0 quick-log sets. */
  readonly slotKey?: string;
  /** The planned set it fulfils (`PlannedSet.key`). */
  readonly setKey?: string;
  /** WKT-04 advanced technique (drops, mini-sets, appended partials as `units`). */
  readonly technique?: Technique;
  /** WKT-11: reps per side when a unilateral exercise is logged side by side. */
  readonly repsLeft?: number;
  readonly repsRight?: number;
  /** TMR-09: the achieved duration of a timed set. */
  readonly durationMs?: number;
  readonly flags?: SetFlags;
  /** TMR-08: time since the previous set of the session was confirmed. */
  readonly restBeforeMs?: number;
  readonly prescription?: SetPrescriptionSnapshot;
  /** WKT-10. */
  readonly note?: string;
}

export const SESSION_STATUSES = ['active', 'finished', 'partial', 'discarded'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

// --- Timers (§8.8.1; the contract shared with the timer infrastructure, M3t) ------------------

export const TIMER_KINDS = ['rest', 'set', 'transition'] as const;
export type TimerKind = (typeof TIMER_KINDS)[number];

/**
 * One running timer, stored in the session record so it survives a process kill (TMR-04,
 * WKT-14). Nothing counts ticks: the end of a countdown is `startedAtEpochMs + targetMs +
 * adjustMs`. Kinds: `rest` (TMR-01, warm-up rests included), `set` (a timed set or tempo work,
 * TMR-09/10), `transition` (between the exercises of a superset, TMR-13). The session clock
 * (TMR-11) is `now − session.startedAt`, not a timer.
 */
export interface TimerState {
  readonly id: string;
  readonly kind: TimerKind;
  /** TMR-07: count-up ("ready when ready"). */
  readonly mode: 'countdown' | 'countup';
  readonly startedAtEpochMs: number;
  /** Countdown target; for count-up the suggested rest. */
  readonly targetMs: number;
  /** ± adjustments (TMR-03), in 15 s steps from the controls. */
  readonly adjustMs: number;
  readonly fired: { readonly preAlert?: boolean; readonly end?: boolean };
  /** Optional (M3a): count-up soft minimum, after which a gentle cue fires (TMR-07). */
  readonly softMinMs?: number;
  /** Optional (M3a): the exercise slot the timer belongs to (display and alert text). */
  readonly slotKey?: string;
}

// --- The planned side --------------------------------------------------------------------

/**
 * A set as planned for this session. Loads stay null unless they are fixed (a fixed
 * prescription, a warm-up step or a load the user set on the fly, WKT-09); otherwise the engine
 * suggests one live from the history and the sets logged so far (PRG-03…08).
 */
export interface PlannedSet {
  /** Unique within the exercise: `w1…` warm-ups, `s1…` planned work, `x1…` added on the fly. */
  readonly key: string;
  readonly type: SetType;
  /** Target reps as a range ([n, n] for an exact number); null for timed sets. */
  readonly reps: RepRange | null;
  /** Target RIR range; null when the prescription states no effort. */
  readonly rir: RirRange | null;
  readonly load: Mass | null;
  readonly durationS?: number;
  readonly technique?: Technique;
  /** Rest after this set when it is not the exercise's rest (warm-ups, WKT-06). */
  readonly restSeconds?: number;
}

export const SLOT_ORIGINS = ['plan', 'added', 'repeat'] as const;
export type SlotOrigin = (typeof SLOT_ORIGINS)[number];

/** How a slot's loads are suggested: a progression model, or the last performance (PRG-03). */
export type SlotProgression = 'doubleProgression' | 'rpe' | 'linear' | 'apre' | 'manual';

/** One exercise of the session: planned (from the plan slot) and actual (WKT-02, WKT-08/09). */
export interface SessionExercise {
  /** Stable within the session: the plan slot key, or `x<n>` for exercises added on the fly. */
  readonly key: string;
  readonly exerciseId: ExerciseId;
  readonly origin: SlotOrigin;
  /** The plan slot it came from. */
  readonly planSlotKey?: string;
  /** WKT-08: the exercise it replaced and for how long. */
  readonly substitutedFrom?: {
    readonly exerciseId: ExerciseId;
    readonly scope: 'session' | 'mesocycle';
  };
  readonly goal: Goal;
  readonly priority: SlotPriority;
  readonly progression: SlotProgression;
  /** The plan's prescription (null for freestyle work, which follows the history). */
  readonly prescription: Prescription | null;
  readonly sets: readonly PlannedSet[];
  /** Rest after a working set; null → the evidence default for the exercise (TMR-02). */
  readonly restSeconds: number | null;
  /** PRG-11/13: load as a percentage of the normal working load (deload, return from break). */
  readonly loadPct?: Range;
  readonly lift?: CompetitionLift;
  readonly intensity?: LiftIntensity;
  /** WKT-10: the note on this exercise in this session. */
  readonly note?: string;
  /** WKT-09: skipped as a whole (its pending sets are logged as skipped). */
  readonly skipped: boolean;
  /** WKT-11: log a unilateral exercise per side (left and right reps). */
  readonly perSide?: boolean;
}

/** WKT-05: exercises done in alternation; rest follows TMR-13. */
export interface SessionGroup {
  readonly key: string;
  readonly kind: 'superset' | 'circuit';
  readonly slotKeys: readonly string[];
}

/** The set in focus (WKT-02). */
export interface SessionCursor {
  readonly slotKey: string;
  readonly setKey: string;
}

// --- Readiness (RDY-01…03) and accepted adjustments ---------------------------------------

/** The check-in items of RDY-01; every item is optional. */
export interface ReadinessItems {
  /** Hours slept last night. */
  readonly sleepHours?: number | null;
  /** 1 (poor) … 5 (very good). */
  readonly sleepQuality?: number | null;
  /** 1 (exhausted) … 5 (full of energy). */
  readonly energy?: number | null;
  /** 1 (none) … 5 (very sore); higher is worse. */
  readonly soreness?: number | null;
  /** 1 (relaxed) … 5 (very stressed); higher is worse. */
  readonly stress?: number | null;
  /** 1 (none) … 5 (eager to train). */
  readonly motivation?: number | null;
  /** Perceived Recovery Status, 0 (not recovered) … 10 (fully recovered). */
  readonly prs?: number | null;
}

/** A readiness check-in (raw, table `readiness`). */
export interface ReadinessEntry {
  readonly id: string;
  readonly localDate: LocalDate;
  readonly recordedAt: InstantTz;
  /** The session it was taken before. */
  readonly sessionId?: SessionId;
  readonly items: ReadinessItems;
  /** Optional per-muscle soreness, 1–5. */
  readonly soreMuscles?: readonly { readonly muscle: MuscleId; readonly rating: number }[];
}

export type ReadinessFlag = 'insufficientData' | 'none' | 'low' | 'modify';

export interface SessionReadiness {
  /** The check-in was taken (with its entry) or skipped (RDY-01: skipping never blocks). */
  readonly status: 'done' | 'skipped';
  readonly entryId?: string;
  /** The assessment at check-in time (RDY-02). */
  readonly flag?: ReadinessFlag;
  readonly composite?: number | null;
}

export const SESSION_CHANGE_KINDS = [
  'capTopSet',
  'dropBackoff',
  'trimVolume',
  'easeCompounds',
  'returnFromBreak',
] as const;
export type SessionChangeKind = (typeof SESSION_CHANGE_KINDS)[number];

/**
 * An adjustment the user accepted for this session (RDY-03 readiness proposals, PRG-13 return
 * from break per lift). Applied to the slots when accepted; kept for the summary and "Why?".
 */
export interface SessionChange {
  readonly kind: SessionChangeKind;
  readonly slotKeys: readonly string[];
  /** RIR added (capTopSet, easeCompounds, returnFromBreak). */
  readonly rirAdd?: number;
  /** Sets removed per slot (dropBackoff, trimVolume). */
  readonly dropSets?: number;
  /** Return from break: load and sets as a percentage of normal, the days off. */
  readonly loadPct?: Range;
  readonly setsPct?: Range;
  readonly daysOff?: number;
  readonly calibrate?: boolean;
}

// --- Undo (WKT-12) ---------------------------------------------------------------------------

/**
 * The pre-change snapshot of the last undoable event: the session as it was, and the set
 * records to put back and to remove. Single level; replaced by the next undoable event.
 */
export interface UndoEntry {
  readonly token: string;
  readonly expiresAtEpochMs: number;
  readonly session: SessionCore;
  readonly restoreSets: readonly LoggedSet[];
  readonly removeSetIds: readonly SetId[];
}

export type SessionOrigin = 'planned' | 'freestyle' | 'repeat';

export interface Session {
  readonly id: SessionId;
  readonly localDate: LocalDate;
  readonly startedAt: InstantTz;
  readonly endedAt?: InstantTz;
  readonly status: SessionStatus;
  /** Engine, rules (hashed) and content versions the session was started with (PRG-18). */
  readonly versions: VersionStamp;
  readonly origin: SessionOrigin;
  readonly plannedSessionId?: PlannedSessionId;
  /** The planned session's adjustments (deload, return from break; PRG-11/13), for "Why?". */
  readonly plannedAdjustments?: readonly AdjustmentKind[];
  /** The session a "repeat" copied (WKT-01). */
  readonly repeatOf?: SessionId;
  /** Logged for a past date (WKT-15). */
  readonly backdated?: boolean;
  readonly equipmentProfileId: string | null;
  readonly exercises: readonly SessionExercise[];
  readonly groups: readonly SessionGroup[];
  readonly cursor: SessionCursor | null;
  readonly timer: TimerState | null;
  /** WKT-10: the note on the session. */
  readonly note?: string;
  readonly readiness: SessionReadiness | null;
  readonly changes: readonly SessionChange[];
  /** Bumped by every accepted event. */
  readonly revision: number;
  readonly undo: UndoEntry | null;
}

/** A session without its undo entry (what an undo entry stores). */
export type SessionCore = Omit<Session, 'undo'>;

/** The M3 fields of a session record with their empty values (v1 records, M0 quick log). */
export const SESSION_DEFAULTS = {
  origin: 'freestyle',
  equipmentProfileId: null,
  exercises: [],
  groups: [],
  cursor: null,
  timer: null,
  readiness: null,
  changes: [],
  revision: 0,
  undo: null,
} as const satisfies Partial<Session>;
