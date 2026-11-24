import { useMemo } from 'react';

import { setWeekStart as storeWeekStart, type Deps } from '@powr/application';
import type * as PlanningEntry from '@powr/application/planning';
import type { IsoWeekday, LocalDate } from '@powr/domain';

import { useContainer } from '../app/container-context';
import { localeWeekStart } from '../i18n/format';
import { useObservable } from './use-observable';

/**
 * The onboarding and planning use cases (plan generator, rules resolver, scheduling) are a lazy
 * chunk, so they stay off the startup path (§8.19); the service worker precaches it, so the
 * screens work offline from the first visit. Lint allows only type imports of it elsewhere.
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
const loadPlanning = () => import('@powr/application/planning');

export type Planning = typeof PlanningEntry;

/**
 * Runs planning use cases: `run((planning, deps) => planning.generatePlanPreview(deps, …))`.
 * Loads the chunk on first use and passes the container's dependencies.
 */
export function usePlanning() {
  const { deps } = useContainer();
  return useMemo(
    () =>
      async function run<T>(task: (planning: Planning, deps: Deps) => Promise<T> | T): Promise<T> {
        return task(await loadPlanning(), deps);
      },
    [deps],
  );
}

/** The content catalog (exercises, muscles, equipment, templates); loaded at boot. */
export function useCatalog() {
  return useContainer().deps.content;
}

export function useProfile() {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.profile(), [deps]);
  return useObservable(observable);
}

export function useEquipmentProfiles() {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.equipmentProfiles(), [deps]);
  return useObservable(observable);
}

export function useActivePlan() {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.activePlan(), [deps]);
  return useObservable(observable);
}

export function usePlannedSessions(from: LocalDate, to: LocalDate) {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.plannedSessions(from, to), [deps, from, to]);
  return useObservable(observable);
}

export function useBreaks() {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.breaks(), [deps]);
  return useObservable(observable);
}

function useSettings() {
  const { deps } = useContainer();
  const observable = useMemo(() => deps.queries.settings(), [deps]);
  return useObservable(observable);
}

/**
 * The week start (SET-11, NFR-L10N-01): the user's setting, else the device locale's first day
 * (`Intl.Locale` week info), else Monday. `stored` is null while it follows the locale.
 */
export function useWeekStart(): {
  readonly weekStart: IsoWeekday;
  readonly stored: IsoWeekday | null;
  readonly loaded: boolean;
} {
  const settings = useSettings();
  const stored = settings.loaded
    ? ((settings.value?.weekStart as IsoWeekday | undefined) ?? null)
    : null;
  return { weekStart: stored ?? localeWeekStart(), stored, loaded: settings.loaded };
}

export function useSetWeekStart() {
  const { deps } = useContainer();
  return (weekStart: IsoWeekday | null) => storeWeekStart(deps, weekStart);
}
