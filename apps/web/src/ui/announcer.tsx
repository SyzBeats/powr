import { useSyncExternalStore } from 'react';

/**
 * A polite screen-reader announcer (NFR-A11Y-06, WCAG 4.1.3): "Rest started, 2 minutes,
 * 30 seconds", "10 seconds left", "Rest over". One live region for the whole app, mounted once in
 * the shell, so it exists before anything is announced.
 *
 * No flooding: at most one announcement per `minGapMs` (newer messages replace a waiting one, so
 * a burst ends with the latest), a message identical to the one still shown is dropped, and the
 * region empties after `clearMs` so the same message can be announced again later. Callers never
 * announce per-second ticks.
 */
export interface Announcer {
  readonly announce: (message: string) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly text: () => string;
}

export interface AnnouncerOptions {
  readonly now?: () => number;
  readonly setTimeout?: (callback: () => void, ms: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
  readonly minGapMs?: number;
  readonly clearMs?: number;
}

export function createAnnouncer(options: AnnouncerOptions = {}): Announcer {
  const now = options.now ?? (() => Date.now());
  const schedule = options.setTimeout ?? ((callback, ms) => globalThis.setTimeout(callback, ms));
  const cancel =
    options.clearTimeout ??
    ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  const minGapMs = options.minGapMs ?? 1000;
  const clearMs = options.clearMs ?? 5000;
  const listeners = new Set<() => void>();
  let current = '';
  let shownAt = Number.NEGATIVE_INFINITY;
  let pending: string | null = null;
  let pendingTimer: unknown = null;
  let clearTimer: unknown = null;

  const set = (text: string) => {
    current = text;
    for (const listener of listeners) listener();
  };
  const show = (message: string) => {
    shownAt = now();
    if (clearTimer !== null) cancel(clearTimer);
    set(message);
    clearTimer = schedule(() => {
      clearTimer = null;
      set('');
    }, clearMs);
  };
  const flush = () => {
    pendingTimer = null;
    const message = pending;
    pending = null;
    if (message !== null && message !== current) show(message);
  };

  return {
    announce(message) {
      const text = message.trim();
      if (text === '' || text === current || text === pending) return;
      const wait = shownAt + minGapMs - now();
      if (wait <= 0 && pendingTimer === null) {
        show(text);
        return;
      }
      pending = text;
      pendingTimer ??= schedule(flush, Math.max(0, wait));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    text: () => current,
  };
}

const appAnnouncer = createAnnouncer();

/** Announces `message` politely through the app's live region. */
export function announce(message: string): void {
  appAnnouncer.announce(message);
}

/**
 * The app's polite live region (visually hidden). Mount once, in the shell. A plain element with
 * `aria-live`, not `role="status"`: screens keep their own status outputs, and queries for those
 * must not find the announcer.
 */
export function LiveAnnouncer({ announcer = appAnnouncer }: { announcer?: Announcer }) {
  const text = useSyncExternalStore(announcer.subscribe, announcer.text);
  return (
    <div aria-live="polite" aria-atomic="true" data-testid="live-announcer" className="sr-only">
      {text}
    </div>
  );
}
