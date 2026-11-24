import type { Clock } from '@powr/application';
import { makeInstantTz } from '@powr/domain';

/** The only place that reads the wall clock for domain data (ADR-0015). */
export const systemClock: Clock = {
  now: () => makeInstantTz(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
};
