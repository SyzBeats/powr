/**
 * Search parameters of `/session`. `?source=shortcut` is the manifest shortcut's URL (§8.4);
 * `?start=today` starts today's planned session at once (WKT-01 "one tap from Home", M3b).
 */
export interface SessionSearch {
  readonly source?: 'shortcut';
  readonly start?: 'today';
}

/**
 * TanStack Router's `validateSearch` for `/session`, without Zod: the route is on the startup
 * path, and Zod's core alone is about 25 kB gzip of entry JS (TD-17, §8.19). Like the Zod schema
 * it replaces, it drops unknown parameters and throws on an invalid `source` or `start`, which the
 * router turns into the route error boundary.
 */
export function validateSessionSearch(search: Record<string, unknown>): SessionSearch {
  const { source, start } = search;
  if (source !== undefined && source !== 'shortcut')
    throw new Error(`Invalid search parameter source=${JSON.stringify(source)}`);
  if (start !== undefined && start !== 'today')
    throw new Error(`Invalid search parameter start=${JSON.stringify(start)}`);
  return {
    ...(source === undefined ? {} : { source }),
    ...(start === undefined ? {} : { start }),
  };
}
