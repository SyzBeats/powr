import { liveQuery } from 'dexie';

import { sessionExerciseIds, type LiveQueries } from '@powr/application';
import { withSessionDefaults } from '@powr/formats';

import { createRepositories } from './repositories';
import type { PowrDb } from './schema';

/** Dexie live queries re-run whenever their tables change, also when another context writes. */
export function createLiveQueries(db: PowrDb): LiveQueries {
  const repos = createRepositories(db);
  return {
    activeSession: () =>
      liveQuery(async () => {
        const active = await db.sessions.where('status').equals('active').first();
        return active && withSessionDefaults(active);
      }),
    sessionSets: (id) =>
      liveQuery(() => db.sets.where('sessionId').equals(id).sortBy('performedAt.epochMs')),
    settings: () => liveQuery(() => db.settings.get('me')),
    meta: (key) => liveQuery(() => db.meta.get(key)),
    profile: () => liveQuery(() => db.profile.get('me')),
    equipmentProfiles: () => liveQuery(() => db.equipmentProfiles.toArray()),
    activePlan: () => liveQuery(() => db.plans.where('status').equals('active').first()),
    plannedSessions: (from, to) =>
      liveQuery(() =>
        db.plannedSessions.where('localDate').between(from, to, true, true).toArray(),
      ),
    breaks: () => liveQuery(() => db.breaks.orderBy('startDate').toArray()),
    activeSessionData: () =>
      liveQuery(async () => {
        const found = await db.sessions.where('status').equals('active').first();
        if (!found) return undefined;
        const session = withSessionDefaults(found);
        const sets = await db.sets.where('sessionId').equals(session.id).toArray();
        const states = (await db.dExerciseState.bulkGet(sessionExerciseIds(session, sets))).filter(
          (state) => state !== undefined,
        );
        return { session, sets, states };
      }),
    sessionPrs: (id) => liveQuery(() => db.dPrs.where('sessionId').equals(id).toArray()),
    // M4a: any repository read as a live query, in one read transaction over its tables.
    observe: (tables, read) =>
      liveQuery(() =>
        db.transaction(
          'r',
          tables.map((name) => db.table(name)),
          async () => read(repos),
        ),
      ),
  };
}
