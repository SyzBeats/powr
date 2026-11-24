import type { PageLifecycle } from './lifecycle';

/**
 * Screen Wake Lock policy (technical concept §8.8.3, PWA-06, SET-10, R-15): the screen stays on
 * while all of these hold: a session is active, its UI (session screen or mini timer) is mounted,
 * the page is visible, and the setting is on. The browser releases the lock when the page hides;
 * it is re-acquired on `visible`. It is released explicitly when the last holder lets go (finish,
 * discard, leaving the session UI) or the setting is switched off. A refused request is not
 * retried until something changes (no request loops), and its reason is kept for Settings.
 */
export type WakeLockState = 'off' | 'held' | 'released' | 'denied' | 'unsupported';

export interface WakeLockStatus {
  readonly supported: boolean;
  /** The SET-10 setting "Keep screen on during workouts". */
  readonly enabled: boolean;
  /**
   * `off`: not wanted right now (no active session UI, setting off). `held`. `released`: the
   * browser let go (page hidden) and it will be re-acquired. `denied`: the last request was
   * refused (battery saver, policy). `unsupported`: no Screen Wake Lock API.
   */
  readonly state: WakeLockState;
  /** `DOMException.name` of the last refusal (usually `NotAllowedError`), else null. */
  readonly reason: string | null;
}

interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
}

export interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

export interface WakeLockPolicy {
  /** A session UI holds the lock while mounted; the returned function lets go. */
  readonly hold: () => () => void;
  readonly setEnabled: (enabled: boolean) => void;
  readonly status: () => WakeLockStatus;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createWakeLockPolicy(options: {
  readonly api: WakeLockApi | null;
  readonly lifecycle: PageLifecycle;
  readonly log?: (state: WakeLockState, reason: string | null) => void;
}): WakeLockPolicy {
  const { api, lifecycle } = options;
  const listeners = new Set<() => void>();
  let holds = 0;
  let enabled = true;
  let sentinel: Sentinel | null = null;
  let pending = false;
  let unlisten: (() => void) | null = null;
  let status: WakeLockStatus = {
    supported: api !== null,
    enabled,
    state: api ? 'off' : 'unsupported',
    reason: null,
  };

  const set = (state: WakeLockState, reason: string | null = null) => {
    const next = { supported: api !== null, enabled, state: api ? state : 'unsupported', reason };
    if (
      next.state === status.state &&
      next.reason === status.reason &&
      next.enabled === status.enabled
    )
      return;
    status = next;
    if (state !== 'off') options.log?.(next.state, reason);
    for (const listener of listeners) listener();
  };

  const wanted = () => holds > 0 && enabled && lifecycle.visible();

  const reconcile = async () => {
    if (!api) {
      set('unsupported');
      return;
    }
    if (!wanted()) {
      const held = sentinel;
      sentinel = null;
      if (held) await held.release().catch(() => undefined);
      if (holds === 0 || !enabled) set('off');
      return;
    }
    if (sentinel || pending) return;
    pending = true;
    try {
      const acquired = await api.request('screen');
      pending = false;
      if (!wanted()) {
        await acquired.release().catch(() => undefined);
        return;
      }
      sentinel = acquired;
      acquired.addEventListener('release', () => {
        if (sentinel !== acquired) return;
        sentinel = null;
        set(holds > 0 && enabled ? 'released' : 'off');
      });
      set('held');
    } catch (error) {
      pending = false;
      set('denied', error instanceof Error ? error.name : 'Error');
    }
  };

  const onLifecycle = (state: 'visible' | 'hidden') => {
    // The browser releases the lock itself when the page hides; re-acquire on return (§8.8.3).
    if (state === 'visible') void reconcile();
  };

  return {
    hold() {
      holds++;
      if (holds === 1) unlisten = lifecycle.listen(onLifecycle);
      void reconcile();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds--;
        if (holds === 0) {
          unlisten?.();
          unlisten = null;
        }
        void reconcile();
      };
    },
    setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      set(status.state === 'denied' && next ? 'off' : status.state, status.reason);
      void reconcile();
    },
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
