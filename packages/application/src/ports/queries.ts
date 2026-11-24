import type {
  EquipmentProfile,
  LocalDate,
  LoggedSet,
  Plan,
  PlannedSession,
  Profile,
  Session,
  SessionId,
  TrainingBreak,
} from '@powr/domain';
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
}
