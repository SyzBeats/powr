/**
 * Page visibility and lifecycle (Page Visibility, Page Lifecycle): `visibilitychange`, `pageshow`
 * (back/forward cache) and `resume` (after a freeze). Injected everywhere so the timer engine, the
 * ticker, the alert scheduler and the wake-lock policy can be driven by fakes in unit tests.
 */
export interface PageLifecycle {
  readonly visible: () => boolean;
  /**
   * Calls back with `visible` on `visibilitychange → visible`, `pageshow` and `resume` (each a
   * moment to recompute immediately, §8.8.1) and with `hidden` on `visibilitychange → hidden`.
   */
  readonly listen: (callback: (state: 'visible' | 'hidden') => void) => () => void;
}

export function browserLifecycle(): PageLifecycle {
  return {
    visible: () => document.visibilityState === 'visible',
    listen(callback) {
      const onVisibility = () =>
        callback(document.visibilityState === 'visible' ? 'visible' : 'hidden');
      const onShow = () => {
        if (document.visibilityState === 'visible') callback('visible');
      };
      document.addEventListener('visibilitychange', onVisibility);
      document.addEventListener('resume', onShow);
      addEventListener('pageshow', onShow);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        document.removeEventListener('resume', onShow);
        removeEventListener('pageshow', onShow);
      };
    },
  };
}

/** Timer functions, injectable for fake clocks. */
export interface TimerFunctions {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export const browserTimers: TimerFunctions = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};
