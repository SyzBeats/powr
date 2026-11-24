/** Search parameters of `/session`. `?source=shortcut` is the manifest shortcut's URL (§8.4). */
export interface SessionSearch {
  readonly source?: 'shortcut';
}

/**
 * TanStack Router's `validateSearch` for `/session`, without Zod: the route is on the startup
 * path, and Zod's core alone is about 25 kB gzip of entry JS (TD-17, §8.19). Like the Zod schema
 * it replaces, it drops unknown parameters and throws on an invalid `source`, which the router
 * turns into the route error boundary.
 */
export function validateSessionSearch(search: Record<string, unknown>): SessionSearch {
  const { source } = search;
  if (source === undefined) return {};
  if (source === 'shortcut') return { source };
  throw new Error(`Invalid search parameter source=${JSON.stringify(source)}`);
}
