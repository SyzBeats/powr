import type {
  BodyweightEntry,
  BreakId,
  CustomExercise,
  EquipmentProfile,
  ExerciseUserData,
  InstantTz,
  LocalDate,
  LoggedSet,
  MeasurementEntry,
  MeetInfo,
  Plan,
  PlanId,
  ExerciseId,
  PlannedSession,
  PlannedSessionId,
  Profile,
  ReadinessEntry,
  Session,
  SessionId,
  SetId,
  TrainingBreak,
} from '@powr/domain';
import type { WeeklyRecord } from '@powr/domain/analytics';
import type { RuleSet } from '@powr/domain/rules';
import type { ExerciseState, PrRecord, SessionE1rmPoint } from '@powr/domain/session';
import type { Streak, StreakWeekInput } from '@powr/domain/streaks';
import type { MetaRecord, RawTableName, RawTables, SettingsRecord } from '@powr/formats';
import type { ParamOverride, ResolveContext } from '@powr/rules';

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

/**
 * Derived tables (§8.2.2, §8.2.8): rebuildable caches, never backed up. M3a: the exercise state,
 * one e1RM point per exercise and session, and the PR records. M4a: the weekly analytics and the
 * streak.
 */
export const DERIVED_TABLE_NAMES = [
  'dExerciseState',
  'dSessionE1rm',
  'dPrs',
  'dWeekly',
  'dStreak',
] as const;
export type DerivedTableName = (typeof DERIVED_TABLE_NAMES)[number];

/** Every table of `powr` a unit of work may name. */
export type TableName = RawTableName | DerivedTableName;

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
  profile: ProfileRepo;
  equipment: EquipmentProfileRepo;
  plans: PlanRepo;
  plannedSessions: PlannedSessionRepo;
  breaks: BreakRepo;
  meets: MeetRepo;
  bodyweights: BodyweightRepo;
  readiness: ReadinessRepo;
  customExercises: CustomExerciseRepo;
  exerciseUserData: ExerciseUserDataRepo;
  measurements: MeasurementRepo;
  derived: DerivedRepo;
  insights: InsightsRepo;
  raw: RawDataRepo;
}

/** Custom exercises (EXL-04; raw table `customExercises`). */
export interface CustomExerciseRepo {
  get(id: ExerciseId): Promise<CustomExercise | undefined>;
  list(): Promise<CustomExercise[]>;
  put(exercise: CustomExercise): Promise<void>;
  delete(id: ExerciseId): Promise<void>;
}

/** Per-exercise user data (EXL-09 setup memory, training max; raw table `exerciseUserData`). */
export interface ExerciseUserDataRepo {
  get(id: ExerciseId): Promise<ExerciseUserData | undefined>;
  list(): Promise<ExerciseUserData[]>;
  put(entry: ExerciseUserData): Promise<void>;
  delete(id: ExerciseId): Promise<void>;
}

/** Body measurements (BOD-03; raw table `measurements`). */
export interface MeasurementRepo {
  get(id: string): Promise<MeasurementEntry | undefined>;
  /** Every measurement, by measurement time. */
  list(): Promise<MeasurementEntry[]>;
  put(entry: MeasurementEntry): Promise<void>;
  delete(id: string): Promise<void>;
}

/** The M4a derived tables `dWeekly` (one record per user week) and `dStreak` (one record). */
export interface InsightsRepo {
  /** Weekly records with `from ≤ weekStart ≤ to`, in date order. */
  weeks(from: LocalDate, to: LocalDate): Promise<WeeklyRecord[]>;
  putWeeks(records: readonly WeeklyRecord[]): Promise<void>;
  deleteWeeks(weekStarts: readonly LocalDate[]): Promise<void>;
  streak(): Promise<StreakRecord | undefined>;
  putStreak(record: StreakRecord): Promise<void>;
}

/** What one recorded week contributes to the streak (mirrors its `dWeekly` record). */
export interface StreakWeekEntry extends StreakWeekInput {
  /** The week's first day with a counting session or a planned session. */
  readonly firstDay: LocalDate;
}

/** The derived streak (table `dStreak`, key `'me'`): the streak and what it was computed from. */
export interface StreakRecord {
  readonly id: 'me';
  /** Fingerprint of the settings, versions, breaks and the current week it was computed for. */
  readonly key: string;
  /** The weeks' base fingerprint it was computed with; another one rebuilds every week. */
  readonly baseKey: string;
  /** Every recorded week's contribution, oldest first (kept in step with `dWeekly`). */
  readonly inputs: readonly StreakWeekEntry[];
  readonly streak: Streak;
}

/** The single local profile (ONB-13). */
export interface ProfileRepo {
  get(): Promise<Profile | undefined>;
  put(profile: Profile): Promise<void>;
}

/** Equipment profiles (EQP-02/03/07; several from EQP-06). */
export interface EquipmentProfileRepo {
  get(id: string): Promise<EquipmentProfile | undefined>;
  list(): Promise<EquipmentProfile[]>;
  put(profile: EquipmentProfile): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface PlanRepo {
  get(id: PlanId): Promise<Plan | undefined>;
  /** Every plan, active and ended (M4a: targets of past weeks, chart annotations). */
  list(): Promise<Plan[]>;
  /** The one plan with status `active`, if any. */
  getActive(): Promise<Plan | undefined>;
  put(plan: Plan): Promise<void>;
}

export interface PlannedSessionRepo {
  get(id: PlannedSessionId): Promise<PlannedSession | undefined>;
  byPlan(planId: PlanId): Promise<PlannedSession[]>;
  /** Sessions with `from ≤ localDate ≤ to`, in date order. */
  inRange(from: LocalDate, to: LocalDate): Promise<PlannedSession[]>;
  putMany(sessions: readonly PlannedSession[]): Promise<void>;
  deleteMany(ids: readonly PlannedSessionId[]): Promise<void>;
}

/** Planned and retroactive breaks (PLN-12, MOT-04). */
export interface BreakRepo {
  get(id: BreakId): Promise<TrainingBreak | undefined>;
  list(): Promise<TrainingBreak[]>;
  put(entry: TrainingBreak): Promise<void>;
}

/** Meet details (ONB-09). */
export interface MeetRepo {
  list(): Promise<MeetInfo[]>;
  put(meet: MeetInfo): Promise<void>;
}

/** Bodyweight log (BOD-01); onboarding writes the first entry (ONB-02). */
export interface BodyweightRepo {
  put(entry: BodyweightEntry): Promise<void>;
  /** Every entry, by measurement time (the trend for bodyweight-loaded e1RMs, WKT-11). */
  list(): Promise<BodyweightEntry[]>;
  /** M4a (BOD-01): edit and delete past entries. */
  get(id: string): Promise<BodyweightEntry | undefined>;
  delete(id: string): Promise<void>;
}

/** Readiness check-ins (RDY-01). */
export interface ReadinessRepo {
  put(entry: ReadinessEntry): Promise<void>;
  /** Check-ins with `from ≤ localDate ≤ to` (the RDY-02 baseline window). */
  inRange(from: LocalDate, to: LocalDate): Promise<ReadinessEntry[]>;
  bySession(id: SessionId): Promise<ReadinessEntry[]>;
}

/** The derived data of one exercise, rebuilt together (§8.2.8). */
export interface DerivedExercise {
  readonly state: ExerciseState;
  readonly points: readonly SessionE1rmPoint[];
  readonly prs: readonly PrRecord[];
}

/** Derived tables; written with the raw data's transaction or right after it. */
export interface DerivedRepo {
  exerciseStates(ids: readonly ExerciseId[]): Promise<ExerciseState[]>;
  /** Replaces an exercise's state, e1RM points and PRs. */
  replaceExercise(exerciseId: ExerciseId, derived: DerivedExercise): Promise<void>;
  prsBySession(id: SessionId): Promise<PrRecord[]>;
  prsByExercise(id: ExerciseId): Promise<PrRecord[]>;
  pointsByExercise(id: ExerciseId): Promise<SessionE1rmPoint[]>;
  /** M4a: PRs and e1RM points with `from ≤ localDate ≤ to` (PR history, Home's recent changes). */
  prsInRange(from: LocalDate, to: LocalDate): Promise<PrRecord[]>;
  pointsInRange(from: LocalDate, to: LocalDate): Promise<SessionE1rmPoint[]>;
  /** Drops the states of these exercises, so they are rebuilt from the raw logs on next use. */
  invalidate(ids: readonly ExerciseId[]): Promise<void>;
  /** Drops every derived record of the tables in the transaction (import, "Verify data"). */
  clear(): Promise<void>;
}

export interface MetaRepo {
  get(key: string): Promise<MetaRecord | undefined>;
  put(record: MetaRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * The rules registry (§8.6.2, TD-31). `version` is the hashed version of the shipped
 * `rules.json` (`1.0.0+<hash12>`), stamped on sessions, plans and derived data (PRG-18).
 * `resolve` applies context variants and the user's overrides; the app loads the resolver
 * (and Zod) lazily on the first call, so it stays off the startup path (§8.19).
 */
export interface RulesProvider {
  readonly version: string;
  resolve(context: ResolveContext, overrides?: readonly ParamOverride[]): Promise<ResolvedRules>;
}

/** A resolved rule set plus the overrides the resolver ignored (with the reason). */
export interface ResolvedRules {
  readonly rules: RuleSet;
  readonly issues: readonly string[];
}

export interface SettingsRepo {
  get(): Promise<SettingsRecord | undefined>;
  put(settings: SettingsRecord): Promise<void>;
}

export interface SessionRepo {
  get(id: SessionId): Promise<Session | undefined>;
  getActive(): Promise<Session | undefined>;
  put(session: Session): Promise<void>;
  delete(id: SessionId): Promise<void>;
  /** Several sessions by ID (missing ones are left out). */
  byIds(ids: readonly SessionId[]): Promise<Session[]>;
  /** The latest session on a day before `date` (days since training, PRG-13). */
  latestBefore(date: LocalDate): Promise<Session | undefined>;
  /** Sessions with `from ≤ localDate ≤ to` (logged volume of a mesocycle, PLN-13). */
  inRange(from: LocalDate, to: LocalDate): Promise<Session[]>;
}

export interface SetRepo {
  add(set: LoggedSet): Promise<void>;
  put(set: LoggedSet): Promise<void>;
  delete(id: SetId): Promise<void>;
  bySession(id: SessionId): Promise<LoggedSet[]>;
  /** Every set of an exercise, by `performedAt` (the derived-data rebuild, §6.9). */
  byExercise(id: ExerciseId): Promise<LoggedSet[]>;
  /** Sets with `from ≤ localDate ≤ to`. */
  inRange(from: LocalDate, to: LocalDate): Promise<LoggedSet[]>;
}

/** Whole-dataset access for backup export and replace-all restore. */
export interface RawDataRepo {
  readAll(): Promise<RawTables>;
  /** Clears and refills every raw table; derived tables are cleared too (rebuilt on use). */
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

/** A stored safety snapshot, without its bytes (Data and backups → "Safety copies"). */
export interface SafetySnapshotInfo {
  readonly id: number;
  readonly fileName: string;
  readonly reason: 'import' | 'migration';
  /** ISO 8601 with offset. */
  readonly at: string;
  readonly size: number;
}

/**
 * The safety snapshots taken before imports and migrations (`powr-safety`); the application prunes
 * them (`pruneSafetyCopies`, TD-67).
 */
export interface SafetySnapshots {
  save(snapshot: {
    fileName: string;
    bytes: Uint8Array;
    reason: 'import' | 'migration';
    at: InstantTz;
  }): Promise<void>;
  /** M5d: the stored snapshots, newest first. */
  list(): Promise<SafetySnapshotInfo[]>;
  read(id: number): Promise<Uint8Array | undefined>;
  delete(id: number): Promise<void>;
}

export interface AppInfo {
  readonly version: string;
  readonly build: string;
}

export type { ActiveSessionData, LiveQueries } from './queries';
export { sessionExerciseIds } from './queries';
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
