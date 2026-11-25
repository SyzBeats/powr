import type * as InsightsEntry from '@powr/application/insights';

/**
 * The insight and motivation use cases (M4a: the analytics engine, the streak, bodyweight, the
 * scores) are a lazy chunk, so they stay off the startup path (§8.19); the service worker
 * precaches it, so the screens work offline from the first visit. Lint allows only type imports
 * of it elsewhere (`LAZY_INSIGHTS`). Its own module (TD-63): the shell's warm-up needs only this
 * loader, so the insight hooks (`use-insights.ts`, `use-load.ts`) load with the screens.
 */
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the chunk
export const loadInsights = (): Promise<Insights> => import('@powr/application/insights');

export type Insights = typeof InsightsEntry;
