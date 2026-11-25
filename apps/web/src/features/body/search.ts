/*
 * Search-param validators of the bodyweight routes (BOD-01…03): plain functions, because route
 * definitions are on the startup path and Zod is not (TD-17). Invalid values are dropped.
 */

/** `/body/log?what=measurements`: which form the log screen opens with (default: bodyweight). */
export function validateBodyLogSearch(search: Record<string, unknown>): {
  what?: 'measurements';
} {
  return search['what'] === 'measurements' ? { what: 'measurements' } : {};
}
