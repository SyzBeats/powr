import { useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CalendarDays, ChartLine, Compass, Dumbbell, House, type LucideIcon } from 'lucide-react';

interface NavItem {
  readonly to: '/' | '/plan' | '/session' | '/explore' | '/progress';
  readonly label: string;
  readonly icon: LucideIcon;
  readonly primary?: boolean;
}

/** Five tabs with the Train action in the thumb-friendly centre (§8.9.4). */
export function BottomNav() {
  const { t } = useLingui();
  const items: NavItem[] = [
    { to: '/', label: t`Home`, icon: House },
    { to: '/plan', label: t`Plan`, icon: CalendarDays },
    { to: '/session', label: t`Train`, icon: Dumbbell, primary: true },
    { to: '/explore', label: t`Explore`, icon: Compass },
    { to: '/progress', label: t`Progress`, icon: ChartLine },
  ];
  return (
    <nav
      aria-label={t`Main`}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-safe"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map(({ to, label, icon: Icon, primary }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="flex min-h-target-lg flex-col items-center justify-center gap-0.5 text-xs font-medium text-fg-muted data-[status=active]:text-primary"
            >
              <span
                className={
                  primary
                    ? 'flex size-10 items-center justify-center rounded-full bg-primary text-on-primary'
                    : 'flex size-6 items-center justify-center'
                }
              >
                <Icon aria-hidden="true" className="size-6" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
