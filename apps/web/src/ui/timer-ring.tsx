import type { ReactNode } from 'react';

import { cn } from '#ui/cn';

/**
 * The rest timer ring (§8.9.2 `TimerRing`, TMR-03/04/07): a progress ring around the time text.
 * Decorative (the time is text next to it or inside it); the done state changes the ring's colour
 * *and* fills it (never colour alone), with no animation (NFR-A11Y-08/09: nothing flashes).
 */
export function TimerRing({
  progress,
  done,
  size = 48,
  stroke = 5,
  className,
  children,
}: {
  /** 0 at the start, 1 at the end. */
  progress: number;
  done: boolean;
  size?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = done ? 1 : Math.min(1, Math.max(0, progress));
  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      data-done={done ? '' : undefined}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-control"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          className={done ? 'stroke-success' : 'stroke-primary'}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      ) : null}
    </span>
  );
}
