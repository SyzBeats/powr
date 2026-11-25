import { Plural, Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CalendarSync } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { LocalDate } from '@powr/domain';

import { buttonClass } from '#ui/button';

import { useCalendarExport } from '../../hooks/use-calendar';
import { usePlannedSessions } from '../../hooks/use-planning';
import { addLocalDays, todayLocal } from '../../i18n/format';

/** How far ahead a changed planned session counts (an export covers at most 52 weeks). */
const AHEAD_DAYS = 364;

/**
 * CAL-04 "re-export is offered when the plan changes": on the Plan screen, after a calendar
 * export, when exported sessions moved, changed or went away. The live planned sessions make it
 * check again after a move, a swap or a skipped session.
 */
export function ReexportNotice() {
  const calendar = useCalendarExport();
  const today = todayLocal();
  const planned = usePlannedSessions(
    today as LocalDate,
    addLocalDays(today, AHEAD_DAYS) as LocalDate,
  );
  const [changed, setChanged] = useState(0);
  useEffect(() => {
    if (!planned.loaded) return undefined;
    let cancelled = false;
    void calendar.status().then((status) => {
      if (!cancelled) setChanged(status?.changed ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [calendar, planned]);
  if (changed === 0) return null;
  return (
    <div
      data-testid="calendar-reexport"
      className="flex flex-col gap-2 rounded-2xl border-2 border-info bg-surface p-3"
    >
      <p className="flex items-start gap-2">
        <CalendarSync aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
        <span>
          <Plural
            value={changed}
            one="# workout changed since you added the plan to your calendar."
            other="# workouts changed since you added the plan to your calendar."
          />
        </span>
      </p>
      <Link to="/plan/calendar" className={buttonClass({})}>
        <Trans>Update your calendar</Trans>
      </Link>
    </div>
  );
}
