import type {
  EquipmentProfile,
  ExerciseId,
  LocalDate,
  LoggedSet,
  Plan,
  PlannedSession,
  Profile,
  Session,
  SessionId,
  TrainingBreak,
} from '@powr/domain';
import type { ExerciseState, PrRecord } from '@powr/domain/session';
import type { MetaRecord, SettingsRecord } from '@powr/formats';

import type { Observable } from './index';

/** Live views of persisted state for the UI (§8.5): they re-emit whenever the data changes. */
export interface LiveQueries {
  activeSession(): Observable<Session | undefined>;
  sessionSets(id: SessionId): Observable<LoggedSet[]>;
  settings(): Observable<SettingsRecord | undefined>;
  meta(key: string): Observable<MetaRecord | undefined>;
  profile(): Observable<Profile | undefined>;
  equipmentProfiles(): Observable<EquipmentProfile[]>;
  activePlan(): Observable<Plan | undefined>;
  /** Planned sessions with `from ≤ localDate ≤ to`, in date order (calendar, week view). */
  plannedSessions(from: LocalDate, to: LocalDate): Observable<PlannedSession[]>;
  breaks(): Observable<TrainingBreak[]>;
  /**
   * M3a: the active session with its sets and the derived state of its exercises, read in one
   * query (the session screen's source; `@powr/application/session` maps it to a view).
   */
  activeSessionData(): Observable<ActiveSessionData | undefined>;
  /** PRs recorded for a session (the summary of a finished session, MOT-02). */
  sessionPrs(id: SessionId): Observable<PrRecord[]>;
}

export interface ActiveSessionData {
  readonly session: Session;
  readonly sets: readonly LoggedSet[];
  readonly states: readonly ExerciseState[];
}

/** Exercise IDs a session's derived state is read for. */
export function sessionExerciseIds(session: Session, sets: readonly LoggedSet[]): ExerciseId[] {
  return [
    ...new Set([
      ...session.exercises.map((exercise) => exercise.exerciseId),
      ...sets.map((set) => set.exerciseId),
    ]),
  ];
}
