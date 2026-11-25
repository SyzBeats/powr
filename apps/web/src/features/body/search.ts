/*
 * Search-param validators of the bodyweight routes (BOD-01…03): plain functions without Zod
 * (TD-17), run by the route's lazy component (TD-63, `app/route-search.ts`). Invalid values are
 * dropped.
 */

export interface BodyLogSearch {
  readonly what?: 'measurements';
}

/** `/body/log?what=measurements`: which form the log screen opens with (default: bodyweight). */
export function validateBodyLogSearch(search: Record<string, unknown>): BodyLogSearch {
  return search['what'] === 'measurements' ? { what: 'measurements' } : {};
}
