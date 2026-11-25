import type { TableName, UnitOfWork } from '@powr/application';

import { createRepositories } from './repositories';
import type { PowrDb } from './schema';

/**
 * One use case = one IndexedDB transaction over the declared tables (§8.2.4). Writes use the
 * database's strict durability. Only IndexedDB calls may be awaited inside `fn`.
 *
 * The scope functions are `async` on purpose (M3b fix): Dexie keeps its transaction zone across
 * native `await`s only for a scope function it recognises as async. With a plain arrow, a call
 * after a few nested awaits (M3a's FINISH of a planned session: persist, then `plan.complete`)
 * ran outside the transaction, which then committed early (`PrematureCommitError`).
 */
export function createUnitOfWork(db: PowrDb): UnitOfWork {
  const repos = createRepositories(db);
  const tablesOf = (names: readonly TableName[]) => names.map((name) => db.table(name));
  return {
    write: (tables, fn) => db.transaction('rw', tablesOf(tables), async () => fn(repos)),
    read: (tables, fn) => db.transaction('r', tablesOf(tables), async () => fn(repos)),
  };
}
