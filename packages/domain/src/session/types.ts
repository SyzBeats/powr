import type { Explained, Explanation } from '../explain';
import type { ExerciseId, LocalDate, MuscleId, SessionId, SetId } from '../ids';
import type { BodyweightImplements, Implement, Rounding } from '../loading';
import type {
  ExerciseDef,
  LoggedSet,
  PlannedSessionId,
  ReadinessEntry,
  ReadinessFlag,
  RepRange,
  RirRange,
  Session,
  SessionChange,
  SetFlags,
  SetType,
  TimerState,
} from '../model';
import type { RuleSet, Technique, TraineeLevel } from '../rules';
import type { InstantTz } from '../time';
import type { Mass, RoundingMode } from '../units';
import type { ExerciseState } from './history';
import type { PrRecord } from './prs';

/** The reducer's state: the session record and its logged sets (technical concept §8.5). */
export interface SessionState {
  readonly session: Session;
  readonly sets: readonly LoggedSet[];
}

/** Equipment for one exercise: what suggested loads are rounded to (WKT-07, PRG-07). */
export interface ExerciseEquipment {
  /** Null for exercises without a load (bands, timed work). */
  readonly implement: Implement | null;
  /** Added-load and assistance implements of bodyweight-loaded exercises (WKT-11). */
  readonly bodyweight?: BodyweightImplements;
  readonly mode: RoundingMode;
}

/** WKT-16 hints; each can be turned off. */
export const GUARDRAIL_KINDS = ['sessionVolume', 'failure', 'shortRest', 'slowReps'] as const;
export type GuardrailKind = (typeof GUARDRAIL_KINDS)[number];

/** Per-exercise choices (PRG-03 manual mode, TMR-01 auto-start, WKT-11 per side). */
export interface ExercisePreference {
  readonly exerciseId: ExerciseId;
  readonly manual?: boolean;
  readonly restAutoStart?: boolean;
  readonly perSide?: boolean;
}

/** The session-core settings (settings record, `session`). */
export interface SessionPreferences {
  /** TMR-01: start the rest timer when a set is confirmed. */
  readonly restAutoStart: boolean;
  /** TMR-07: count-up instead of countdown rest. */
  readonly restMode: 'countdown' | 'countup';
  /** RDY-01: offer the check-in before a session. */
  readonly readinessCheckIn: boolean;
  /** WKT-16: hints turned off. */
  readonly hintsOff: readonly GuardrailKind[];
  /** SET-05: rounding direction of suggested loads. */
  readonly rounding: RoundingMode;
  readonly exercises: readonly ExercisePreference[];
}

export const DEFAULT_SESSION_PREFERENCES: SessionPreferences = {
  restAutoStart: true,
  restMode: 'countdown',
  readinessCheckIn: true,
  hintsOff: [],
  rounding: 'nearestTiesDown',
  exercises: [],
};

/**
 * Everything the reducer reads besides its state. All of it is data or a pure lookup, so the
 * reducer stays deterministic: the same state, event and context give the same transition.
 */
export interface SessionContext {
  /** The current moment (the domain never reads a clock, §8.7.1). */
  readonly now: InstantTz;
  /** Fresh record IDs, consumed in order (UUIDv7 from the application). */
  readonly ids: readonly string[];
  readonly exercise: (id: ExerciseId) => ExerciseDef | undefined;
  /** Rules resolved for an exercise's context with the user's overrides; null: no exercise. */
  readonly rules: (id: ExerciseId | null) => RuleSet;
  readonly equipment: (id: ExerciseId) => ExerciseEquipment;
  /** The derived state of an exercise from finished sessions (this session excluded). */
  readonly history: (id: ExerciseId) => ExerciseState | null;
  /** Bodyweight trend value now (bodyweight-loaded exercises, WKT-11). */
  readonly bodyweightKg: number | null;
  readonly level: TraineeLevel;
  readonly preferences: SessionPreferences;
  /** Recent readiness check-ins (RDY-02 baseline window), oldest first. */
  readonly readiness: readonly ReadinessEntry[];
}

// --- Events ---------------------------------------------------------------------------------

/** The values of a set as the user confirms or edits them (WKT-03). */
export interface SetInput {
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly rir: number | null;
  /** The "5+" RIR chip. */
  readonly openEnded?: boolean;
  readonly repsLeft?: number;
  readonly repsRight?: number;
  readonly durationMs?: number;
  readonly technique?: Technique | null;
  readonly flags?: SetFlags;
  readonly note?: string | null;
  /** Logged as another type than planned (e.g. a working set turned AMRAP). */
  readonly type?: SetType;
}

/** On-the-fly prescription changes (WKT-09). */
export interface PrescriptionChange {
  readonly reps?: RepRange;
  readonly rir?: RirRange | null;
  readonly load?: Mass | null;
  readonly durationS?: number;
  readonly technique?: Technique | null;
  /** Total working sets of the slot (pending sets are added or removed at the end). */
  readonly sets?: number;
  readonly restSeconds?: number | null;
  readonly progression?: 'manual' | 'engine';
}

export type NoteTarget =
  | { readonly kind: 'session' }
  | { readonly kind: 'exercise'; readonly slotKey: string }
  | { readonly kind: 'set'; readonly setId: SetId };

export type SessionEvent =
  | {
      readonly type: 'CONFIRM_SET';
      readonly slotKey: string;
      readonly setKey: string;
      readonly values: SetInput;
      /** WKT-03: the user confirmed an implausible entry. */
      readonly confirmImplausible?: boolean;
    }
  | { readonly type: 'EDIT_SET'; readonly setId: SetId; readonly values: Partial<SetInput> }
  | { readonly type: 'SKIP_SET'; readonly slotKey: string; readonly setKey: string }
  | { readonly type: 'DELETE_SET'; readonly setId: SetId }
  | { readonly type: 'ADD_SET'; readonly slotKey: string; readonly setType?: SetType }
  | { readonly type: 'REMOVE_SET'; readonly slotKey: string; readonly setKey: string }
  | { readonly type: 'SKIP_EXERCISE'; readonly slotKey: string }
  | {
      readonly type: 'ADD_EXERCISE';
      readonly exerciseId: ExerciseId;
      /** Insert position in the exercise list; the end by default. */
      readonly position?: number;
      readonly sets?: number;
    }
  | { readonly type: 'REMOVE_EXERCISE'; readonly slotKey: string }
  | { readonly type: 'REORDER'; readonly order: readonly string[] }
  | {
      readonly type: 'SUBSTITUTE';
      readonly slotKey: string;
      readonly exerciseId: ExerciseId;
      readonly scope: 'session' | 'mesocycle';
    }
  | {
      readonly type: 'CHANGE_PRESCRIPTION';
      readonly slotKey: string;
      /** One pending set, or every pending working set of the slot. */
      readonly setKey?: string;
      readonly change: PrescriptionChange;
    }
  | { readonly type: 'SET_NOTE'; readonly target: NoteTarget; readonly note: string | null }
  | {
      readonly type: 'GROUP';
      readonly kind: 'superset' | 'circuit';
      readonly slotKeys: readonly string[];
    }
  | { readonly type: 'UNGROUP'; readonly groupKey: string }
  | {
      readonly type: 'GENERATE_WARMUPS';
      readonly slotKey: string;
      readonly includeOptional?: boolean;
    }
  | { readonly type: 'SET_PER_SIDE'; readonly slotKey: string; readonly perSide: boolean }
  | { readonly type: 'MOVE_CURSOR'; readonly slotKey: string; readonly setKey: string }
  | { readonly type: 'SET_REST'; readonly slotKey: string; readonly seconds: number | null }
  /** RDY-01: the check-in (null: skipped). */
  | {
      readonly type: 'READINESS';
      readonly items: ReadinessEntry['items'] | null;
      readonly soreMuscles?: ReadinessEntry['soreMuscles'];
    }
  /** RDY-03 and PRG-13 proposals the user accepted. */
  | { readonly type: 'APPLY_CHANGES'; readonly changes: readonly SessionChange[] }
  | {
      readonly type: 'TIMER_START';
      readonly kind: 'rest' | 'set';
      readonly mode?: 'countdown' | 'countup';
      readonly targetMs?: number;
      readonly slotKey?: string;
    }
  | { readonly type: 'TIMER_STOP' }
  | { readonly type: 'TIMER_ADJUST'; readonly deltaMs: number }
  | { readonly type: 'TIMER_SKIP' }
  | { readonly type: 'TIMER_RESTART' }
  | { readonly type: 'TIMER_FIRED'; readonly timerId: string; readonly which: 'preAlert' | 'end' }
  | { readonly type: 'UNDO'; readonly token: string }
  /** WKT-13; `endAt: 'lastSet'` for "Finish session at last logged set?" (WKT-14). */
  | {
      readonly type: 'FINISH';
      readonly as: 'finished' | 'partial';
      readonly endAt?: 'now' | 'lastSet';
    }
  | { readonly type: 'DISCARD' }
  /** WKT-14: the app reopened with this session active. */
  | { readonly type: 'RESUME' };

export type SessionEventType = SessionEvent['type'];

// --- Effects ------------------------------------------------------------------------------

/** Accessible announcements (live region) the UI words. */
export type Announcement =
  | { readonly kind: 'setLogged'; readonly slotKey: string; readonly setKey: string }
  | { readonly kind: 'setSkipped'; readonly slotKey: string; readonly setKey: string }
  | { readonly kind: 'restStarted'; readonly seconds: number }
  | { readonly kind: 'transition'; readonly toSlotKey: string; readonly seconds: number }
  | { readonly kind: 'exerciseDone'; readonly slotKey: string }
  | { readonly kind: 'sessionDone' }
  | { readonly kind: 'undone' };

/**
 * What the infrastructure must do after a transition; the reducer does no I/O. The application
 * runs `persist`, `activeSession`, `plan.substitute`, `plan.complete` and `recompute`; the rest
 * go to the app's effect runner (timer scheduler, wake lock, haptics, audio, live region).
 */
export type SessionEffect =
  | {
      readonly kind: 'persist';
      readonly session: Session;
      readonly putSets: readonly LoggedSet[];
      readonly deleteSetIds: readonly SetId[];
      readonly readiness?: ReadinessEntry;
    }
  | { readonly kind: 'timer.arm'; readonly timer: TimerState }
  | { readonly kind: 'timer.disarm'; readonly timerId: string }
  | { readonly kind: 'wakeLock'; readonly action: 'acquire' | 'release' }
  /** The service worker's update gate (`powr-runtime.activeSession`, §6.3). */
  | { readonly kind: 'activeSession'; readonly sessionId: SessionId | null }
  | { readonly kind: 'celebrate'; readonly prs: readonly PrRecord[] }
  | { readonly kind: 'cue'; readonly cue: 'setConfirmed' | 'setSkipped' | 'undone' }
  | { readonly kind: 'announce'; readonly announcement: Announcement }
  /** WKT-08 "for the rest of the mesocycle": the application updates the plan. */
  | {
      readonly kind: 'plan.substitute';
      readonly plannedSessionId: PlannedSessionId;
      readonly planSlotKey: string;
      readonly exerciseId: ExerciseId;
    }
  | { readonly kind: 'plan.complete'; readonly plannedSessionId: PlannedSessionId }
  /** Derived data to rebuild (§8.2.8): the exercises of a finished or edited session. */
  | {
      readonly kind: 'recompute';
      readonly exerciseIds: readonly ExerciseId[];
      readonly fromDate: LocalDate;
    };

// --- Results -------------------------------------------------------------------------------

export type SessionRejection =
  | { readonly kind: 'notActive' }
  | { readonly kind: 'unknownSlot'; readonly slotKey: string }
  | { readonly kind: 'unknownSet'; readonly key: string }
  | { readonly kind: 'unknownExercise'; readonly exerciseId: ExerciseId }
  | { readonly kind: 'unknownGroup'; readonly groupKey: string }
  | { readonly kind: 'alreadyLogged'; readonly setKey: string }
  | { readonly kind: 'notPending'; readonly setKey: string }
  | { readonly kind: 'hasLoggedSets'; readonly slotKey: string }
  | { readonly kind: 'invalidValues'; readonly issues: readonly string[] }
  | { readonly kind: 'implausible'; readonly issues: readonly PlausibilityIssue[] }
  | { readonly kind: 'invalidOrder' }
  | { readonly kind: 'alreadyGrouped'; readonly slotKey: string }
  | { readonly kind: 'noWorkingLoad'; readonly slotKey: string }
  | { readonly kind: 'noTimer' }
  | { readonly kind: 'undoExpired' }
  | { readonly kind: 'idsExhausted' };

/** WKT-03: entries that ask for confirmation. */
export type PlausibilityIssue =
  | { readonly kind: 'loadAboveE1rm'; readonly factor: number; readonly e1rmKg: number }
  | { readonly kind: 'manyReps'; readonly reps: number };

/** A set's suggested values (PRG-03), pre-filled for the one-tap confirm (WKT-03). */
export interface SetSuggestion {
  readonly slotKey: string;
  readonly setKey: string;
  readonly type: SetType;
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly repRange: RepRange | null;
  /** Pre-filled RIR (half steps). */
  readonly rir: number | null;
  readonly rirRange: RirRange | null;
  readonly durationS: number | null;
  readonly technique?: Technique;
  /** Where the load came from. */
  readonly basis:
    | 'fixed'
    | 'warmup'
    | 'calibration'
    | 'progression'
    | 'autoregulated'
    | 'lastTime'
    | 'none';
  /** The plate breakdown and the loads either side (WKT-07). */
  readonly rounding: Rounding | null;
}

/** A WKT-16 hint. */
export interface Guardrail {
  readonly kind: GuardrailKind;
  readonly slotKey: string;
  readonly muscle?: MuscleId;
  readonly why: Explanation;
}

/** What one event produced for the caller (§6.2: `{ prs[], nextSuggestion{why}, timer, undoToken }`). */
export interface SessionResult {
  readonly rejected: SessionRejection | null;
  readonly undoToken: string | null;
  /** The set this event created (CONFIRM_SET, SKIP_SET). */
  readonly setId: SetId | null;
  readonly prs: readonly PrRecord[];
  readonly next: Explained<SetSuggestion> | null;
  readonly hints: readonly Guardrail[];
  readonly timer: TimerState | null;
  /** TIMER_STOP: the elapsed time of the stopped timer (a timed set's duration). */
  readonly elapsedMs?: number;
  /** RESUME: the session has been open longer than `STALE_SESSION_MS` (WKT-14 prompt). */
  readonly stale?: boolean;
  /** READINESS: the assessment and the proposals to offer (RDY-02/03, PRG-13). */
  readonly readiness?: ReadinessOutcome;
}

export interface Transition {
  readonly state: SessionState;
  readonly effects: readonly SessionEffect[];
  readonly result: SessionResult;
}

// --- Readiness (RDY-02/03) and proposals --------------------------------------------------

export const READINESS_ITEMS = [
  'sleepHours',
  'sleepQuality',
  'energy',
  'soreness',
  'stress',
  'motivation',
  'prs',
] as const;
export type ReadinessItem = (typeof READINESS_ITEMS)[number];

export interface ReadinessAssessment {
  readonly flag: ReadinessFlag;
  /** Mean sign-aligned z-score (higher is better); null without a baseline. */
  readonly composite: number | null;
  readonly z: Readonly<Partial<Record<ReadinessItem, number>>>;
  /** Check-ins in the baseline window. */
  readonly baselineEntries: number;
  /** Days in a row (today included) with PRS at or below the threshold. */
  readonly prsLowDays: number;
  /** Last night shorter than the short-sleep threshold. */
  readonly shortSleep: boolean;
  /** Short nights in a row, last night included. */
  readonly shortNights: number;
}

/** An adjustment to offer, with its reason; accepting it sends `APPLY_CHANGES`. */
export interface SessionProposal {
  readonly change: SessionChange;
  readonly why: Explanation;
}

export interface ReadinessOutcome {
  readonly entryId: string | null;
  readonly assessment: Explained<ReadinessAssessment> | null;
  readonly proposals: readonly SessionProposal[];
}
