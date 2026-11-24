import { useLingui } from '@lingui/react/macro';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Settings } from 'lucide-react';

import { LiveAnnouncer } from '#ui/announcer';

import { BottomNav } from './BottomNav';
import { UpdateBanner } from './UpdateBanner';

/** Mobile-first shell: header, content, update notice and the bottom navigation (§8.9.4). */
export function AppShell() {
  const { t } = useLingui();
  // Onboarding is a focused flow: no tabs that the first-run guard would send back (ONB-01).
  const onboarding = useRouterState({
    select: (state) => state.location.pathname.startsWith('/onboarding'),
  });
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
      <main className={onboarding ? 'flex-1 pb-8' : 'flex-1 pb-28'}>
        <Outlet />
      </main>
      {onboarding ? null : <BottomNav />}
      {/* The one polite live region for timer and alert announcements (NFR-A11Y-06). */}
      <LiveAnnouncer />
    </div>
  );
}
