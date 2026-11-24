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
    },
    sets: {
      add: async (set) => {
        await db.sets.add(set);
      },
      bySession: (id) => db.sets.where('sessionId').equals(id).toArray(),
    },
    raw: {
      readAll: async (): Promise<RawTables> => ({
        meta: await db.meta.toArray(),
        settings: await db.settings.toArray(),
        sessions: await db.sessions.toArray(),
        sets: await db.sets.toArray(),
      }),
      replaceAll: async (tables) => {
        for (const table of RAW_TABLE_NAMES) await db.table(table).clear();
        await db.meta.bulkAdd(tables.meta);
        await db.settings.bulkAdd(tables.settings);
        await db.sessions.bulkAdd(tables.sessions);
        await db.sets.bulkAdd(tables.sets);
      },
    },
  };
}
