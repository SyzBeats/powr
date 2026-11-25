/*
 * Search-param validators of the library routes (EXL-02, EXL-04): plain functions, because route
 * definitions are on the startup path and Zod is not (TD-17). Unknown or invalid values are
 * dropped; the use cases ignore an ID that is not in the catalog.
 */

export interface LibrarySearch {
  readonly q?: string;
  /** TD-56: several values per dimension (any of them matches; dimensions combine with AND). */
  readonly muscle?: readonly string[];
  readonly equipment?: readonly string[];
  readonly pattern?: readonly string[];
  readonly mechanics?: readonly ('compound' | 'isolation')[];
  readonly available?: true;
  readonly favourites?: true;
  readonly custom?: true;
  readonly hidden?: true;
}

const ID = /^[a-zA-Z0-9._-]{1,80}$/;

const id = (value: unknown): string | undefined =>
  typeof value === 'string' && ID.test(value) ? value : undefined;

/** One value or a list (an old single-value link still works); duplicates and junk dropped. */
const ids = (value: unknown, valid: (entry: unknown) => boolean = (entry) => !!id(entry)) => {
  const list = [...new Set((Array.isArray(value) ? value : [value]).filter(valid))].slice(0, 64);
  return list.length > 0 ? (list as string[]) : undefined;
};

const flag = (value: unknown): true | undefined =>
  value === true || value === 'true' || value === 1 || value === '1' ? true : undefined;

/** `/explore/exercises?q=…&muscle=["mu.chest"]&available=true…`: the query and the filters. */
export function validateLibrarySearch(search: Record<string, unknown>): LibrarySearch {
  const q = typeof search['q'] === 'string' ? search['q'].slice(0, 100) : undefined;
  const entries = {
    q: q || undefined,
    muscle: ids(search['muscle']),
    equipment: ids(search['equipment']),
    pattern: ids(search['pattern']),
    mechanics: ids(search['mechanics'], (entry) => entry === 'compound' || entry === 'isolation'),
    available: flag(search['available']),
    favourites: flag(search['favourites']),
    custom: flag(search['custom']),
    hidden: flag(search['hidden']),
  };
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== undefined),
  ) as LibrarySearch;
}

/** `/explore/exercises/new?from=<exerciseId>`: copy an exercise (EXL-04). */
export function validateNewCustomSearch(search: Record<string, unknown>): { from?: string } {
  const from = id(search['from']);
  return from ? { from } : {};
}
