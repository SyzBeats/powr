import type { AnyRouter } from '@tanstack/react-router';

/**
 * PWA-12, §8.9.1 ("every screen has a parent"): when the app starts on a deep screen as the
 * first entry of its history (an app shortcut, PWA-05, or a deep link launched in the installed
 * app), Home is put beneath it, so the first Back goes to Home instead of closing the app.
 * Runs before the router renders, so nothing loads twice; a reload or an in-app navigation
 * (history longer than one entry) is left alone.
 */
export function seedLaunchHistory(
  router: AnyRouter,
  current: Pick<Location, 'pathname' | 'search' | 'hash'>,
  historyLength: number,
  standalone: boolean = matchMedia('(display-mode: standalone)').matches,
): boolean {
  if (historyLength > 1 || current.pathname === '/') return false;
  const fromShortcut = new URLSearchParams(current.search).get('source') === 'shortcut';
  if (!standalone && !fromShortcut) return false;
  const href = `${current.pathname}${current.search}${current.hash}`;
  router.history.replace('/');
  // TanStack batches history writes of one task into one; the replace must land on its own.
  router.history.flush();
  router.history.push(href);
  return true;
}
