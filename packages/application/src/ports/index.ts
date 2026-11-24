import type { InstantTz, LoggedSet, Session, SessionId } from '@powr/domain';
import type { MetaRecord, RawTableName, RawTables, SettingsRecord } from '@powr/formats';

/** Minimal observable, structurally compatible with Dexie's liveQuery result. */
export interface Observable<T> {
  subscribe(observer: { next(value: T): void; error?(error: unknown): void }): {
    unsubscribe(): void;
  };
}

export interface Clock {
  /** Wall clock with offset and IANA zone. */
  now(): InstantTz;
}

/** UUIDv7, time-ordered for index locality. */
export interface IdGenerator {
  next(): string;
}

/** M0 subset of the raw tables (§8.2.2); the rest arrive with their features. */
export type TableName = RawTableName;

export interface UnitOfWork {
  /** One IndexedDB transaction with strict durability. All writes inside commit or none do. */
  write<T>(tables: readonly TableName[], fn: (repos: Repositories) => Promise<T>): Promise<T>;
  read<T>(tables: readonly TableName[], fn: (repos: Repositories) => Promise<T>): Promise<T>;
}

export interface Repositories {
  meta: MetaRepo;
  settings: SettingsRepo;
  sessions: SessionRepo;
  sets: SetRepo;
  raw: RawDataRepo;
}

export interface MetaRepo {
  get(key: string): Promise<MetaRecord | undefined>;
  put(record: MetaRecord): Promise<void>;
}

export interface SettingsRepo {
  get(): Promise<SettingsRecord | undefined>;
  put(settings: SettingsRecord): Promise<void>;
}

export interface SessionRepo {
  get(id: SessionId): Promise<Session | undefined>;
  getActive(): Promise<Session | undefined>;
  put(session: Session): Promise<void>;
}

export interface SetRepo {
  add(set: LoggedSet): Promise<void>;
  bySession(id: SessionId): Promise<LoggedSet[]>;
}

/** Whole-dataset access for backup export and replace-all restore. */
export interface RawDataRepo {
  readAll(): Promise<RawTables>;
  replaceAll(tables: RawTables): Promise<void>;
}

/**
 * Flags in the separate `powr-runtime` database that the service worker reads.
 * `activeSession` gates service-worker installs (§6.3).
 */
export interface RuntimeFlags {
  setActiveSession(value: { id: SessionId; build: string } | null): Promise<void>;
}

export interface StoragePort {
  persisted(): Promise<boolean>;
  requestPersist(): Promise<boolean>;
  estimate(): Promise<{ usage: number; quota: number } | null>;
}

export interface FileGateway {
  save(file: {
    name: string;
    bytes: Uint8Array;
    mime: string;
  }): Promise<'saved' | 'downloaded' | 'cancelled'>;
}

/** Keeps the latest safety snapshots taken before imports and migrations (`powr-safety`). */
export interface SafetySnapshots {
  save(snapshot: {
    fileName: string;
    bytes: Uint8Array;
    reason: 'import' | 'migration';
    at: InstantTz;
  }): Promise<void>;
}

export interface AppInfo {
  readonly version: string;
  readonly build: string;
}

export type { LiveQueries } from './queries';
export type {
  AlertScheduler,
  AudioPort,
  CapabilityProbe,
  CapabilityReport,
  CapabilityValue,
  CueId,
  DiagnosticsPort,
  HapticsPort,
  NotificationPermissionState,
  NotificationPort,
  WakeLockPort,
} from './platform';
