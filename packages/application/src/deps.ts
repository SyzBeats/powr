import type { ContentCatalog } from '@powr/content';

import type {
  AppInfo,
  Clock,
  FileGateway,
  IdGenerator,
  LiveQueries,
  RuntimeFlags,
  SafetySnapshots,
  StoragePort,
  UnitOfWork,
} from './ports';

/** Everything a use case may touch; bound once in the composition root. */
export interface Deps {
  readonly uow: UnitOfWork;
  readonly queries: LiveQueries;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly content: ContentCatalog;
  readonly rulesVersion: string;
  readonly app: AppInfo;
  readonly runtime: RuntimeFlags;
  readonly storage: StoragePort;
  readonly files: FileGateway;
  readonly safety: SafetySnapshots;
}
