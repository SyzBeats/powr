import { builtInContent } from '@powr/content';
import { makeInstantTz, type SessionId } from '@powr/domain';
import { emptyRawTables, type RawTables } from '@powr/formats';
import { RULES_VERSION } from '@powr/rules';

import type { Deps, Repositories, UnitOfWork } from '../src';

function repositories(tables: RawTables): Repositories {
  return {
    meta: {
      get: async (key) => tables.meta.find((record) => record.key === key),
      put: async (record) => {
        tables.meta = [...tables.meta.filter((r) => r.key !== record.key), record];
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
      put: async (session) => {
        tables.sessions = [...tables.sessions.filter((s) => s.id !== session.id), session];
      },
    },
    sets: {
      add: async (set) => {
        if (tables.sets.some((s) => s.id === set.id)) throw new Error('ConstraintError');
        tables.sets = [...tables.sets, set];
      },
      bySession: async (id) => tables.sets.filter((set) => set.sessionId === id),
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

export function createTestDeps(initial?: RawTables) {
  const memory = createMemoryUow(initial);
  let epochMs = Date.parse('2026-11-24T17:00:00Z');
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
    },
    clock: {
      now: () => {
        epochMs += 1000;
        return makeInstantTz(epochMs, 'Europe/Zurich');
      },
    },
    ids: { next: () => `id-${String(++idCounter).padStart(4, '0')}` },
    content: builtInContent(),
    rulesVersion: RULES_VERSION,
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
  };
}

function unsupported(): never {
  throw new Error('Live queries are not used in application tests');
}
