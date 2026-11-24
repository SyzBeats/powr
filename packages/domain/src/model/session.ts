import type { ExerciseId, LocalDate, SessionId, SetId } from '../ids';
import type { InstantTz } from '../time';
import type { Mass } from '../units';
import type { VersionStamp } from '../version';

export type SetType = 'warmup' | 'working' | 'top' | 'backoff' | 'amrap' | 'timed';

/** RPE = 10 - rir. `source: 'none'` means no effort value exists (§8.7.7, E-1). */
export interface Effort {
  readonly rir: number | null;
  readonly source: 'entered' | 'none';
}

export interface LoggedSet {
  readonly id: SetId;
  readonly sessionId: SessionId;
  readonly exerciseId: ExerciseId;
  /** Order within the exercise in this session. */
  readonly index: number;
  readonly type: SetType;
  readonly load: Mass | null;
  readonly reps: number | null;
  readonly effort: Effort;
  readonly state: 'done' | 'skipped';
  readonly performedAt: InstantTz;
  /** Denormalized for indexes (§8.2.2). */
  readonly localDate: LocalDate;
}

export type SessionStatus = 'active' | 'finished' | 'partial' | 'discarded';

/** M0 subset of the session record; cursor, timer and exercise slots follow in M3. */
export interface Session {
  readonly id: SessionId;
  readonly localDate: LocalDate;
  readonly startedAt: InstantTz;
  readonly endedAt?: InstantTz;
  readonly status: SessionStatus;
  readonly versions: VersionStamp;
}
