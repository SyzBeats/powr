import { useLingui } from '@lingui/react/macro';
import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { Settings } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';

import { LiveAnnouncer } from '#ui/announcer';

import { useInsightsWarmup } from '../../hooks/use-insights-warmup';
import { useActiveSession } from '../../hooks/use-session';
import { BottomNav } from './BottomNav';
import { UpdateBanner } from './UpdateBanner';

/**
 * The session runtime (M3b): alerts of the running timer, recovery after a reload (WKT-14) and the
 * global mini timer (TMR-12). A lazy chunk with the timer kit and the session entry, loaded only
 * while a session is active, so the startup path stays small (§8.19).
 */
const SessionRuntime = lazy(() => import('../session/SessionRuntime'));

/** Mobile-first shell: header, content, update notice and the bottom navigation (§8.9.4). */
export function AppShell() {
  const { t } = useLingui();
  // Onboarding is a focused flow: no tabs that the first-run guard would send back (ONB-01).
  const onboarding = useRouterState({
    select: (state) => state.location.pathname.startsWith('/onboarding'),
  });
  const session = useActiveSession();
  // M4b: the derived weeks and the streak catch up once, in idle time after the first screen,
  // never during a workout.
  useInsightsWarmup(session.loaded && !session.value);
  // M5d (PWA-12): Back closes sheets first; entries of sheets no longer open are skipped. The
  // watcher is a lazy chunk (shared with the sheets), so it stays off the startup path.
  const router = useRouter();
  useEffect(() => {
    void import('#ui/back-dismiss').then(({ watchSheetHistory }) => watchSheetHistory(router));
  }, [router]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg pt-safe">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-1">
          <Link
            to="/"
            className="flex min-h-target items-center text-lg font-black tracking-widest"
          >
            {t`POWR`}
          </Link>
          <Link
            to="/settings"
            aria-label={t`Settings`}
            className="flex size-target items-center justify-center rounded-xl"
          >
            <Settings aria-hidden="true" />
          </Link>
        </div>
      </header>
      <UpdateBanner />
      <main className={onboarding ? 'flex-1 pb-8' : 'flex-1 pb-shell'}>
        <Outlet />
      </main>
      {session.loaded && session.value ? (
        <Suspense fallback={null}>
          <SessionRuntime />
        </Suspense>
      ) : null}
      {onboarding ? null : <BottomNav />}
      {/* The one polite live region for timer and alert announcements (NFR-A11Y-06). */}
      <LiveAnnouncer />
    </div>
  );
}
