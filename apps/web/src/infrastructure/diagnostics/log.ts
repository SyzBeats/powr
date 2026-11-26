import { Dexie, type Table } from 'dexie';

import type { DiagnosticsPort } from '@powr/application';

/**
 * Each code declares the only data fields it may carry, so no free text, notes, names or body
 * data can end up in the log (§8.17). Unknown fields are dropped.
 */
const DIAGNOSTIC_CODES = {
  'app.start': ['releaseTarget', 'standalone'],
  'db.open': ['ms', 'dataVersion'],
  'db.error': ['name'],
  // M5d (DAT-14): the data update, its safety snapshot and the recovery screen.
  'db.upgrade': ['from', 'to'],
  'db.snapshot': ['from', 'bytes', 'ms'],
  'db.snapshotError': ['name'],
  'db.recovery': ['kind'],
  'db.versionchange': [],
  // M6d: a database created from scratch (Chromium's `dataLoss` when it dropped a damaged store),
  // data that is gone while the marker says it existed, and "Start again without data".
  'db.created': ['dataLoss'],
  'db.missing': ['phase', 'existing', 'dataLoss'],
  'db.startAgain': [],
  // M5d: calendar export (CAL-01) and install promotion (PWA-02).
  'calendar.exported': ['events', 'cancelled', 'delivery'],
  'install.prompt': ['outcome'],
  'content.error': ['name'],
  'rules.error': ['name'],
  'i18n.error': ['name'],
  'set.logged': ['commitMs', 'startedSession'],
  'session.finished': [],
  'backup.exported': ['bytes', 'ms'],
  'backup.imported': ['ms'],
  'backup.rejected': ['kind'],
  'storage.persist': ['granted', 'trigger'],
  'sw.offlineReady': [],
  'sw.updateAvailable': [],
  'sw.error': ['name'],
  'error.unhandled': ['name', 'source'],
  'alerts.event': [
    'runId',
    'variant',
    'event',
    'path',
    'delayMs',
    'visibility',
    'restMs',
    'result',
  ],
  // M3t (§8.8): the timer engine's clock-jump check, wake-lock outcomes, production alert ends.
  'timer.clockJump': ['deltaMs', 'visibility'],
  'wakeLock.state': ['state', 'reason'],
  'alerts.end': ['path', 'delayMs', 'kind', 'hidden'],
  'alerts.error': ['name'],
} as const satisfies Record<string, readonly string[]>;

type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;

const CAPACITY = 1000;
const PRUNE_EVERY = 50;

export interface DiagnosticEntry {
  seq?: number;
  ts: number;
  level: 'debug' | 'info' | 'error';
  code: string;
  route: string;
  appVersion: string;
  data: Record<string, string | number | boolean | null>;
}

class DiagnosticsDb extends Dexie {
  declare entries: Table<DiagnosticEntry, number>;

  constructor() {
    super('powr-diag');
    this.version(1).stores({ entries: '++seq, code' });
  }
}

export interface Diagnostics extends DiagnosticsPort {
  readonly recent: (limit: number) => Promise<DiagnosticEntry[]>;
  /** "Delete all data" (DAT-13): deletes `powr-diag`; later log calls write nothing. */
  readonly wipe: () => Promise<void>;
}

export function createDiagnostics(options: {
  app: { version: string; build: string };
  /** Extra sections for the export, e.g. the capability snapshot. */
  context: () => Promise<Record<string, unknown>>;
}): Diagnostics {
  const db = new DiagnosticsDb();
  let writes = 0;
  let wiped = false;

  async function prune(): Promise<void> {
    const count = await db.entries.count();
    if (count <= CAPACITY) return;
    const oldest = await db.entries
      .orderBy('seq')
      .limit(count - CAPACITY)
      .primaryKeys();
    await db.entries.bulkDelete(oldest);
  }

  return {
    log: (level, code, data = {}) => {
      if (wiped) return;
      const allowed: readonly string[] = DIAGNOSTIC_CODES[code as DiagnosticCode] ?? [];
      const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => allowed.includes(key)),
      );
      const entry: DiagnosticEntry = {
        ts: Date.now(),
        level,
        code: code in DIAGNOSTIC_CODES ? code : 'diag.unknownCode',
        route: location.pathname,
        appVersion: `${options.app.version}+${options.app.build}`,
        data: safeData,
      };
      void db.entries
        .add(entry)
        .then(() => (++writes % PRUNE_EVERY === 0 ? prune() : undefined))
        .catch(() => {
          // Diagnostics must never break the app.
        });
    },

    // oxlint-disable-next-line unicorn/no-array-reverse -- a Dexie collection, not an array
    recent: (limit) => db.entries.orderBy('seq').reverse().limit(limit).toArray(),

    exportAll: async () => {
      const exportedAt = new Date();
      const payload = {
        diagnosticsVersion: 1,
        app: options.app,
        exportedAt: exportedAt.toISOString(),
        ...(await options.context()),
        entries: await db.entries.orderBy('seq').toArray(),
      };
      const stamp = exportedAt.toISOString().slice(0, 16).replace(/[-:T]/g, '');
      return { fileName: `powr-diagnostics-${stamp}.txt`, text: JSON.stringify(payload, null, 2) };
    },

    wipe: async () => {
      wiped = true;
      await db.delete();
    },
  };
}
