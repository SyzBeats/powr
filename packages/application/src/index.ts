export type { Deps } from './deps';
export type * from './ports';
export { DERIVED_TABLE_NAMES, sessionExerciseIds } from './ports';
export { err, ok, type Result } from './result';
// Backup use cases are a separate entry, `@powr/application/backup`, loaded lazily by the app
// so Zod record schemas and fflate stay out of the startup bundle (technical concept §8.19).
export {
  finishSession,
  logSet,
  reconcileRuntimeFlags,
  type FinishSessionError,
  type LogSetCommand,
  type LogSetError,
  type LogSetResult,
} from './usecases/session';
export { setTheme } from './usecases/settings';
export { loadCustomExercises } from './usecases/custom-content';
export { firstRunState, setWeekStart, type LegalVersions } from './usecases/first-run';
export {
  getStorageStatus,
  requestPersistentStorage,
  type PersistTrigger,
  type StorageStatus,
} from './usecases/storage';
