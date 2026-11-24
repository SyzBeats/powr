import { builtInContent } from '@powr/content/built-in';
import { makeInstantTz, type SessionId } from '@powr/domain';
import { emptyRawTables, type RawTableName, type RawTables } from '@powr/formats';
import { rulesStamp, type ParamOverride, type ResolveContext } from '@powr/rules';
import { BUILT_IN_RULES } from '@powr/rules/built-in';
import { resolveRules } from '@powr/rules/resolve';

import type { Deps, Repositories, RulesProvider, UnitOfWork } from '../src';

function byDate<T extends { localDate: string }>(entries: T[]): T[] {
  return entries.toSorted((a, b) =>
    a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0,
  );
}

/** In-memory repositories over plain arrays: the fake of the Dexie adapters (§5.5). */
function repositories(tables: RawTables): Repositories {
  const upsert = <T extends RawTableName>(table: T, key: string, record: RawTables[T][number]) => {
    const keyOf = (entry: RawTables[T][number]) =>
      (entry as unknown as Record<string, string>)[key];
    (tables[table] as RawTables[T][number][]) = [
      ...(tables[table] as RawTables[T][number][]).filter(
        (entry) => keyOf(entry) !== keyOf(record),
      ),
      record,
    ];
  };
  return {
    meta: {
      get: async (key) => tables.meta.find((record) => record.key === key),
      put: async (record) => upsert('meta', 'key', record),
      delete: async (key) => {
        tables.meta = tables.meta.filter((record) => record.key !== key);
      },
    },
    settings: {
      get: async () => tables.settings[0],
      put: async (settings) => {
        tables.settings = [settings];
      },
    },
    sessions: {
      get: async (id) => tables.sessions.find((session) => session.id === id),
      getActive: async () => tables.sessions.find((session) => session.status === 'active'),
      put: async (session) => upsert('sessions', 'id', session),
      latestBefore: async (date) =>
        byDate(tables.sessions.filter((session) => session.localDate < date)).at(-1),
      inRange: async (from, to) =>
        byDate(
          tables.sessions.filter((session) => session.localDate >= from && session.localDate <= to),
        ),
    },
    sets: {
      add: async (set) => {
        if (tables.sets.some((s) => s.id === set.id)) throw new Error('ConstraintError');
        tables.sets = [...tables.sets, set];
      },
      bySession: async (id) => tables.sets.filter((set) => set.sessionId === id),
      inRange: async (from, to) =>
        tables.sets.filter((set) => set.localDate >= from && set.localDate <= to),
    },
    profile: {
      get: async () => tables.profile[0],
      put: async (profile) => {
        tables.profile = [profile];
      },
    },
    equipment: {
      get: async (id) => tables.equipmentProfiles.find((profile) => profile.id === id),
      list: async () => [...tables.equipmentProfiles],
      put: async (profile) => upsert('equipmentProfiles', 'id', profile),
      delete: async (id) => {
        tables.equipmentProfiles = tables.equipmentProfiles.filter((profile) => profile.id !== id);
      },
    },
    plans: {
      get: async (id) => tables.plans.find((plan) => plan.id === id),
      getActive: async () => tables.plans.find((plan) => plan.status === 'active'),
      put: async (plan) => upsert('plans', 'id', plan),
    },
    plannedSessions: {
      get: async (id) => tables.plannedSessions.find((session) => session.id === id),
      byPlan: async (planId) =>
        byDate(tables.plannedSessions.filter((session) => session.planId === planId)),
      inRange: async (from, to) =>
        byDate(
          tables.plannedSessions.filter(
            (session) => session.localDate >= from && session.localDate <= to,
          ),
        ),
      putMany: async (sessions) => {
        for (const session of sessions) upsert('plannedSessions', 'id', session);
      },
      deleteMany: async (ids) => {
        tables.plannedSessions = tables.plannedSessions.filter(
          (session) => !ids.includes(session.id),
        );
      },
    },
    breaks: {
      get: async (id) => tables.breaks.find((entry) => entry.id === id),
      list: async () => tables.breaks.toSorted((a, b) => (a.startDate < b.startDate ? -1 : 1)),
      put: async (entry) => upsert('breaks', 'id', entry),
    },
    meets: {
      list: async () => [...tables.meets],
      put: async (meet) => upsert('meets', 'id', meet),
    },
    bodyweights: {
      put: async (entry) => upsert('bodyweights', 'id', entry),
    },
    raw: {
      readAll: async () => structuredClone(tables),
      replaceAll: async (next) => {
        Object.assign(tables, structuredClone(next));
      },
    },
  };
}

/** In-memory unit of work: each write runs on a copy that replaces the state only on success. */
function createMemoryUow(initial: RawTables = emptyRawTables()) {
  let state = structuredClone(initial);

  const uow: UnitOfWork = {
    async write(_tables, fn) {
      const draft = structuredClone(state);
      const result = await fn(repositories(draft));
      state = draft;
      return result;
    },
    async read(_tables, fn) {
      return fn(repositories(structuredClone(state)));
    },
  };

  return { uow, snapshot: () => structuredClone(state) };
}

/** The shipped registry, resolved like the app's lazy provider does. */
export const testRules: RulesProvider = {
  version: rulesStamp(BUILT_IN_RULES),
  resolve: async (context: ResolveContext, overrides: readonly ParamOverride[] = []) => {
    const { rules, issues } = resolveRules(BUILT_IN_RULES, context, overrides);
    return { rules, issues };
  },
};

export function createTestDeps(initial?: RawTables, options: { readonly start?: string } = {}) {
  const memory = createMemoryUow(initial);
  let epochMs = Date.parse(options.start ?? '2026-11-24T17:00:00Z');
  let idCounter = 0;
  const runtime = { activeSession: null as { id: SessionId; build: string } | null };
  const savedFiles: { name: string; bytes: Uint8Array }[] = [];
  const safetySnapshots: { fileName: string; bytes: Uint8Array }[] = [];
  let persistGranted = false;
  let saveOutcome: 'saved' | 'downloaded' | 'cancelled' = 'downloaded';

  const deps: Deps = {
    uow: memory.uow,
    queries: {
      activeSession: () => unsupported(),
      sessionSets: () => unsupported(),
      settings: () => unsupported(),
      meta: () => unsupported(),
      profile: () => unsupported(),
      equipmentProfiles: () => unsupported(),
      activePlan: () => unsupported(),
      plannedSessions: () => unsupported(),
      breaks: () => unsupported(),
    },
    clock: {
      now: () => {
        epochMs += 1000;
        return makeInstantTz(epochMs, 'Europe/Zurich');
      },
    },
    ids: { next: () => `id-${String(++idCounter).padStart(4, '0')}` },
    content: builtInContent(),
    rules: testRules,
    app: { version: '0.0.0', build: 'test' },
    runtime: {
      setActiveSession: async (value) => {
        runtime.activeSession = value;
      },
    },
    storage: {
      persisted: async () => persistGranted,
      requestPersist: async () => {
        persistGranted = true;
        return true;
      },
      estimate: async () => ({ usage: 1000, quota: 10_000 }),
    },
    files: {
      save: async (file) => {
        if (saveOutcome !== 'cancelled') savedFiles.push({ name: file.name, bytes: file.bytes });
        return saveOutcome;
      },
    },
    safety: {
      save: async (snapshot) => {
        safetySnapshots.push({ fileName: snapshot.fileName, bytes: snapshot.bytes });
      },
    },
  };

  return {
    deps,
    data: memory.snapshot,
    runtime,
    savedFiles,
    safetySnapshots,
    cancelNextSave: () => {
      saveOutcome = 'cancelled';
    },
    /** Moves the fake clock forward. */
    advanceDays: (days: number) => {
      epochMs += days * 86_400_000;
    },
  };
}

function unsupported(): never {
  throw new Error('Live queries are not used in application tests');
}
