import { CircleAlert, CircleCheck, Info, OctagonAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '#ui/cn';

export type Tone = 'neutral' | 'info' | 'ok' | 'warning' | 'danger';

const TONES: Readonly<Record<Tone, { className: string; icon: LucideIcon | null }>> = {
  neutral: { className: 'border-control text-fg', icon: null },
  info: { className: 'border-info text-info', icon: Info },
  ok: { className: 'border-success text-success', icon: CircleCheck },
  warning: { className: 'border-warning text-warning', icon: CircleAlert },
  danger: { className: 'border-danger text-danger', icon: OctagonAlert },
};

/**
 * A status label: an icon plus words, never colour alone (WCAG 1.4.1, NFR-A11Y-05). Outlined, so
 * the status colour is text on the surface and passes the token gate in both themes.
 */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone;
  icon?: LucideIcon | null;
  children: ReactNode;
  className?: string;
}) {
  const Icon = icon === undefined ? TONES[tone].icon : icon;
  return (
    <span
      className={cn(
        'inline-flex min-h-target-min items-center gap-1 rounded-full border px-2 text-sm font-semibold',
        TONES[tone].className,
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
      <span>{children}</span>
    </span>
  );
}

/** A callout box for a warning or a note, with its icon. */
export function Callout({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = TONES[tone].icon ?? Info;
  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border-2 bg-surface p-3',
        TONES[tone].className.split(' ')[0],
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-5 shrink-0', TONES[tone].className.split(' ')[1])}
      />
      <div className="flex min-w-0 flex-col gap-1 text-fg">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
