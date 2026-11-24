import { liveQuery } from 'dexie';

import type { LiveQueries } from '@powr/application';

import type { PowrDb } from './schema';

/** Dexie live queries re-run whenever their tables change, also when another context writes. */
export function createLiveQueries(db: PowrDb): LiveQueries {
  return {
    activeSession: () => liveQuery(() => db.sessions.where('status').equals('active').first()),
    sessionSets: (id) =>
      liveQuery(() => db.sets.where('sessionId').equals(id).sortBy('performedAt.epochMs')),
    settings: () => liveQuery(() => db.settings.get('me')),
    meta: (key) => liveQuery(() => db.meta.get(key)),
  };
}
