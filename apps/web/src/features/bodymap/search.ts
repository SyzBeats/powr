/*
 * Search parameters of the body-map routes (§8.9.1, M4b): plain functions, because route
 * definitions are on the startup path and Zod is not (TD-17). Defaults are left out of the URL;
 * unknown or invalid values are dropped.
 */

export type VolumeMode = 'week' | 'lastWeek' | 'avg4';
export type RankSort = 'effectiveness' | 'focus';

const MUSCLE_ID = /^mu\.[a-z0-9.-]+$/;

/** `?mode=lastWeek|avg4` (MAP-04 toggle; "this week" is the default). */
function modeOf(value: unknown): { mode?: 'lastWeek' | 'avg4' } {
  return value === 'lastWeek' || value === 'avg4' ? { mode: value } : {};
}

export interface BodyMapSearch {
  readonly mode?: 'lastWeek' | 'avg4';
  /** The back view (the front is the default). */
  readonly view?: 'back';
  /** MAP-06: the list alternative instead of the figure. */
  readonly show?: 'list';
  /** The muscle opened last, shown selected on return. */
  readonly selected?: string;
}

/** `/explore/body-map`: `?mode=`, `?view=back`, `?show=list`, `?selected=mu.chest`. */
export function validateBodyMapSearch(search: Record<string, unknown>): BodyMapSearch {
  const { view, show, selected } = search;
  return {
    ...modeOf(search['mode']),
    ...(view === 'back' ? { view } : {}),
    ...(show === 'list' ? { show } : {}),
    ...(typeof selected === 'string' && MUSCLE_ID.test(selected) ? { selected } : {}),
  };
}

export interface MuscleSearch {
  readonly mode?: 'lastWeek' | 'avg4';
  /** MAP-02 sort (Effectiveness is the default). */
  readonly sort?: 'focus';
  /** MAP-02 "include unavailable". */
  readonly unavailable?: true;
  /** The map's view and list choice to return to ("Back to the body map"). */
  readonly view?: 'back';
  readonly show?: 'list';
}

/**
 * `/explore/body-map/$muscleId`: `?mode=`, `?sort=focus`, `?unavailable=true`, and the map's
 * `?view=back` and `?show=list` to return to.
 */
export function validateMuscleSearch(search: Record<string, unknown>): MuscleSearch {
  const { sort, unavailable, view, show } = search;
  return {
    ...modeOf(search['mode']),
    ...(sort === 'focus' ? { sort } : {}),
    ...(unavailable === true || unavailable === 'true' ? { unavailable: true as const } : {}),
    ...(view === 'back' ? { view } : {}),
    ...(show === 'list' ? { show } : {}),
  };
}

/** What a link from the map to a muscle panel (or between panels) carries along. */
export function panelSearch(search: BodyMapSearch | MuscleSearch): MuscleSearch {
  return {
    ...(search.mode ? { mode: search.mode } : {}),
    ...(search.view ? { view: search.view } : {}),
    ...(search.show ? { show: search.show } : {}),
  };
}

/** The search with a change applied; `undefined` removes a parameter (back to its default). */
export function patchSearch<T extends object>(
  search: T,
  patch: { readonly [K in keyof T]?: T[K] | undefined },
): T {
  return Object.fromEntries(
    Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined),
  ) as T;
}
