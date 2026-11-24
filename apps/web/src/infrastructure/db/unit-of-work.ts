import type { TableName, UnitOfWork } from '@powr/application';

import { createRepositories } from './repositories';
import type { PowrDb } from './schema';

/**
 * One use case = one IndexedDB transaction over the declared tables (§8.2.4). Writes use the
 * database's strict durability. Only IndexedDB calls may be awaited inside `fn`.
 */
export function createUnitOfWork(db: PowrDb): UnitOfWork {
  const repos = createRepositories(db);
  const tablesOf = (names: readonly TableName[]) => names.map((name) => db.table(name));
  return {
    write: (tables, fn) => db.transaction('rw', tablesOf(tables), () => fn(repos)),
    read: (tables, fn) => db.transaction('r', tablesOf(tables), () => fn(repos)),
  };
}
