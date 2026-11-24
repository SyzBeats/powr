import { useLingui } from '@lingui/react/macro';
import { Link, Outlet } from '@tanstack/react-router';
import { Settings } from 'lucide-react';

import { BottomNav } from './BottomNav';
import { UpdateBanner } from './UpdateBanner';

/** Mobile-first shell: header, content, update notice and the bottom navigation (§8.9.4). */
export function AppShell() {
  const { t } = useLingui();
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
      <main className="flex-1 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
