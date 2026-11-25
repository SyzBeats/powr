/*
 * Search-param validators of the Progress routes (M4b, §8.9.1): plain functions without Zod
 * (TD-17), run by the route's lazy component (TD-63, `app/route-search.ts`). Unknown parameters
 * are dropped; an invalid value is dropped too (none of these is required).
 */

/** A content ID such as `ex.barbell-back-squat`, `cx.my-curl` or `mu.chest`. */
const CONTENT_ID = /^[a-z]{2}\.[a-z0-9][a-z0-9.-]*$/;

export type TrendSource = 'strength' | 'all';
export type VolumeMode = 'week' | 'lastWeek' | 'avg4';
export type PrTypeFilter = 'rep' | 'load' | 'e1rm' | 'volume';

export interface ExerciseSearch {
  readonly source?: TrendSource;
}

/** `/progress/exercise/$id?source=strength|all`: the e1RM trend's source (ANL-02). */
export function validateExerciseSearch(search: Record<string, unknown>): ExerciseSearch {
  const source = search['source'];
  return source === 'strength' || source === 'all' ? { source } : {};
}

export interface CompareSearch {
  readonly ids?: string;
}

/** `/progress/compare?ids=a,b,c`: up to three exercises (ANL-02). */
export function validateCompareSearch(search: Record<string, unknown>): CompareSearch {
  const ids = search['ids'];
  if (typeof ids !== 'string') return {};
  const list = [...new Set(ids.split(',').filter((id) => CONTENT_ID.test(id)))].slice(0, 3);
  return list.length > 0 ? { ids: list.join(',') } : {};
}

export interface VolumeSearch {
  readonly mode?: VolumeMode;
  readonly muscle?: string;
}

/** `/progress/volume?mode=week|lastWeek|avg4&muscle=mu.chest` (ANL-03). */
export function validateVolumeSearch(search: Record<string, unknown>): VolumeSearch {
  const { mode, muscle } = search;
  return {
    ...(mode === 'week' || mode === 'lastWeek' || mode === 'avg4' ? { mode } : {}),
    ...(typeof muscle === 'string' && CONTENT_ID.test(muscle) ? { muscle } : {}),
  };
}

export interface PrSearch {
  readonly type?: PrTypeFilter;
  readonly exercise?: string;
}

/** `/progress/prs?type=rep&exercise=ex.…` (ANL-05). */
export function validatePrSearch(search: Record<string, unknown>): PrSearch {
  const { type, exercise } = search;
  return {
    ...(type === 'rep' || type === 'load' || type === 'e1rm' || type === 'volume' ? { type } : {}),
    ...(typeof exercise === 'string' && CONTENT_ID.test(exercise) ? { exercise } : {}),
  };
}

export interface CalendarSearch {
  readonly month?: string;
}

/** `/progress/calendar?month=YYYY-MM` (ANL-06). */
export function validateCalendarSearch(search: Record<string, unknown>): CalendarSearch {
  const month = search['month'];
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? { month } : {};
}
