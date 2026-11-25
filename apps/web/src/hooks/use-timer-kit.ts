import { use } from 'react';

import type { TimerKit } from '../app/container';
import { useContainer } from '../app/container-context';

/**
 * The timer and alert kit (§8.8), loaded on first use (product-owner decision 2026-11-24): the
 * component suspends until the lazy chunk is there, so render it inside a `<Suspense>` (route
 * components already are). Only the session screens, the shell's session runtime, Settings →
 * Alerts and the debug harness use it, so the startup path never loads it. `use()` runs on every
 * render (never conditionally); once loaded, the promise is marked fulfilled and reads at once.
 */
export function useTimerKit(): TimerKit {
  return use(useContainer().platform.timers.load());
}
