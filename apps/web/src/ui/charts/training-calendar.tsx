import { Trans, useLingui } from '@lingui/react/macro';
import {
  ChevronLeft,
  ChevronRight,
  CircleArrowDown,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleX,
  Contrast,
  type LucideIcon,
} from 'lucide-react';
import { useId } from 'react';

import { Button } from '#ui/button';
import { cn } from '#ui/cn';

import { formatLocalDate, formatMonth, formatWeekday } from '../../i18n/format';
import { dayMs, isoDay } from './range';

/** ANL-06: what a day of the training calendar shows. */
export type CalendarStatus = 'completed' | 'partial' | 'missed' | 'planned' | 'deload' | 'break';

export interface CalendarDay {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly status: CalendarStatus;
  /** The session's name, e.g. "Upper A". */
  readonly label?: string;
}

export interface TrainingCalendarProps {
  readonly title: string;
  /** "14 workouts in November, 1 missed." */
  readonly summary: string;
  /** `YYYY-MM`. */
  readonly month: string;
  /** The first day of the week, ISO (1 = Monday … 7 = Sunday; SET-11). */
  readonly weekStart: number;
  readonly days: readonly CalendarDay[];
  /** Marked as the current date. */
  readonly today?: string;
  /** Previous and next month buttons appear when this is given. */
  readonly onMonthChange?: (month: string) => void;
  /** Opens a day's session (ANL-06). Days with a status are buttons when this is given. */
  readonly onDaySelect?: (date: string) => void;
  readonly headingLevel?: 2 | 3;
  readonly className?: string;
}

const STATUS_ICON: Record<CalendarStatus, { icon: LucideIcon; className: string }> = {
  completed: { icon: CircleCheck, className: 'text-success' },
  partial: { icon: Contrast, className: 'text-info' },
  missed: { icon: CircleX, className: 'text-danger' },
  planned: { icon: CircleDashed, className: 'text-fg-muted' },
  deload: { icon: CircleArrowDown, className: 'text-warning' },
  break: { icon: CirclePause, className: 'text-fg-muted' },
};
const STATUSES = Object.keys(STATUS_ICON) as CalendarStatus[];
const DAY_MS = 86_400_000;

/** ISO weekday (1 = Monday … 7 = Sunday) of an epoch at UTC midnight. */
const isoWeekday = (epoch: number) => ((new Date(epoch).getUTCDay() + 6) % 7) + 1;

/**
 * The training calendar (ANL-06) as a month grid: an HTML table (it is its own table view),
 * each day with its status as an icon of its own shape and colour plus the words in the day's
 * accessible name and the legend, so colour is never the only signal (NFR-A11Y-05/10). Days with
 * a session are buttons (≥ 44 px at 360 px) when `onDaySelect` is given. A small own component:
 * ECharts' calendar would add canvas, size and no keyboard access for this simple grid.
 */
export function TrainingCalendar({
  title,
  summary,
  month,
  weekStart,
  days,
  today,
  onMonthChange,
  onDaySelect,
  headingLevel = 2,
  className,
}: TrainingCalendarProps) {
  const { t } = useLingui();
  const ids = useId();
  const statusWords: Record<CalendarStatus, string> = {
    completed: t`Completed`,
    partial: t`Partly done`,
    missed: t`Missed`,
    planned: t`Planned`,
    deload: t`Lighter week`,
    break: t`Break`,
  };
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = dayMs(`${month}-01`);
  const firstDate = new Date(first);
  const daysInMonth = new Date(
    Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const leading = (isoWeekday(first) - weekStart + 7) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => isoDay(first + index * DAY_MS)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const weekdays = Array.from({ length: 7 }, (_, index) => ((weekStart - 1 + index) % 7) + 1);
  const monthName = formatMonth(month);
  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + delta, 1));
    return isoDay(next.getTime()).slice(0, 7);
  };
  const used = STATUSES.filter((status) => days.some((day) => day.status === status));
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className={cn('flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4', className)}
    >
      <div className="flex flex-col gap-1">
        <Heading id={`${ids}-title`} className="text-lg font-semibold">
          {title}
        </Heading>
        <p>{summary}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        {onMonthChange ? (
          <Button
            size="icon"
            aria-label={t`Previous month`}
            onClick={() => onMonthChange(shiftMonth(-1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
        ) : null}
        <p id={`${ids}-month`} aria-live="polite" className="flex-1 text-center font-semibold">
          {monthName}
        </p>
        {onMonthChange ? (
          <Button
            size="icon"
            aria-label={t`Next month`}
            onClick={() => onMonthChange(shiftMonth(1))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <table className="w-full table-fixed border-collapse text-center">
        <caption className="sr-only">{t`${title}, ${monthName}`}</caption>
        <thead>
          <tr>
            {weekdays.map((iso) => (
              <th key={iso} scope="col" className="pb-1 text-sm font-medium text-fg-muted">
                <abbr title={formatWeekday(iso, 'long')} className="no-underline">
                  {formatWeekday(iso, 'short')}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.find((date) => date !== null) ?? 'empty'}>
              {week.map((date, index) => {
                if (date === null) return <td key={`blank-${index}`} aria-hidden="true" />;
                const entry = byDate.get(date);
                const visual = entry ? STATUS_ICON[entry.status] : null;
                const Icon = visual?.icon;
                const isToday = date === today;
                const name = entry
                  ? entry.label
                    ? t`${formatLocalDate(date, 'long')}: ${statusWords[entry.status]}, ${entry.label}`
                    : t`${formatLocalDate(date, 'long')}: ${statusWords[entry.status]}`
                  : formatLocalDate(date, 'long');
                const content = (
                  <>
                    <span className="text-sm font-semibold tabular" aria-hidden="true">
                      {Number(date.slice(8))}
                    </span>
                    {Icon ? (
                      <Icon aria-hidden="true" className={cn('size-4', visual.className)} />
                    ) : (
                      <span aria-hidden="true" className="size-4" />
                    )}
                  </>
                );
                const cellClass = cn(
                  'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg',
                  isToday && 'outline-2 -outline-offset-2 outline-fg',
                );
                return (
                  <td key={date} className="p-0.5" aria-current={isToday ? 'date' : undefined}>
                    {entry && onDaySelect ? (
                      <button
                        type="button"
                        aria-label={name}
                        onClick={() => onDaySelect(date)}
                        className={cn(cellClass, 'border border-control bg-surface')}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className={cellClass}>
                        <span className="sr-only">{name}</span>
                        {content}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {used.length > 0 ? (
        <ul aria-label={t`Legend`} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {used.map((status) => {
            const { icon: Icon, className: iconClass } = STATUS_ICON[status];
            return (
              <li key={status} className="flex items-center gap-1">
                <Icon aria-hidden="true" className={cn('size-4', iconClass)} />
                {statusWords[status]}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-fg-muted">
          <Trans>No workouts this month.</Trans>
        </p>
      )}
    </section>
  );
}
