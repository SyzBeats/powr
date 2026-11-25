import { useRouter, type AnyRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

/*
 * The Android back gesture closes an open sheet or dialog before it leaves the screen (PWA-12,
 * §8.9.1). An open sheet owns one history entry with the same URL, marked in its history state:
 * Back pops that entry, which closes the sheet; closing it any other way (its Close button,
 * Escape, an action) takes the entry off again. Everything goes through TanStack Router's
 * history, so the router, its scroll restoration and deep links stay consistent.
 */

const SHEET_KEY = 'powrSheet';
// oxlint-disable-next-line lingui/no-unlocalized-strings -- TanStack's history-state index key
const INDEX_KEY = '__TSR_index';

/** Sheets that own a history entry now. */
const openSheets = new Set<string>();
/** A just-closed sheet's entry, about to be popped; a sheet opening at once takes it over. */
let pendingBack: { readonly key: string; readonly timer: ReturnType<typeof setTimeout> } | null =
  null;
let sequence = 0;
const watched = new WeakSet<AnyRouter>();

function sheetKeyOf(state: unknown): string | undefined {
  const key = (state as Record<string, unknown> | null | undefined)?.[SHEET_KEY];
  return typeof key === 'string' ? key : undefined;
}

function indexOf(state: unknown): number {
  const index = (state as Record<string, unknown> | null | undefined)?.[INDEX_KEY];
  return typeof index === 'number' ? index : 0;
}

/**
 * An entry of a sheet that is no longer open (the page reloaded, or a link in the sheet moved on
 * and Back came back to it): skip it, so one Back press is one step.
 */
function skipStaleEntry(router: AnyRouter): void {
  const key = sheetKeyOf(router.history.location.state);
  if (key !== undefined && !openSheets.has(key) && pendingBack === null) router.history.back();
}

/**
 * Watches the router's history once, for stale sheet entries (also right after a reload). The
 * shell loads this module lazily (it is not on the startup path) and calls it after first render.
 */
export function watchSheetHistory(router: AnyRouter): void {
  if (watched.has(router)) return;
  watched.add(router);
  skipStaleEntry(router);
  router.history.subscribe(() => skipStaleEntry(router));
}

/**
 * While `open`, the sheet owns a history entry; Back calls `onClose`. Without a router (a
 * component rendered on its own) it does nothing.
 */
export function useBackDismiss(open: boolean, onClose: () => void): void {
  const router = useRouter({ warn: false });
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open || !router) return undefined;
    const { history } = router;
    const key = `sheet-${++sequence}`;
    openSheets.add(key);
    const takeover = pendingBack !== null && sheetKeyOf(history.location.state) === pendingBack.key;
    if (pendingBack) clearTimeout(pendingBack.timer);
    pendingBack = null;
    // The sheet's entry and what the page put in the URL while it is open. M6c: the entry may
    // arrive later than the navigate call (with a navigation blocker registered, such as the
    // unsaved-changes guard, TanStack applies a push after the blocker's answer), so it is taken
    // when the history reports it.
    let index: number | null = null;
    let openedAt = '';
    let latest = '';
    let gone = false;
    const arrived = () => {
      if (index !== null || sheetKeyOf(history.location.state) !== key) return;
      index = indexOf(history.location.state);
      openedAt = history.location.href;
      latest = openedAt;
    };

    const unsubscribe = history.subscribe(({ location }) => {
      if (gone) return;
      if (index === null) {
        arrived();
        return;
      }
      const current = indexOf(location.state);
      // The page itself may replace the sheet's entry (filters kept in the URL): still open.
      if (current >= index) {
        if (current === index) latest = location.href;
        return;
      }
      // Back left the sheet's entry: close the sheet.
      gone = true;
      openSheets.delete(key);
      close.current();
      // What the page put in the URL while the sheet was open stays (Back closes, not undoes).
      if (latest !== openedAt && location.href !== latest) {
        void router.navigate({ href: latest, replace: true, resetScroll: false });
      }
    });
    void router.navigate({
      href: history.location.href,
      state: (previous) => ({ ...previous, [SHEET_KEY]: key }) as typeof previous,
      replace: takeover,
      resetScroll: false,
    });
    // Without a blocker the entry is there at once.
    arrived();

    return () => {
      unsubscribe();
      openSheets.delete(key);
      if (gone || sheetKeyOf(history.location.state) !== key) return;
      // Closed in the UI: take the entry off, unless another sheet opens right now and takes it.
      const timer = setTimeout(() => {
        pendingBack = null;
        if (sheetKeyOf(history.location.state) === key) history.back();
      }, 0);
      pendingBack = { key, timer };
    };
  }, [open, router]);
}
