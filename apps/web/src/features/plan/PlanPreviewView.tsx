import { Trans, useLingui } from '@lingui/react/macro';
import { CalendarDays } from 'lucide-react';

import type { PlanPreview } from '@powr/application/planning';
import type { EquipmentProfile, MuscleId } from '@powr/domain';
import type { Explanation } from '@powr/domain/explain';
import type { PlanFix } from '@powr/domain/planning';

import { Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { Card } from '#ui/screen';

import { formatLocalDate, formatMinutes } from '../../i18n/format';
import { useLabels } from '../labels';
import { WhyButton, WhyNamesContext, WhyText } from '../why/WhySheet';
import { isInputFix, useFixText } from './format';
import { DayCard, IssueList, LiftList, VolumeList } from './parts';

/** The `plan.volume.target` explanation of each muscle, from the proposal's notes. */
function targetWhy(notes: readonly Explanation[]) {
  return (muscle: MuscleId) =>
    notes.find((note) => note.rule === 'plan.volume.target' && note.args['muscle'] === muscle);
}

/**
 * ONB-10 plan preview: split and level with their "Why?", the weekly calendar, every day with
 * exercises, sets and estimated minutes, the weekly volume per muscle against its band, the
 * progression model, start date, notes (time budget, bodyweight-only) and the PLN-01 report.
 */
export function PlanPreviewView({
  preview,
  equipment,
  novice,
  onInputFix,
}: {
  preview: PlanPreview;
  equipment: EquipmentProfile | undefined;
  novice: boolean;
  onInputFix?: (fix: PlanFix) => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const fixText = useFixText();
  const { proposal } = preview;
  const minutesOf = (dayKey: string) =>
    proposal.report.analysis.days.find((day) => day.dayKey === dayKey)?.minutes;
  const budget = preview.schedule.sessionMinutes;
  const noEquipment = equipment !== undefined && equipment.items.length === 0;
  const budgetNote = proposal.notes.find((note) => note.rule === 'plan.volume.budget');
  const budgetFixes = proposal.report.issues
    .flatMap((issue) => (issue.cause === 'timeBudget' ? issue.fixes : []))
    .filter(isInputFix)
    .filter((fix, index, all) => all.findIndex((other) => other.kind === fix.kind) === index);
  const level = labels.level(preview.level);
  const template = proposal.template.name.en;
  const weeks = proposal.accumulationWeeks;
  const start = formatLocalDate(preview.startDate, 'long');
  const progression = labels.progression(proposal.progression.primary);
  const names = {
    days: proposal.days,
    slots: new Map(proposal.choices.map((choice) => [choice.slotKey, choice.exerciseId])),
  };
  const issues = proposal.report.issues.filter(
    (issue) =>
      issue.severity === 'violation' || issue.cause === null || issue.cause === 'timeBudget',
  );

  return (
    <WhyNamesContext value={names}>
      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="text-2xl font-bold">{template}</h2>
          <p>
            <WhyText why={preview.why} />
          </p>
          <div className="flex flex-wrap gap-2">
            <WhyButton why={preview.why} subject={template} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-fg-muted">
              <Trans>Level</Trans>
            </dt>
            <dd className="flex flex-wrap items-center gap-1 capitalize">
              {level}
              <WhyButton why={preview.levelWhy} subject={t`your level`} />
            </dd>
            <dt className="text-fg-muted">
              <Trans>Block</Trans>
            </dt>
            <dd>
              <Trans>{weeks} weeks of training, then a lighter week</Trans>
            </dd>
            <dt className="text-fg-muted">
              <Trans>Progress</Trans>
            </dt>
            <dd>{progression}</dd>
            <dt className="text-fg-muted">
              <Trans>Starts</Trans>
            </dt>
            <dd>{start}</dd>
          </dl>
        </Card>

        {noEquipment ? (
          <Callout tone="info" title={t`Bodyweight plan`}>
            <p>
              <Trans>
                You saved your equipment list empty, so this plan uses bodyweight exercises only.
                Add equipment any time in Settings and POWR offers to swap exercises in.
              </Trans>
            </p>
          </Callout>
        ) : null}

        {budgetNote ? (
          <Callout tone="warning" title={t`Your session time is tight`}>
            <p>
              <WhyText why={budgetNote} />
            </p>
            {onInputFix && budgetFixes.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {budgetFixes.map((fix) => (
                  <Button key={fix.kind} onClick={() => onInputFix(fix)}>
                    {fixText(fix, (_, slot) => slot)}
                  </Button>
                ))}
              </div>
            ) : null}
            <div>
              <WhyButton why={budgetNote} subject={t`the time budget`} />
            </div>
          </Callout>
        ) : null}

        <section className="flex flex-col gap-2" aria-labelledby="preview-calendar">
          <h2 id="preview-calendar" className="flex items-center gap-2 text-xl font-bold">
            <CalendarDays aria-hidden="true" />
            <Trans>Your first week</Trans>
          </h2>
          <ul className="flex flex-col gap-1">
            {preview.calendar.map((entry) => {
              const day = proposal.days.find((candidate) => candidate.key === entry.dayKey);
              const minutes = minutesOf(entry.dayKey);
              return (
                <li
                  key={entry.dayKey}
                  className="flex flex-wrap justify-between gap-x-2 rounded-xl bg-surface p-3"
                >
                  <span className="font-semibold">{formatLocalDate(entry.date)}</span>
                  <span>
                    {day?.name.en}
                    {minutes !== undefined ? ` · ${formatMinutes(minutes)}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
          {budget !== null ? (
            <p className="text-sm text-fg-muted">
              <Trans>Your session budget: {formatMinutes(budget)}</Trans>
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="preview-days">
          <h2 id="preview-days" className="text-xl font-bold">
            <Trans>Sessions</Trans>
          </h2>
          {proposal.days.map((day) => (
            <DayCard
              key={day.key}
              day={day}
              minutes={minutesOf(day.key)}
              budget={budget}
              novice={novice}
              renderSlotExtra={(slotKey) => {
                const choice = proposal.choices.find(
                  (entry) => entry.dayKey === day.key && entry.slotKey === slotKey,
                );
                return choice ? (
                  <div>
                    <WhyButton why={choice.why} subject={labels.exercise(choice.exerciseId)} />
                  </div>
                ) : null;
              }}
            />
          ))}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="preview-volume">
          <h2 id="preview-volume" className="text-xl font-bold">
            <Trans>Weekly sets per muscle</Trans>
          </h2>
          <p className="text-fg-muted">
            <Trans>
              Hard sets per week; a set for a helping muscle counts half. Most people grow well with
              10 to 20.
            </Trans>
          </p>
          <VolumeList
            analysis={proposal.report.analysis}
            targets={proposal.targets}
            whyOf={targetWhy(proposal.notes)}
          />
          <LiftList analysis={proposal.report.analysis} />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="preview-checks">
          <h2 id="preview-checks" className="text-xl font-bold">
            <Trans>Plan checks</Trans>
          </h2>
          <IssueList issues={issues} days={proposal.days} emptyText={t`Every check passed.`} />
        </section>
      </div>
    </WhyNamesContext>
  );
}
