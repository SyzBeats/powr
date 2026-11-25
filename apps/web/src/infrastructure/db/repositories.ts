import { Dexie } from 'dexie';

import { DERIVED_TABLE_NAMES, type Repositories } from '@powr/application';
import type { Session } from '@powr/domain';
import { RAW_TABLE_NAMES, withSessionDefaults, type RawTables } from '@powr/formats';

import type { PowrDb } from './schema';

/**
 * Session records written by an M2 build before M3a amended version 2 lack the session core;
 * reading through the same default-filler as the 1 → 2 migration keeps them usable.
 */
const oneSession = (record: Session | undefined): Session | undefined =>
  record && withSessionDefaults(record);
const allSessions = (records: Session[]): Session[] =>
  records.map((record) => withSessionDefaults(record));

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
      get: async (id) => oneSession(await db.sessions.get(id)),
      getActive: async () => oneSession(await db.sessions.where('status').equals('active').first()),
      put: async (record) => {
        await db.sessions.put(record);
      },
      delete: (id) => db.sessions.delete(id),
      byIds: async (ids) =>
        allSessions((await db.sessions.bulkGet([...ids])).filter((record) => record !== undefined)),
      latestBefore: async (date) =>
        oneSession(await db.sessions.where('localDate').below(date).last()),
      inRange: async (from, to) =>
        allSessions(await db.sessions.where('localDate').between(from, to, true, true).toArray()),
    },
    sets: {
      add: async (set) => {
        await db.sets.add(set);
      },
      put: async (set) => {
        await db.sets.put(set);
      },
      delete: (id) => db.sets.delete(id),
      bySession: (id) => db.sets.where('sessionId').equals(id).toArray(),
      byExercise: (id) =>
        db.sets
          .where('[exerciseId+performedAt.epochMs]')
          .between([id, Dexie.minKey], [id, Dexie.maxKey])
          .toArray(),
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
      list: () => db.plans.toArray(),
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
      list: () => db.bodyweights.orderBy('measuredAt.epochMs').toArray(),
      get: (id) => db.bodyweights.get(id),
      delete: (id) => db.bodyweights.delete(id),
    },
    customExercises: {
      get: (id) => db.customExercises.get(id),
      list: () => db.customExercises.toArray(),
      put: async (exercise) => {
        await db.customExercises.put(exercise);
      },
      delete: (id) => db.customExercises.delete(id),
    },
    exerciseUserData: {
      get: (id) => db.exerciseUserData.get(id),
      list: () => db.exerciseUserData.toArray(),
      put: async (entry) => {
        await db.exerciseUserData.put(entry);
      },
      delete: (id) => db.exerciseUserData.delete(id),
    },
    measurements: {
      get: (id) => db.measurements.get(id),
      list: () => db.measurements.orderBy('measuredAt.epochMs').toArray(),
      put: async (entry) => {
        await db.measurements.put(entry);
      },
      delete: (id) => db.measurements.delete(id),
    },
    insights: {
      weeks: (from, to) => db.dWeekly.where('weekStart').between(from, to, true, true).toArray(),
      putWeeks: async (records) => {
        await db.dWeekly.bulkPut([...records]);
      },
      deleteWeeks: (weekStarts) => db.dWeekly.bulkDelete([...weekStarts]),
      streak: () => db.dStreak.get('me'),
      putStreak: async (record) => {
        await db.dStreak.put(record);
      },
    },
    readiness: {
      put: async (entry) => {
        await db.readiness.put(entry);
      },
      inRange: (from, to) =>
        db.readiness.where('localDate').between(from, to, true, true).toArray(),
      bySession: (id) => db.readiness.where('sessionId').equals(id).toArray(),
    },
    derived: {
      exerciseStates: async (ids) =>
        (await db.dExerciseState.bulkGet([...ids])).filter((state) => state !== undefined),
      replaceExercise: async (exerciseId, derived) => {
        await db.dExerciseState.put(derived.state);
        await db.dSessionE1rm
          .where('[exerciseId+localDate]')
          .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
          .delete();
        await db.dSessionE1rm.bulkPut([...derived.points]);
        await db.dPrs.where('exerciseId').equals(exerciseId).delete();
        await db.dPrs.bulkPut([...derived.prs]);
      },
      prsBySession: (id) => db.dPrs.where('sessionId').equals(id).toArray(),
      prsByExercise: (id) => db.dPrs.where('exerciseId').equals(id).toArray(),
      pointsByExercise: (id) =>
        db.dSessionE1rm
          .where('[exerciseId+localDate]')
          .between([id, Dexie.minKey], [id, Dexie.maxKey])
          .toArray(),
      prsInRange: (from, to) => db.dPrs.where('localDate').between(from, to, true, true).toArray(),
      pointsInRange: (from, to) =>
        db.dSessionE1rm.where('localDate').between(from, to, true, true).toArray(),
      invalidate: (ids) => db.dExerciseState.bulkDelete([...ids]),
      clear: async () => {
        const scope = Dexie.currentTransaction?.storeNames ?? [];
        for (const table of DERIVED_TABLE_NAMES) {
          if (scope.includes(table)) await db.table(table).clear();
        }
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
        // Derived data is rebuilt from the new raw data on use (§8.2.8 "Import").
        const scope = Dexie.currentTransaction?.storeNames ?? [];
        for (const table of DERIVED_TABLE_NAMES) {
          if (scope.includes(table)) await db.table(table).clear();
        }
        for (const table of RAW_TABLE_NAMES) await db.table(table).bulkAdd(tables[table]);
      },
    },
  };
}
