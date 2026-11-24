import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';

import type { MuscleId, MuscleTarget, PlanDay } from '@powr/domain';
import type { Explanation } from '@powr/domain/explain';
import type { IssueCause, PlanFix, ValidationIssue, WeekAnalysis } from '@powr/domain/planning';

import { Badge, Callout, type Tone } from '#ui/badge';
import { Button } from '#ui/button';
import { cn } from '#ui/cn';
import { Card } from '#ui/screen';

import { formatMinutes } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { WhyButton, WhyText } from '../why/WhySheet';
import {
  heatStep,
  isInputFix,
  useFixText,
  useHeatLabel,
  usePrescriptionText,
  useRestText,
  type HeatStep,
} from './format';

const HEAT_FILL = [
  'bg-heat-0',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
  'bg-heat-5',
] as const;

/** A heat-map swatch: colour plus the step's label next to it (never colour alone). */
function HeatSwatch({ step, className }: { step: HeatStep; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-4 shrink-0 rounded-sm border border-fg',
        HEAT_FILL[step],
        className,
      )}
    />
  );
}

/** The legend of the volume scale (under target → in target 10–20 → over). */
function HeatLegend() {
  const label = useHeatLabel();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {([0, 1, 2, 3, 4, 5] as const).map((step) => (
        <li key={step} className="flex items-center gap-1">
          <HeatSwatch step={step} />
          {label(step)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Weekly fractional sets per muscle against the target and the evidence band (PLN-03, PLN-09's
 * mini heat map): each row shows the numbers, the step's label and a bar with the target marked.
 */
export function VolumeList({
  analysis,
  targets,
  whyOf,
}: {
  analysis: WeekAnalysis;
  targets: readonly MuscleTarget[];
  whyOf?: (muscle: MuscleId) => Explanation | undefined;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const heatLabel = useHeatLabel();
  const rows = analysis.muscles.filter((week) => week.target !== null || week.fractional >= 1);
  return (
    <div className="flex flex-col gap-3">
      <HeatLegend />
      <ul className="flex flex-col gap-2">
        {rows.map((week) => {
          const step = heatStep(week);
          const target = targets.find((entry) => entry.muscle === week.muscle);
          const name = labels.muscle(week.muscle);
          const sets = Math.round(week.fractional * 10) / 10;
          const goal = target?.sets ?? null;
          const scale = Math.max(30, sets, goal ?? 0);
          const why = whyOf?.(week.muscle);
          return (
            <li key={week.muscle} className="flex flex-col gap-1 rounded-xl bg-surface-raised p-3">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="font-semibold">{name}</span>
                {goal === null ? null : sets + 0.05 >= goal ? (
                  <Badge tone="ok">{t`Target met`}</Badge>
                ) : (
                  <Badge tone="warning">{t`${Math.round((goal - sets) * 10) / 10} below target`}</Badge>
                )}
              </div>
              {/* The bar repeats the numbers below it, which screen readers read instead. */}
              <div
                aria-hidden="true"
                className="relative h-3 overflow-hidden rounded-full border border-control bg-surface"
              >
                <span
                  className={cn('block h-full', HEAT_FILL[step])}
                  style={{ width: `${Math.min(100, (sets / scale) * 100)}%` }}
                />
                {goal !== null ? (
                  <span
                    className="absolute top-0 h-full w-0.5 bg-fg"
                    style={{ left: `${Math.min(99, (goal / scale) * 100)}%` }}
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm text-fg-muted">
                <span className="flex items-center gap-1 text-fg">
                  <HeatSwatch step={step} />
                  {heatLabel(step)}
                </span>
                <span className="tabular">
                  {goal === null ? (
                    <Trans>{sets} sets a week</Trans>
                  ) : (
                    <Trans>
                      {sets} of {goal} sets a week
                    </Trans>
                  )}
                  {target ? ` · ${labels.targetSource(target.source)}` : ''}
                  {target?.full !== undefined ? (
                    <>
                      {' · '}
                      <Trans>full target {target.full}</Trans>
                    </>
                  ) : null}
                </span>
                {why ? <WhyButton why={why} subject={name} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** PLN-03 strength dose per competition lift. */
export function LiftList({ analysis }: { analysis: WeekAnalysis }) {
  const labels = useLabels();
  if (analysis.lifts.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {analysis.lifts.map((lift) => {
        const name = labels.lift(lift.lift);
        const sessions = lift.sessions;
        const sets = lift.heavySets;
        const target = lift.target;
        return (
          <li key={lift.lift} className="rounded-xl bg-surface-raised p-3">
            <span className="font-semibold capitalize">{name}</span>
            <p className="text-sm text-fg-muted tabular">
              {target === null ? (
                <Trans>
                  {sets} heavy sets on {sessions} days
                </Trans>
              ) : (
                <Trans>
                  {sets} of {target} heavy sets on {sessions} days
                </Trans>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function useCauseText() {
  const { t } = useLingui();
  return (cause: IssueCause): string => {
    switch (cause) {
      case 'timeBudget':
        return t`Your session time does not allow more.`;
      case 'sessionCap':
        return t`The sessions already hold as much for this muscle as is useful.`;
      case 'slotLimit':
        return t`The exercises for it already have the most sets that make sense.`;
      case 'equipment':
        return t`Your equipment has no exercise for this.`;
      case 'template':
        return t`This plan layout has no exercise for it.`;
      case 'days':
        return t`Your number of training days does not allow it.`;
      default:
        return assertNever(cause);
    }
  };
}

/**
 * The validation issues (PLN-01, PLN-09): severity as an icon plus words, the message, why it is
 * unavoidable (its cause) or one-tap fixes, a "Why?" and, where allowed, dismiss.
 */
/**
 * PLN-14 time-budget note: the `plan.volume.budget` explanation (how many targets were lowered,
 * which muscles keep theirs, the session length that would fit), the input fixes as buttons
 * where the screen can apply them, and "Why?". The first plan and the next block (TD-36) share it.
 */
export function BudgetNote({
  note,
  issues,
  onInputFix,
}: {
  note: Explanation;
  issues: readonly ValidationIssue[];
  onInputFix?: ((fix: PlanFix) => void) | undefined;
}) {
  const { t } = useLingui();
  const fixText = useFixText();
  const fixes = issues
    .flatMap((issue) => (issue.cause === 'timeBudget' ? issue.fixes : []))
    .filter(isInputFix)
    .filter((fix, index, all) => all.findIndex((other) => other.kind === fix.kind) === index);
  return (
    <Callout tone="warning" title={t`Your session time is tight`}>
      <p>
        <WhyText why={note} />
      </p>
      {onInputFix && fixes.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {fixes.map((fix) => (
            <Button key={fix.kind} onClick={() => onInputFix(fix)}>
              {fixText(fix, (_, slot) => slot)}
            </Button>
          ))}
        </div>
      ) : null}
      <div>
        <WhyButton why={note} subject={t`the time budget`} />
      </div>
    </Callout>
  );
}

export function IssueList({
  issues,
  days,
  onFix,
  onDismiss,
  emptyText,
}: {
  issues: readonly ValidationIssue[];
  days: readonly PlanDay[];
  onFix?: ((issue: ValidationIssue, fix: PlanFix) => void) | undefined;
  onDismiss?: ((issue: ValidationIssue) => void) | undefined;
  emptyText?: ReactNode;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const fixText = useFixText();
  const causeText = useCauseText();
  const slotName = (dayKey: string, slotKey: string) => {
    const slot = days
      .find((day) => day.key === dayKey)
      ?.slots.find((entry) => entry.key === slotKey);
    return slot ? labels.exercise(slot.exerciseId) : slotKey;
  };
  if (issues.length === 0) return emptyText ? <p className="text-fg-muted">{emptyText}</p> : null;
  return (
    <ul className="flex flex-col gap-3">
      {issues.map((issue) => {
        const tone: Tone = issue.severity === 'violation' ? 'danger' : 'warning';
        return (
          <li
            key={issue.key}
            className="flex flex-col gap-2 rounded-2xl border border-control bg-surface p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>
                {issue.severity === 'violation' ? t`Needs attention` : t`Worth a look`}
              </Badge>
            </div>
            <p>
              <WhyText why={issue.why} />
            </p>
            {issue.cause ? <p className="text-sm text-fg-muted">{causeText(issue.cause)}</p> : null}
            <div className="flex flex-wrap gap-2">
              {onFix
                ? issue.fixes.map((fix) => (
                    <Button
                      key={JSON.stringify(fix)}
                      variant={isInputFix(fix) ? 'secondary' : 'primary'}
                      onClick={() => onFix(issue, fix)}
                    >
                      {fixText(fix, slotName)}
                    </Button>
                  ))
                : issue.fixes.map((fix) => (
                    <span key={JSON.stringify(fix)} className="text-sm">
                      <Trans>Possible fix: {fixText(fix, slotName)}</Trans>
                    </span>
                  ))}
              <WhyButton why={issue.why} subject={t`this warning`} />
              {onDismiss && issue.severity === 'warning' ? (
                <Button variant="ghost" onClick={() => onDismiss(issue)}>
                  <Trans>Dismiss</Trans>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** One training day: weekday, name, estimated minutes against the budget, its exercises. */
export function DayCard({
  day,
  minutes,
  budget,
  novice,
  dateLabel,
  renderSlotExtra,
  headerExtra,
}: {
  day: PlanDay;
  minutes: number | undefined;
  budget: number | null;
  novice: boolean;
  dateLabel?: string;
  renderSlotExtra?: (slotKey: string) => ReactNode;
  headerExtra?: ReactNode;
}) {
  const labels = useLabels();
  const prescription = usePrescriptionText(novice);
  const rest = useRestText();
  const over = minutes !== undefined && budget !== null && minutes > budget * 1.1;
  const duration = minutes === undefined ? null : formatMinutes(minutes);
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xl font-bold">{day.name.en}</h3>
        <span className="text-fg-muted">{dateLabel ?? labels.weekday(day.weekday)}</span>
      </div>
      {duration ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Clock aria-hidden="true" className="size-4" />
          <Trans>about {duration}</Trans>
          {over ? (
            <Badge tone="warning">
              <Trans>over your time</Trans>
            </Badge>
          ) : null}
        </p>
      ) : null}
      {headerExtra}
      <ol className="flex flex-col divide-y divide-border">
        {day.slots.map((slot) => (
          <li key={slot.key} className="flex flex-col gap-0.5 py-2">
            <span className="font-semibold">{labels.exercise(slot.exerciseId)}</span>
            <span className="text-sm text-fg-muted tabular">
              {prescription(slot.prescription)} · {rest(slot)}
            </span>
            {renderSlotExtra?.(slot.key)}
          </li>
        ))}
      </ol>
      <p className="text-sm text-fg-muted">
        <Plural value={day.slots.length} one="# exercise" other="# exercises" />
      </p>
    </Card>
  );
}
