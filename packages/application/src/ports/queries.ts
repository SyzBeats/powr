import type { LoggedSet, Session, SessionId } from '@powr/domain';
import type { MetaRecord, SettingsRecord } from '@powr/formats';

import type { Observable } from './index';

/** Live views of persisted state for the UI (§8.5): they re-emit whenever the data changes. */
export interface LiveQueries {
  activeSession(): Observable<Session | undefined>;
  sessionSets(id: SessionId): Observable<LoggedSet[]>;
  settings(): Observable<SettingsRecord | undefined>;
  meta(key: string): Observable<MetaRecord | undefined>;
}
