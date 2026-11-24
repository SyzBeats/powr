import type { Repositories } from '@powr/application';
import { RAW_TABLE_NAMES, type RawTables } from '@powr/formats';

import type { PowrDb } from './schema';

/** Repositories over Dexie tables. Inside `db.transaction` they join the transaction automatically. */
export function createRepositories(db: PowrDb): Repositories {
  return {
    meta: {
      get: (key) => db.meta.get(key),
      put: async (record) => {
        await db.meta.put(record);
      },
      delete: (key) => db.meta.delete(key),
    },
    settings: {
      get: () => db.settings.get('me'),
      put: async (settings) => {
        await db.settings.put(settings);
      },
    },
    sessions: {
      get: (id) => db.sessions.get(id),
      getActive: () => db.sessions.where('status').equals('active').first(),
      put: async (session) => {
        await db.sessions.put(session);
      },
      latestBefore: (date) => db.sessions.where('localDate').below(date).last(),
      inRange: (from, to) => db.sessions.where('localDate').between(from, to, true, true).toArray(),
    },
    sets: {
      add: async (set) => {
        await db.sets.add(set);
      },
      bySession: (id) => db.sets.where('sessionId').equals(id).toArray(),
      inRange: (from, to) => db.sets.where('localDate').between(from, to, true, true).toArray(),
    },
    profile: {
      get: () => db.profile.get('me'),
      put: async (profile) => {
        await db.profile.put(profile);
      },
    },
    equipment: {
      get: (id) => db.equipmentProfiles.get(id),
      list: () => db.equipmentProfiles.toArray(),
      put: async (profile) => {
        await db.equipmentProfiles.put(profile);
      },
      delete: (id) => db.equipmentProfiles.delete(id),
    },
    plans: {
      get: (id) => db.plans.get(id),
      getActive: () => db.plans.where('status').equals('active').first(),
      put: async (plan) => {
        await db.plans.put(plan);
      },
    },
    plannedSessions: {
      get: (id) => db.plannedSessions.get(id),
      byPlan: (planId) =>
        db.plannedSessions
          .where('[planId+localDate]')
          .between([planId, ''], [planId, '￿'])
          .toArray(),
      inRange: (from, to) =>
        db.plannedSessions.where('localDate').between(from, to, true, true).toArray(),
      putMany: async (sessions) => {
        await db.plannedSessions.bulkPut([...sessions]);
      },
      deleteMany: (ids) => db.plannedSessions.bulkDelete([...ids]),
    },
    breaks: {
      get: (id) => db.breaks.get(id),
      list: () => db.breaks.orderBy('startDate').toArray(),
      put: async (entry) => {
        await db.breaks.put(entry);
      },
    },
    meets: {
      list: () => db.meets.orderBy('date').toArray(),
      put: async (meet) => {
        await db.meets.put(meet);
      },
    },
    bodyweights: {
      put: async (entry) => {
        await db.bodyweights.put(entry);
      },
    },
    raw: {
      readAll: async (): Promise<RawTables> => {
        const tables = {} as Record<string, unknown[]>;
        for (const table of RAW_TABLE_NAMES) tables[table] = await db.table(table).toArray();
        return tables as RawTables;
      },
      replaceAll: async (tables) => {
        for (const table of RAW_TABLE_NAMES) await db.table(table).clear();
        for (const table of RAW_TABLE_NAMES) await db.table(table).bulkAdd(tables[table]);
      },
    },
  };
}
