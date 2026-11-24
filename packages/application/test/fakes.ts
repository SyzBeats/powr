import { builtInContent } from '@powr/content/built-in';
import { makeInstantTz, type SessionId } from '@powr/domain';
import type { ExerciseState, PrRecord, SessionE1rmPoint } from '@powr/domain/session';
import { RAW_TABLE_NAMES, emptyRawTables, type RawTableName, type RawTables } from '@powr/formats';
import { rulesStamp, type ParamOverride, type ResolveContext } from '@powr/rules';
import { BUILT_IN_RULES } from '@powr/rules/built-in';
import { resolveRules } from '@powr/rules/resolve';

import {
  sessionExerciseIds,
  type ActiveSessionData,
  type Deps,
  type Observable,
  type Repositories,
  type RulesProvider,
  type UnitOfWork,
} from '../src';

/** The in-memory database: raw tables plus the derived tables (§8.2.2). */
export type MemoryTables = RawTables & {
  dExerciseState: ExerciseState[];
  dSessionE1rm: SessionE1rmPoint[];
  dPrs: PrRecord[];
};

/** A memory database from raw tables, or a copy of another one with its derived tables. */
function emptyMemory(raw: RawTables | MemoryTables = emptyRawTables()): MemoryTables {
  const copy = structuredClone(raw) as Partial<MemoryTables> & RawTables;
  return {
    ...copy,
    dExerciseState: copy.dExerciseState ?? [],
    dSessionE1rm: copy.dSessionE1rm ?? [],
    dPrs: copy.dPrs ?? [],
  };
}

const byTime = <T extends { performedAt: { epochMs: number } }>(entries: T[]): T[] =>
  entries.toSorted((a, b) => a.performedAt.epochMs - b.performedAt.epochMs);

function byDate<T extends { localDate: string }>(entries: T[]): T[] {
  return entries.toSorted((a, b) =>
    a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0,
  );
}

/** In-memory repositories over plain arrays: the fake of the Dexie adapters (§5.5). */
function repositories(tables: MemoryTables): Repositories {
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
      delete: async (id) => {
        tables.sessions = tables.sessions.filter((session) => session.id !== id);
      },
      byIds: async (ids) => tables.sessions.filter((session) => ids.includes(session.id)),
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
      put: async (set) => upsert('sets', 'id', set),
      delete: async (id) => {
        tables.sets = tables.sets.filter((set) => set.id !== id);
      },
      bySession: async (id) => tables.sets.filter((set) => set.sessionId === id),
      byExercise: async (id) => byTime(tables.sets.filter((set) => set.exerciseId === id)),
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
      list: async () =>
        tables.bodyweights.toSorted((a, b) => a.measuredAt.epochMs - b.measuredAt.epochMs),
    },
    readiness: {
      put: async (entry) => upsert('readiness', 'id', entry),
      inRange: async (from, to) =>
        tables.readiness.filter((entry) => entry.localDate >= from && entry.localDate <= to),
      bySession: async (id) => tables.readiness.filter((entry) => entry.sessionId === id),
    },
    derived: {
      exerciseStates: async (ids) =>
        tables.dExerciseState.filter((state) => ids.includes(state.exerciseId)),
      replaceExercise: async (exerciseId, derived) => {
        tables.dExerciseState = [
          ...tables.dExerciseState.filter((state) => state.exerciseId !== exerciseId),
          derived.state,
        ];
        tables.dSessionE1rm = [
          ...tables.dSessionE1rm.filter((point) => point.exerciseId !== exerciseId),
          ...derived.points,
        ];
        tables.dPrs = [...tables.dPrs.filter((pr) => pr.exerciseId !== exerciseId), ...derived.prs];
      },
      prsBySession: async (id) => tables.dPrs.filter((pr) => pr.sessionId === id),
      prsByExercise: async (id) => tables.dPrs.filter((pr) => pr.exerciseId === id),
      pointsByExercise: async (id) =>
        tables.dSessionE1rm.filter((point) => point.exerciseId === id),
      invalidate: async (ids) => {
        tables.dExerciseState = tables.dExerciseState.filter(
          (state) => !ids.includes(state.exerciseId),
        );
      },
      clear: async () => {
        tables.dExerciseState = [];
        tables.dSessionE1rm = [];
        tables.dPrs = [];
      },
    },
    raw: {
      readAll: async () =>
        structuredClone(
          Object.fromEntries(RAW_TABLE_NAMES.map((table) => [table, tables[table]])) as RawTables,
        ),
      replaceAll: async (next) => {
        Object.assign(tables, structuredClone(next), {
          dExerciseState: [],
          dSessionE1rm: [],
          dPrs: [],
        });
      },
    },
  };
}

/** In-memory unit of work: each write runs on a copy that replaces the state only on success. */
function createMemoryUow(initial?: RawTables | MemoryTables) {
  let state = emptyMemory(initial);
  const listeners = new Set<() => void>();

  const uow: UnitOfWork = {
    async write(_tables, fn) {
      const draft = structuredClone(state);
      const result = await fn(repositories(draft));
      state = draft;
      for (const listener of listeners) listener();
      return result;
    },
    async read(_tables, fn) {
      return fn(repositories(structuredClone(state)));
    },
  };

  /** A live query over the memory: emits now and after every committed write. */
  function live<T>(query: (tables: MemoryTables) => T): Observable<T> {
    return {
      subscribe(observer) {
        const emit = () => observer.next(query(structuredClone(state)));
        listeners.add(emit);
        emit();
        return { unsubscribe: () => void listeners.delete(emit) };
      },
    };
  }

  return { uow, live, snapshot: () => structuredClone(state) };
}

/** The shipped registry, resolved like the app's lazy provider does. */
export const testRules: RulesProvider = {
  version: rulesStamp(BUILT_IN_RULES),
  resolve: async (context: ResolveContext, overrides: readonly ParamOverride[] = []) => {
    const { rules, issues } = resolveRules(BUILT_IN_RULES, context, overrides);
    return { rules, issues };
  },
};

export function createTestDeps(
  initial?: RawTables | MemoryTables,
  options: { readonly start?: string } = {},
) {
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
      activeSessionData: () =>
        memory.live((tables): ActiveSessionData | undefined => {
          const session = tables.sessions.find((entry) => entry.status === 'active');
          if (!session) return undefined;
          const sets = tables.sets.filter((set) => set.sessionId === session.id);
          const ids = sessionExerciseIds(session, sets);
          return {
            session,
            sets,
            states: tables.dExerciseState.filter((entry) => ids.includes(entry.exerciseId)),
          };
        }),
      sessionPrs: (id) => memory.live((tables) => tables.dPrs.filter((pr) => pr.sessionId === id)),
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
