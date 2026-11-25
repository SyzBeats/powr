/**
 * Install promotion state (PWA-02, §6.7 step 4). Kept in `localStorage`, not in the `powr`
 * database: whether this browser was visited before and when the offer was dismissed belong to
 * the device, so they must not travel to another phone with a backup. "Delete all data" clears
 * them with the rest of the local storage.
 */
const KEY = 'powr.install';

interface InstallRecord {
  readonly firstSeenAt: number;
  readonly dismissedAt?: number;
}

function read(): InstallRecord | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (parsed === null || typeof parsed !== 'object') return null;
    const { firstSeenAt, dismissedAt } = parsed as Record<string, unknown>;
    if (typeof firstSeenAt !== 'number') return null;
    return typeof dismissedAt === 'number' ? { firstSeenAt, dismissedAt } : { firstSeenAt };
  } catch {
    return null;
  }
}

function write(record: InstallRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Private mode or quota: the offer just shows again later.
  }
}

export interface InstallState {
  /** True during the first page load on this browser: never promote then. */
  readonly firstVisit: boolean;
  /** When the offer was last dismissed (epoch ms), null if never. */
  dismissedAt(): number | null;
  dismiss(): void;
}

/** Records this visit; call once per page load (boot). */
export function installState(now: number = Date.now()): InstallState {
  const existing = read();
  if (!existing) write({ firstSeenAt: now });
  return {
    firstVisit: existing === null,
    dismissedAt: () => read()?.dismissedAt ?? null,
    dismiss: () => write({ firstSeenAt: read()?.firstSeenAt ?? now, dismissedAt: Date.now() }),
  };
}

/** The browser's own install prompt, deferred until a meaningful moment (never on load). */
export function captureInstallPrompt(handlers: {
  readonly onPrompt: (event: Event) => void;
  readonly onInstalled: () => void;
}): void {
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    handlers.onPrompt(event);
  });
  addEventListener('appinstalled', () => handlers.onInstalled());
}
