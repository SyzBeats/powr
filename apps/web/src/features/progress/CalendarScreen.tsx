import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { Trophy } from 'lucide-react';
import { useState } from 'react';

import type { LocalDate, SessionOrigin, SessionStatus } from '@powr/domain';
import {
  filterSessions,
  type CalendarDay as DomainCalendarDay,
  type SessionListItem,
} from '@powr/domain/analytics';

import { Badge } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { TrainingCalendar } from '#ui/charts/training-calendar';
import { ChipGroup, CheckRow } from '#ui/choice';
import { Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useInsight } from '../../hooks/use-insights';
import { useWeekStart } from '../../hooks/use-planning';
import {
  addLocalDays,
  formatLocalDate,
  formatLocalDateWithYear,
  formatMinutes,
  formatMonth,
  todayLocal,
} from '../../i18n/format';
import { useLabels } from '../labels';
import { Loading } from './parts';
import { useCalendarDays, useSessionListWords } from './words';

/** Workouts listed before "Show more". */
const PAGE = 20;
/** How many exercise names a row shows before "and N more". */
const NAMES_SHOWN = 3;

/**
 * ANL-06: the month view (completed, partly done, missed, planned, lighter-week and break days;
 * a day opens its workout) and the list of workouts with search (exercise names and notes,
 * accents ignored) and filters.
 */
export function CalendarScreen({ month }: { month?: string | undefined }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { weekStart } = useWeekStart();
  const toCalendar = useCalendarDays();
  const today = todayLocal();
  const shown = month ?? today.slice(0, 7);
  const days = useInsight(`calendar:${shown}`, (insights, deps) =>
    insights.trainingCalendar(deps, { month: shown }),
  );
  const [openDate, setOpenDate] = useState<string | null>(null);
  const list = days.loaded ? days.value : [];
  const open = openDate ? (list.find((day) => day.date === openDate) ?? null) : null;

  const count = (state: DomainCalendarDay['states'][number]) =>
    list.filter((day) => day.states.includes(state)).length;
  const workouts = list.reduce((sum, day) => sum + day.sessions.length, 0);
  const monthName = formatMonth(shown);
  const parts = [
    plural(workouts, { one: '# workout', other: '# workouts' }),
    ...(count('partial') > 0
      ? [plural(count('partial'), { one: '# partly done', other: '# partly done' })]
      : []),
    ...(count('missed') > 0
      ? [plural(count('missed'), { one: '# planned day missed', other: '# planned days missed' })]
      : []),
    ...(count('break') > 0
      ? [plural(count('break'), { one: '# break day', other: '# break days' })]
      : []),
  ];
  const summary = t`${monthName}: ${new Intl.ListFormat(undefined, { type: 'conjunction' }).format(parts)}.`;

  const selectDay = (date: string) => {
    const day = list.find((entry) => entry.date === date);
    const only = day?.sessions.length === 1 && day.planned.length === 0 ? day.sessions[0] : null;
    if (only) {
      void navigate({ to: '/session/summary/$sessionId', params: { sessionId: only.id } });
    } else {
      setOpenDate(date);
    }
  };

  return (
    <Screen title={t`Calendar and history`}>
      {!days.loaded ? (
        <Loading />
      ) : (
        <TrainingCalendar
          title={t`Training calendar`}
          summary={summary}
          month={shown}
          weekStart={weekStart}
          days={toCalendar(list)}
          today={today}
          onMonthChange={(next) =>
            void navigate({
              to: '/progress/calendar',
              search: next === today.slice(0, 7) ? {} : { month: next },
              replace: true,
              resetScroll: false,
            })
          }
          onDaySelect={selectDay}
        />
      )}
      <DaySheet day={open} onClose={() => setOpenDate(null)} />
      <SessionList />
    </Screen>
  );
}

function DaySheet({ day, onClose }: { day: DomainCalendarDay | null; onClose: () => void }) {
  const { t } = useLingui();
  const words = useSessionListWords();
  const date = day ? formatLocalDate(day.date, 'long') : '';
  const planned = day?.planned.filter((entry) => entry.status === 'planned').length ?? 0;
  return (
    <Sheet
      open={day !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={date}
      closeLabel={t`Close`}
    >
      {day ? (
        <>
          {day.sessions.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {day.sessions.map((session, index) => (
                <li key={session.id}>
                  <Link
                    to="/session/summary/$sessionId"
                    params={{ sessionId: session.id }}
                    className={buttonClass({ size: 'lg' })}
                  >
                    <Trans>
                      Workout {index + 1}: {words.status(session.status)}
                    </Trans>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <Trans>No workout logged on this day.</Trans>
            </p>
          )}
          {planned > 0 ? (
            <Link
              to="/plan"
              search={{ week: day.date }}
              className={buttonClass({ variant: 'secondary', size: 'lg' })}
            >
              <Plural
                value={planned}
                one="# planned workout: open the plan"
                other="# planned workouts: open the plan"
              />
            </Link>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const STATUSES: readonly SessionStatus[] = ['finished', 'partial'];
const ORIGINS: readonly SessionOrigin[] = ['planned', 'freestyle', 'repeat'];

function SessionList() {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useSessionListWords();
  const [everything, setEverything] = useState(false);
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<SessionStatus[]>([]);
  const [origins, setOrigins] = useState<SessionOrigin[]>([]);
  const [withPrs, setWithPrs] = useState(false);
  const [count, setCount] = useState(PAGE);
  const from = everything ? null : (addLocalDays(todayLocal(), -365) as LocalDate);
  // One read of the period, then the search runs on it as the user types (EXL-02-like speed).
  const history = useInsight(`session-list:${from ?? 'all'}`, (insights, deps) =>
    insights.sessionHistory(deps, from ? { from } : {}),
  );
  const items = history.loaded
    ? filterSessions(
        history.value,
        {
          ...(query.trim() ? { query } : {}),
          ...(statuses.length > 0 ? { statuses } : {}),
          ...(origins.length > 0 ? { origins } : {}),
          ...(withPrs ? { withPrs } : {}),
        },
        (id) => labels.exercise(id),
      )
    : [];
  const filtered = query.trim() !== '' || statuses.length + origins.length > 0 || withPrs;
  const clear = () => {
    setQuery('');
    setStatuses([]);
    setOrigins([]);
    setWithPrs(false);
  };

  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Workouts</Trans>
      </h2>
      <Field
        label={t`Search workouts`}
        hint={t`Exercise names or notes`}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setCount(PAGE);
        }}
      />
      <ChipGroup
        label={t`Status`}
        options={STATUSES.map((value) => ({ value, label: words.status(value) }))}
        value={statuses}
        onChange={setStatuses}
      />
      <ChipGroup
        label={t`How it started`}
        options={ORIGINS.map((value) => ({ value, label: words.origin(value) }))}
        value={origins}
        onChange={setOrigins}
      />
      <CheckRow label={t`Only workouts with a PR`} checked={withPrs} onChange={setWithPrs} />
      {filtered ? (
        <Button className="self-start" onClick={clear}>
          <Trans>Clear search and filters</Trans>
        </Button>
      ) : null}
      {!history.loaded ? (
        <Loading />
      ) : (
        <>
          <output className="block font-semibold" data-testid="session-count">
            {everything ? (
              <Plural value={items.length} one="# workout" other="# workouts" />
            ) : (
              <Plural
                value={items.length}
                one="# workout in the last 12 months"
                other="# workouts in the last 12 months"
              />
            )}
          </output>
          {items.length === 0 ? (
            <p className="text-fg-muted">
              {filtered ? (
                <Trans>No workouts match. Try fewer words or filters.</Trans>
              ) : (
                <Trans>No finished workouts yet.</Trans>
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="session-list">
              {items.slice(0, count).map((item) => (
                <SessionRow key={item.session.id} item={item} />
              ))}
            </ul>
          )}
          {items.length > count ? (
            <Button onClick={() => setCount((value) => value + PAGE)}>
              <Trans>Show more workouts</Trans>
            </Button>
          ) : null}
          {everything ? null : (
            <Button onClick={() => setEverything(true)}>
              <Trans>Include older workouts</Trans>
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function SessionRow({ item }: { item: SessionListItem }) {
  const { t } = useLingui();
  const labels = useLabels();
  const words = useSessionListWords();
  const { session } = item;
  const date = formatLocalDateWithYear(session.localDate);
  const names = item.exerciseIds.slice(0, NAMES_SHOWN).map((id) => labels.exercise(id));
  const more = item.exerciseIds.length - names.length;
  const shownNames = names.join(', ');
  const minutes = session.endedAt
    ? Math.round((session.endedAt.epochMs - session.startedAt.epochMs) / 60_000)
    : null;
  return (
    <li>
      <Link
        to="/session/summary/$sessionId"
        params={{ sessionId: session.id }}
        className="flex min-h-target-lg flex-col gap-1 rounded-2xl border border-control px-4 py-3"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{date}</span>
          {session.status === 'partial' ? <Badge>{words.status('partial')}</Badge> : null}
          {item.prs > 0 ? (
            <Badge icon={Trophy}>
              <Plural value={item.prs} one="# PR" other="# PRs" />
            </Badge>
          ) : null}
        </span>
        <span className="text-sm">{more > 0 ? t`${shownNames} and ${more} more` : shownNames}</span>
        <span className="text-sm text-fg-muted">
          {minutes === null ? (
            <Trans>
              {words.origin(session.origin)} ·{' '}
              <Plural value={item.doneSets} one="# set" other="# sets" />
            </Trans>
          ) : (
            <Trans>
              {words.origin(session.origin)} ·{' '}
              <Plural value={item.doneSets} one="# set" other="# sets" /> · {formatMinutes(minutes)}
            </Trans>
          )}
        </span>
        {session.note ? <span className="text-sm text-fg-muted">{session.note}</span> : null}
      </Link>
    </li>
  );
}
