import { create } from 'zustand';

/** Chrome's `beforeinstallprompt` event (not in the DOM typings): deferred for PWA-02. */
export interface DeferredInstallPrompt extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** "Delete all data" (DAT-13): the app shows only the deletion screen from `deleting` on. */
export type WipeState =
  | { readonly kind: 'deleting' }
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly remaining: readonly string[] };

/** Ephemeral cross-screen UI state (§8.5). Persisted data never lives here. */
interface AppUiState {
  offlineReady: boolean;
  updateAvailable: boolean;
  /** "Start without updating" was chosen in this page: no further offer before a workout (TD-64). */
  updateDeferred: boolean;
  debug: boolean;
  /** The deferred install prompt, null until the browser offers one (PWA-02, §6.7 step 4). */
  installPrompt: DeferredInstallPrompt | null;
  /** True once `appinstalled` fired in this page. */
  installed: boolean;
  wipe: WipeState | null;
  /** Another window updated (or deleted) the database: this one must reload (§6.8, TD-14). */
  staleWindow: boolean;
}

export const useAppUi = create<AppUiState>(() => ({
  offlineReady: false,
  updateAvailable: false,
  updateDeferred: false,
  debug: false,
  installPrompt: null,
  installed: false,
  wipe: null,
  staleWindow: false,
}));
