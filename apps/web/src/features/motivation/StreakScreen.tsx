import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import {
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleX,
  Flame,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import type { MarkBreakError, StreakView } from '@powr/application/insights';
import { BREAK_REASONS, type BreakReason, type LocalDate } from '@powr/domain';
import { explain } from '@powr/domain/explain';
import type { WeekState } from '@powr/domain/streaks';

import { announce } from '#ui/announcer';
import { Button, buttonClass } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { cn } from '#ui/cn';
import { Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';

import { useInsight, useInsights } from '../../hooks/use-insights';
import { addLocalDays, formatLocalDate } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useStreakWords } from '../insights/words';
import { useLabels } from '../labels';
import { WhyButton } from '../why/WhySheet';

const STATE_ICONS: Readonly<Record<WeekState, { icon: LucideIcon; className: string }>> = {
  kept: { icon: CircleCheck, className: 'text-success' },
  graced: { icon: CircleCheck, className: 'text-success' },
  missed: { icon: CircleX, className: 'text-fg-muted' },
  paused: { icon: CirclePause, className: 'text-info' },
  pending: { icon: CircleDashed, className: 'text-fg-muted' },
};

/**
 * MOT-03/04: the weekly streak with its fairness rules in plain words, every recent week with its
 * state and "Why?", and marking a week as a break (the current week or up to four weeks back).
 * Tone (MOT-10): a week that was not kept is a fact with a way forward, never blame.
 */
export function StreakScreen() {
  const { t } = useLingui();
  const streak = useInsight('streak', (insights, deps) => insights.streakView(deps, { weeks: 12 }));
  return (
    <Screen title={t`Weekly streak`}>
      {streak.loaded ? (
        <StreakContent view={streak.value} reload={streak.reload} />
      ) : (
        <output className="block text-fg-muted">
          <Trans>Loading your weeks…</Trans>
        </output>
      )}
    </Screen>
  );
}

function StreakContent({ view, reload }: { view: StreakView; reload: () => void }) {
  const { t } = useLingui();
  const words = useStreakWords();
  const paused = view.weeks.filter((week) => week.state === 'paused').length;
  const why = explain('streak.current', {
    args: {
      current: view.current,
      best: view.best,
      weeks: view.weeks.length,
      paused,
      grace: view.grace,
    },
  });
  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>Your streak</Trans>
        </h2>
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
            <dt className="flex items-center gap-1 text-sm text-fg-muted">
              <Flame aria-hidden="true" className="size-4 text-pr-accent" />
              <Trans>Current streak</Trans>
            </dt>
            <dd className="text-2xl font-bold tabular" data-testid="streak-current">
              {words.weeks(view.current)}
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
            <dt className="flex items-center gap-1 text-sm text-fg-muted">
              <Trophy aria-hidden="true" className="size-4 text-pr-accent" />
              <Trans>Best streak</Trans>
            </dt>
            <dd className="text-2xl font-bold tabular" data-testid="streak-best">
              {words.weeks(view.best)}
            </dd>
          </div>
        </dl>
        {view.thisWeek ? (
          <p>
            <Trans>
              This week:{' '}
              <span className="font-semibold">
                {words.progress(view.thisWeek.done, view.thisWeek.target)}
              </span>
            </Trans>
            {' · '}
            {words.weekState(view.thisWeek.state)}
          </p>
        ) : (
          <p className="text-fg-muted">
            <Trans>Your streak starts with your first week of training.</Trans>
          </p>
        )}
        <WhyButton why={why} subject={t`your streak`} className="self-start" />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>How your streak works</Trans>
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <Trans>
              A week is kept when you do the sessions it asks for: your planned sessions, or your
              weekly goal without a plan. Without either, one session keeps the week.
            </Trans>
          </li>
          <li>
            <Trans>
              Sessions on unplanned days count. A partial workout counts once you did at least half
              of its planned sets.
            </Trans>
          </li>
          <li>
            <Trans>
              Lighter (deload) weeks count with their planned sessions: rest is training.
            </Trans>
          </li>
          <li>
            <Trans>
              Breaks for illness, injury, travel or life pause the streak: they neither keep nor
              break it.
            </Trans>
          </li>
          <li>
            <Trans>
              A week that is not kept starts the current streak again. Your best streak always
              stays.
            </Trans>
          </li>
          <li>
            {view.grace ? (
              <Trans>Your grace is on: a week with one session short still counts.</Trans>
            ) : (
              <Trans>
                You can turn on a grace of one session a week in Settings, under Insights.
              </Trans>
            )}
          </li>
        </ul>
        <Link to="/settings" hash="insights" className={buttonClass({ size: 'lg' })}>
          <Trans>Streak settings</Trans>
        </Link>
      </Card>

      <MarkBreak view={view} onMarked={reload} />

      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>Recent weeks</Trans>
        </h2>
        {view.weeks.length === 0 ? (
          <p className="text-fg-muted">
            <Trans>Your weeks show here once you start training.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col" data-testid="streak-weeks">
            {view.weeks.map((week) => {
              const { icon: Icon, className } = STATE_ICONS[week.state];
              const from = formatLocalDate(week.weekStart, 'short');
              const to = formatLocalDate(addLocalDays(week.weekStart, 6), 'short');
              const range = t`${from} to ${to}`;
              return (
                <li
                  key={week.weekStart}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border py-2 last:border-0"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{range}</span>
                    <span className="flex items-center gap-1 text-sm">
                      <Icon aria-hidden="true" className={cn('size-4 shrink-0', className)} />
                      {words.weekState(week.state)}
                      {week.state === 'paused' ? null : (
                        <>
                          {' · '}
                          {words.progress(week.done, week.target)}
                        </>
                      )}
                    </span>
                  </span>
                  <WhyButton why={week.why} subject={t`the week of ${from}`} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/** MOT-04: mark the current week or one up to four weeks back as a break. */
function MarkBreak({ view, onMarked }: { view: StreakView; onMarked: () => void }) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = useInsights();
  const [week, setWeek] = useState<LocalDate | null>(null);
  const [reason, setReason] = useState<BreakReason | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'busy' }
    | { readonly kind: 'error'; readonly error: MarkBreakError | 'choose' }
    | { readonly kind: 'done'; readonly week: LocalDate }
  >({ kind: 'idle' });

  const errorText = (error: MarkBreakError | 'choose'): string => {
    if (error === 'choose') return t`Choose a week and a reason first.`;
    switch (error.kind) {
      case 'tooFarBack':
        return t`Only the last four weeks can be marked as a break.`;
      case 'future':
        return t`A week that has not started cannot be marked yet. Plan a break on the Plan tab.`;
      case 'alreadyBreak':
        return t`That week is already a break.`;
      default:
        return assertNever(error);
    }
  };

  const submit = async () => {
    if (week === null || reason === null) {
      setState({ kind: 'error', error: 'choose' });
      return;
    }
    setState({ kind: 'busy' });
    const result = await run((insights, deps) =>
      insights.markWeekAsBreak(deps, {
        weekStart: week,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    );
    if (!result.ok) {
      setState({ kind: 'error', error: result.error });
      return;
    }
    setState({ kind: 'done', week });
    setWeek(null);
    setReason(null);
    setNote('');
    announce(t`The week is marked as a break. Your streak is updated.`);
    onMarked();
  };

  if (view.markableWeeks.length === 0) return null;
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Mark a week as a break</Trans>
      </h2>
      <p className="text-fg-muted">
        <Trans>
          Were you ill, travelling or busy with life? Mark that week as a break and it pauses your
          streak instead of ending it. This works for the last four weeks.
        </Trans>
      </p>
      <ChoiceCards<LocalDate>
        legend={t`Which week?`}
        value={week}
        onChange={setWeek}
        options={view.markableWeeks.map((start) => {
          const from = formatLocalDate(start, 'long');
          return { value: start, label: t`Week of ${from}` };
        })}
      />
      <ChoiceCards<BreakReason>
        legend={t`Reason`}
        value={reason}
        onChange={setReason}
        options={BREAK_REASONS.map((value) => ({ value, label: labels.breakReason(value) }))}
      />
      <Field
        label={t`Note (optional)`}
        value={note}
        maxLength={2000}
        onChange={(event) => setNote(event.target.value)}
      />
      {state.kind === 'error' ? (
        <p role="alert" className="font-medium text-danger">
          {errorText(state.error)}
        </p>
      ) : null}
      {state.kind === 'done' ? (
        <p className="flex items-center gap-2 font-semibold" data-testid="break-marked">
          <CircleCheck aria-hidden="true" className="size-5 text-success" />
          <Trans>Marked the week of {formatLocalDate(state.week, 'long')} as a break.</Trans>
        </p>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        disabled={state.kind === 'busy'}
        onClick={() => void submit()}
      >
        <Trans>Mark as a break</Trans>
      </Button>
    </Card>
  );
}
