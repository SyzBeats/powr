import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { CalendarClock, ChevronLeft, ChevronRight, Pause } from 'lucide-react';
import { useState } from 'react';

import type {
  MesocycleError,
  MissedChoice,
  ReactiveDeloadCheck,
  ScheduleChange,
} from '@powr/application/planning';
import {
  BREAK_REASONS,
  type BreakReason,
  type LocalDate,
  type Mesocycle,
  type Plan,
  type PlannedSession,
  type TrainingBreak,
} from '@powr/domain';
import type { Explanation } from '@powr/domain/explain';
import { missedSessions } from '@powr/domain/planning';

import { Badge, Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Field } from '#ui/field';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import {
  useActivePlan,
  useBreaks,
  usePlannedSessions,
  usePlanning,
  useProfile,
  useWeekStart,
} from '../../hooks/use-planning';
import {
  addLocalDays,
  daysBetweenLocal,
  formatLocalDate,
  todayLocal,
  weekStartOfLocal,
} from '../../i18n/format';
import { useLabels } from '../labels';
import { WhyButton, WhyNamesContext, WhySimpleContext, WhyText } from '../why/WhySheet';
import { usePrescriptionText } from './format';

/** The mesocycle that is active, else the latest one (as the use cases decide). */
function currentMesocycle(plan: Plan): Mesocycle | undefined {
  return plan.mesocycles.find((entry) => entry.status === 'active') ?? plan.mesocycles.at(-1);
}

/** A change and its explanation, shown until the next one (PLN-11: every change says why). */
interface Outcome {
  readonly why: Explanation;
  readonly spacing?: ScheduleChange['spacing'];
}

/**
 * The Plan tab (PLN-08, PLN-11…13, PRG-11…13): the block, missed sessions, the week (locale week
 * start, SET-11) with move, swap and "train early", breaks with the return ramp, the deload
 * controls and the reactive check, and the next block.
 */
export function PlanScreen({ week }: { week?: string | undefined }) {
  const { t } = useLingui();
  const plan = useActivePlan();
  const profile = useProfile();
  if (!plan.loaded || !profile.loaded) {
    return (
      <Screen title={t`Plan`}>
        <p className="text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      </Screen>
    );
  }
  if (!plan.value) {
    return (
      <Screen title={t`Plan`}>
        <Card>
          <h2 className="text-xl font-bold">
            <Trans>Plan not set up</Trans>
          </h2>
          <p>
            <Trans>
              You are logging freely. Answer a few questions and POWR builds a plan for your days,
              time and equipment, and explains every choice.
            </Trans>
          </p>
          <Link
            to="/plan/setup/$step"
            params={{ step: 'goal' }}
            className={buttonClass({ variant: 'primary', size: 'lg' })}
          >
            <Trans>Set up a plan</Trans>
          </Link>
        </Card>
      </Screen>
    );
  }
  const novice =
    profile.value?.experience.trainingAge === 'under6Months' ||
    profile.value?.experience.rpeFamiliarity === 'none';
  return (
    <WhySimpleContext value={novice}>
      <ActivePlan plan={plan.value} week={week} novice={novice} />
    </WhySimpleContext>
  );
}

function ActivePlan({
  plan,
  week,
  novice,
}: {
  plan: Plan;
  week: string | undefined;
  novice: boolean;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const navigate = useNavigate();
  const { weekStart } = useWeekStart();
  const today = todayLocal();
  const mesocycle = currentMesocycle(plan);
  // Before the plan starts, its first week is the interesting one.
  const anchor = week ?? (mesocycle && today < mesocycle.startDate ? mesocycle.startDate : today);
  const shown = weekStartOfLocal(anchor, weekStart);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const blockWeek = mesocycle
    ? Math.floor(daysBetweenLocal(mesocycle.startDate, today) / 7) + 1
    : 0;
  const weeks = mesocycle ? mesocycle.accumulationWeeks + mesocycle.deloadWeeks : 0;
  const deloadStart = mesocycle
    ? addLocalDays(mesocycle.startDate, 7 * mesocycle.accumulationWeeks)
    : null;
  const style = labels.style(plan.style);

  return (
    <WhyNamesContext value={{ days: mesocycle?.days ?? [] }}>
      <Screen title={t`Plan`}>
        <Card>
          <h2 className="text-2xl font-bold">{plan.name.en}</h2>
          <p className="text-fg-muted">
            {style}
            {mesocycle ? (
              <>
                {' · '}
                {blockWeek < 1 ? (
                  <Trans>starts {formatLocalDate(mesocycle.startDate, 'long')}</Trans>
                ) : blockWeek > mesocycle.accumulationWeeks ? (
                  <Trans>
                    lighter week (deload), week {blockWeek} of {weeks}
                  </Trans>
                ) : (
                  <Trans>
                    week {blockWeek} of {weeks}
                  </Trans>
                )}
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/plan/edit" className={buttonClass({ variant: 'primary' })}>
              <Trans>Edit plan</Trans>
            </Link>
            <Link to="/plan/next" className={buttonClass({})}>
              <Trans>Next block</Trans>
            </Link>
            <Link
              to="/plan/setup/$step"
              params={{ step: 'goal' }}
              className={buttonClass({ variant: 'ghost' })}
            >
              <Trans>New plan</Trans>
            </Link>
          </div>
        </Card>

        {/* Always present, so the first change is announced too (WCAG 4.1.3). */}
        <output
          aria-live="polite"
          className="flex flex-col gap-1 rounded-2xl border-2 border-info bg-surface p-3 empty:hidden"
        >
          {outcome ? (
            <>
              <span>
                <WhyText why={outcome.why} />
              </span>
              {outcome.spacing && outcome.spacing.length > 0 ? (
                <span>
                  <Plural
                    value={outcome.spacing.length}
                    one="Heads-up: # muscle or lift now has less than the usual recovery time. Consider another day."
                    other="Heads-up: # muscles or lifts now have less than the usual recovery time. Consider another day."
                  />
                </span>
              ) : null}
            </>
          ) : null}
        </output>
        {outcome ? (
          <div className="-mt-2">
            <WhyButton why={outcome.why} subject={t`this change`} />
          </div>
        ) : null}

        <MissedCard plan={plan} onChanged={setOutcome} />

        <section aria-labelledby="week-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="week-heading" className="text-xl font-bold">
              <Trans>Week of {formatLocalDate(shown, 'long')}</Trans>
            </h2>
            <div className="flex gap-2">
              <Button
                size="icon"
                aria-label={t`Previous week`}
                onClick={() =>
                  void navigate({ to: '/plan', search: { week: addLocalDays(shown, -7) } })
                }
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button onClick={() => void navigate({ to: '/plan', search: { week: today } })}>
                <Trans>This week</Trans>
              </Button>
              <Button
                size="icon"
                aria-label={t`Next week`}
                onClick={() =>
                  void navigate({ to: '/plan', search: { week: addLocalDays(shown, 7) } })
                }
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <WeekView
            from={shown as LocalDate}
            today={today as LocalDate}
            novice={novice}
            onChanged={setOutcome}
          />
        </section>

        <BreakCard onChanged={setOutcome} />
        {mesocycle && deloadStart ? (
          <DeloadCard
            plan={plan}
            mesocycle={mesocycle}
            deloadStart={deloadStart}
            onChanged={setOutcome}
          />
        ) : null}
      </Screen>
    </WhyNamesContext>
  );
}

/** PLN-11: planned sessions whose day passed: do today, skip, or merge into the next. */
function MissedCard({ plan, onChanged }: { plan: Plan; onChanged: (outcome: Outcome) => void }) {
  const { t } = useLingui();
  const run = usePlanning();
  const today = todayLocal();
  // The same rule as `listMissedSessions` (domain `missedSessions`), over the live data, so the
  // list updates as soon as a session is resolved.
  const sessions = usePlannedSessions(addLocalDays(today, -28) as LocalDate, today as LocalDate);
  const breaks = useBreaks();
  const [error, setError] = useState<string | null>(null);
  const missed =
    sessions.loaded && breaks.loaded
      ? missedSessions(
          sessions.value.filter((session) => session.planId === plan.id),
          today as LocalDate,
          breaks.value,
        )
      : [];

  if (missed.length === 0) return null;
  const resolve = async (session: PlannedSession, choice: MissedChoice) => {
    setError(null);
    const result = await run((planning, deps) =>
      planning.resolveMissedSession(deps, { sessionId: session.id, choice }),
    );
    if (result.ok) onChanged(result.value);
    else
      setError(
        result.error.kind === 'noTarget'
          ? t`There is no later session this week to merge it into. Do it today or skip it.`
          : t`This session changed meanwhile. Try again.`,
      );
  };
  return (
    <Card className="border-2 border-warning">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <CalendarClock aria-hidden="true" className="text-warning" />
        <Plural value={missed.length} one="# missed session" other="# missed sessions" />
      </h2>
      <p>
        <Trans>Nothing is dropped without you deciding. Choose for each one:</Trans>
      </p>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      <ul className="flex flex-col gap-3">
        {missed.map((session) => {
          const name = session.name.en;
          const date = formatLocalDate(session.localDate);
          return (
            <li key={session.id} className="flex flex-col gap-2 rounded-xl bg-surface-raised p-3">
              <p className="font-semibold">
                <Trans>
                  {name}, planned {date}
                </Trans>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  aria-label={t`Do ${name} today`}
                  onClick={() => void resolve(session, 'doToday')}
                >
                  <Trans>Do it today</Trans>
                </Button>
                <Button
                  aria-label={t`Merge ${name} into the next session`}
                  onClick={() => void resolve(session, 'merge')}
                >
                  <Trans>Merge into next</Trans>
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t`Skip ${name}`}
                  onClick={() => void resolve(session, 'skip')}
                >
                  <Trans>Skip it</Trans>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The week's planned sessions by day; a tap opens the session with move, swap and train early. */
function WeekView({
  from,
  today,
  novice,
  onChanged,
}: {
  from: LocalDate;
  today: LocalDate;
  novice: boolean;
  onChanged: (outcome: Outcome) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const to = addLocalDays(from, 6) as LocalDate;
  const sessions = usePlannedSessions(from, to);
  const breaks = useBreaks();
  const [open, setOpen] = useState<PlannedSession | null>(null);
  const list = sessions.loaded ? sessions.value : [];
  const days = Array.from({ length: 7 }, (_, index) => addLocalDays(from, index) as LocalDate);
  const onBreak = (date: string) =>
    breaks.loaded &&
    breaks.value.some(
      (entry) => entry.startDate <= date && (entry.endDate === null || entry.endDate >= date),
    );
  return (
    <>
      <ol className="flex flex-col gap-2">
        {days.map((date) => {
          const planned = list.filter((session) => session.localDate === date);
          const isToday = date === today;
          return (
            <li
              key={date}
              className={`flex flex-col gap-1 rounded-xl p-3 ${isToday ? 'border-2 border-primary bg-surface' : 'bg-surface'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {formatLocalDate(date)}
                  {isToday ? ` · ${t`today`}` : ''}
                </span>
                {onBreak(date) ? (
                  <Badge tone="neutral" icon={Pause}>
                    {t`Break`}
                  </Badge>
                ) : null}
              </div>
              {planned.length === 0 ? (
                <span className="text-sm text-fg-muted">
                  <Trans>Rest day</Trans>
                </span>
              ) : (
                planned.map((session) => (
                  <button
                    type="button"
                    key={session.id}
                    onClick={() => setOpen(session)}
                    aria-haspopup="dialog"
                    className="flex min-h-target flex-wrap items-center justify-between gap-2 rounded-xl border border-control px-3 py-2 text-left"
                  >
                    <span className="font-semibold">{session.name.en}</span>
                    <span className="flex flex-wrap gap-1">
                      {session.kind === 'deload' ? (
                        <Badge tone="info">{t`Lighter week`}</Badge>
                      ) : null}
                      {session.status !== 'planned' ? (
                        <Badge tone="neutral" icon={null}>
                          {labels.sessionStatus(session.status)}
                        </Badge>
                      ) : null}
                      {session.adjustments.some((entry) => entry.kind === 'returnFromBreak') ? (
                        <Badge tone="info">{t`Easing back in`}</Badge>
                      ) : null}
                    </span>
                  </button>
                ))
              )}
            </li>
          );
        })}
      </ol>
      {open ? (
        <SessionSheet
          session={open}
          week={list}
          today={today}
          novice={novice}
          onClose={() => setOpen(null)}
          onChanged={(outcome) => {
            setOpen(null);
            onChanged(outcome);
          }}
        />
      ) : null}
    </>
  );
}

/** PLN-11 for one session: its exercises, then move (or train early), swap with another day. */
function SessionSheet({
  session,
  week,
  today,
  novice,
  onClose,
  onChanged,
}: {
  session: PlannedSession;
  week: readonly PlannedSession[];
  today: LocalDate;
  novice: boolean;
  onClose: () => void;
  onChanged: (outcome: Outcome) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = usePlanning();
  const prescription = usePrescriptionText(novice);
  const [error, setError] = useState<string | null>(null);
  const planned = session.status === 'planned';
  const weekStart = addLocalDays(session.localDate, -6);
  const options = Array.from({ length: 13 }, (_, index) => addLocalDays(weekStart, index)).filter(
    (date) => date !== session.localDate && date >= today,
  );
  const others = week.filter((other) => other.id !== session.id && other.status === 'planned');
  const commit = async (
    task: Parameters<
      typeof run<{ ok: true; value: ScheduleChange } | { ok: false; error: unknown }>
    >[0],
  ) => {
    const result = await run(task);
    if (result.ok) onChanged(result.value);
    else setError(t`This session changed meanwhile. Close and try again.`);
  };
  return (
    <Sheet
      open
      onOpenChange={(isOpen) => (isOpen ? null : onClose())}
      title={session.name.en}
      description={formatLocalDate(session.localDate, 'long')}
      closeLabel={t`Close`}
    >
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {session.adjustments.map((adjustment, index) => (
        <Callout key={index} tone="info">
          {adjustment.kind === 'deload' ? (
            <Trans>
              Lighter week: fewer sets and more reps in reserve, so you recover and come back
              stronger.
            </Trans>
          ) : adjustment.kind === 'returnFromBreak' ? (
            <Trans>
              Easing back in after {adjustment.daysOff ?? 0} days off: lighter loads and fewer sets
              this time.
            </Trans>
          ) : adjustment.kind === 'mergedWork' ? (
            <Trans>Includes key work from a missed session.</Trans>
          ) : (
            <Trans>Calibration: start conservatively so POWR can learn your loads.</Trans>
          )}
        </Callout>
      ))}
      <ol className="flex flex-col divide-y divide-border">
        {session.slots.map((slot) => (
          <li key={slot.key} className="py-2">
            <span className="font-semibold">{labels.exercise(slot.exerciseId)}</span>
            <span className="block text-sm text-fg-muted">{prescription(slot.prescription)}</span>
          </li>
        ))}
      </ol>
      {planned ? (
        <>
          <h3 className="font-semibold">
            <Trans>Move to another day</Trans>
          </h3>
          <div className="flex flex-wrap gap-2">
            {options.map((date) => (
              <Button
                key={date}
                variant={date === today ? 'primary' : 'secondary'}
                onClick={() =>
                  void commit((planning, deps) =>
                    planning.moveSession(deps, { sessionId: session.id, date: date as LocalDate }),
                  )
                }
              >
                {date === today ? t`Today` : formatLocalDate(date)}
              </Button>
            ))}
          </div>
          {others.length > 0 ? (
            <>
              <h3 className="font-semibold">
                <Trans>Swap days with</Trans>
              </h3>
              <div className="flex flex-wrap gap-2">
                {others.map((other) => (
                  <Button
                    key={other.id}
                    onClick={() =>
                      void commit((planning, deps) =>
                        planning.swapSessions(deps, { a: session.id, b: other.id }),
                      )
                    }
                  >
                    <Trans>
                      {other.name.en}, {formatLocalDate(other.localDate)}
                    </Trans>
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

/** PLN-12/PRG-13: declare a break; ending it applies the return ramp to the next weeks. */
function BreakCard({ onChanged }: { onChanged: (outcome: Outcome) => void }) {
  const { t } = useLingui();
  const labels = useLabels();
  const run = usePlanning();
  const breaks = useBreaks();
  const today = todayLocal();
  const [starting, setStarting] = useState(false);
  const [reason, setReason] = useState<BreakReason>('vacation');
  const [start, setStart] = useState<string>(today);
  const [end, setEnd] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const current: TrainingBreak | undefined = breaks.loaded
    ? breaks.value.find((entry) => entry.endDate === null || entry.endDate >= today)
    : undefined;

  return (
    <Card>
      <h2 className="text-xl font-bold">
        <Trans>Breaks</Trans>
      </h2>
      {current ? (
        <>
          <p>
            {current.endDate ? (
              <Trans>
                {labels.breakReason(current.reason)}: {formatLocalDate(current.startDate)} to{' '}
                {formatLocalDate(current.endDate)}
              </Trans>
            ) : (
              <Trans>
                {labels.breakReason(current.reason)} since {formatLocalDate(current.startDate)}
              </Trans>
            )}
          </p>
          <p className="text-fg-muted">
            <Trans>
              Sessions in a break do not count as missed. When you are back, the first weeks ease
              you in.
            </Trans>
          </p>
          <Button
            variant="primary"
            onClick={() =>
              void run((planning, deps) => planning.endBreak(deps, { breakId: current.id })).then(
                (result) => {
                  if (result.ok) onChanged({ why: result.value.adjusted.why });
                  else setError(t`The break could not be ended. Check its dates.`);
                },
              )
            }
          >
            <Trans>I'm back: end the break</Trans>
          </Button>
        </>
      ) : starting ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (end !== '' && end < start) {
              setError(t`The end date must be on or after the start date.`);
              return;
            }
            void run((planning, deps) =>
              planning.startBreak(deps, {
                startDate: start as LocalDate,
                ...(end ? { endDate: end as LocalDate } : {}),
                reason,
              }),
            ).then((result) => {
              if (result.ok) setStarting(false);
              else setError(t`The end date must be on or after the start date.`);
            });
          }}
        >
          <ChoiceCards<BreakReason>
            legend={t`Reason`}
            value={reason}
            onChange={setReason}
            options={BREAK_REASONS.map((value) => ({ value, label: labels.breakReason(value) }))}
          />
          <Field
            label={t`From`}
            type="date"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <Field
            label={t`Until (optional)`}
            hint={t`Leave empty if you do not know yet.`}
            type="date"
            value={end}
            error={error ?? undefined}
            onChange={(event) => setEnd(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary">
              <Trans>Start the break</Trans>
            </Button>
            <Button onClick={() => setStarting(false)}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-fg-muted">
            <Trans>
              Going on holiday or feeling ill? Pause the plan so nothing counts as missed.
            </Trans>
          </p>
          <Button onClick={() => setStarting(true)}>
            <Pause aria-hidden="true" />
            <Trans>Plan a break</Trans>
          </Button>
        </>
      )}
      {error && !starting ? <Callout tone="danger">{error}</Callout> : null}
    </Card>
  );
}

/** PRG-11/PRG-12: the deload week, postpone (once) or skip it, and the reactive check. */
function DeloadCard({
  plan,
  mesocycle,
  deloadStart,
  onChanged,
}: {
  plan: Plan;
  mesocycle: Mesocycle;
  deloadStart: string;
  onChanged: (outcome: Outcome) => void;
}) {
  const { t } = useLingui();
  const run = usePlanning();
  const [check, setCheck] = useState<ReactiveDeloadCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const done = (
    result: { ok: true; value: { why: Explanation } } | { ok: false; error: MesocycleError },
  ) => {
    if (result.ok) onChanged({ why: result.value.why });
    else if (result.error.kind === 'notAllowed') {
      setError(null);
      onChanged({ why: result.error.why });
    } else setError(t`The plan changed meanwhile. Try again.`);
  };
  const state = mesocycle.deload;
  return (
    <Card>
      <h2 className="text-xl font-bold">
        <Trans>Lighter week (deload)</Trans>
      </h2>
      <p>
        {state.skipped ? (
          <Trans>Skipped this block. Your sessions stay as planned.</Trans>
        ) : (
          <Trans>
            Planned from {formatLocalDate(deloadStart, 'long')}: fewer sets and easier efforts, so
            you recover.
          </Trans>
        )}
      </p>
      <p className="text-sm text-fg-muted">
        <Trans>Based on practitioner surveys and expert consensus.</Trans>
      </p>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {state.skipped ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={state.postponed}
            onClick={() =>
              void run((planning, deps) => planning.postponeDeload(deps, plan.id)).then(done)
            }
          >
            {state.postponed ? (
              <Trans>Already postponed once</Trans>
            ) : (
              <Trans>Postpone one week</Trans>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              void run((planning, deps) => planning.skipDeload(deps, plan.id)).then(done)
            }
          >
            <Trans>Skip it this block</Trans>
          </Button>
        </div>
      )}
      <Button
        onClick={() =>
          void run((planning, deps) =>
            planning.checkReactiveDeload(deps, { planId: plan.id }),
          ).then((result) =>
            result.ok
              ? setCheck(result.value)
              : setError(t`The plan changed meanwhile. Try again.`),
          )
        }
      >
        <Trans>Do I need it sooner?</Trans>
      </Button>
      <output className="block empty:hidden">{check ? <WhyText why={check.why} /> : null}</output>
      {check ? (
        <div className="flex flex-col gap-2">
          <div>
            <WhyButton why={check.why} subject={t`the deload check`} />
          </div>
          {check.propose && check.week !== null ? (
            <Button
              variant="primary"
              onClick={() =>
                void run((planning, deps) =>
                  planning.bringDeloadForward(deps, { planId: plan.id, week: check.week! }),
                ).then(done)
              }
            >
              <Trans>Bring the lighter week forward to week {check.week}</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
