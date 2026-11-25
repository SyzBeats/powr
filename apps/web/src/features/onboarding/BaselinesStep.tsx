import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useState } from 'react';

import type { BaselineLifts, PlanningAnswers } from '@powr/application/planning';
import { displayMass, type Baseline, type ExerciseId, type LocalDate } from '@powr/domain';
import type { BaselineE1rm } from '@powr/domain/e1rm';
import type { Explained } from '@powr/domain/explain';

import { Callout } from '#ui/badge';
import { Field } from '#ui/field';
import { Segmented } from '#ui/segmented';

import { usePlanning } from '../../hooks/use-planning';
import { formatMass, todayLocal } from '../../i18n/format';
import { useLabels } from '../labels';
import { WhyButton, WhyText } from '../why/WhySheet';
import {
  completeAnswers,
  deviceLocale,
  draftUnits,
  type BaselineInput,
  type BaselineKind,
} from './answers';
import { baselineInput, withBaselineInput } from './baseline-input';
import type { StepProps } from './steps';

/** The error keys of one lift's fields (the flow's step validation sets them). */
export const baselineErrorKey = (exerciseId: ExerciseId, field: 'load' | 'reps' | 'date') =>
  `baseline:${exerciseId}:${field}`;

type RirChoice = '0' | '1' | '2' | '3' | '4' | 'unknown';

/**
 * ONB-08 (optional, skippable in one tap): for the main lifts of the plan the answers give, a
 * known 1-rep max or a recent set (weight × reps, reps in reserve if known). Each entry shows the
 * starting e1RM the engine derives from it, with "Why?"; a 1RM older than about 3 months says it
 * will be refined. Without an entry the first sessions calibrate (PRG-08), as the intro says.
 */
export function BaselinesStep({ draft, update, errors }: StepProps) {
  const { t } = useLingui();
  const run = usePlanning();
  const labels = useLabels();
  const unit = draftUnits(draft).load;
  const today = todayLocal() as LocalDate;
  const equipment = draft.equipment;
  const style = draft.style ?? 'bodybuilding';

  // The lifts to ask about: the plan's main lifts plus those already started (kept editable).
  const keep = [
    ...new Set([
      ...Object.keys(draft.baselineInputs ?? {}),
      ...(draft.baselines ?? []).map((baseline) => baseline.exerciseId),
    ]),
  ].toSorted();
  const liftsKey = equipment
    ? JSON.stringify({
        answers: { ...completeAnswers(draft, equipment, deviceLocale()), baselines: [] },
        keep,
      })
    : null;
  const [lifts, setLifts] = useState<{
    readonly key: string;
    readonly value: BaselineLifts;
  } | null>(null);
  useEffect(() => {
    if (liftsKey === null) return undefined;
    let cancelled = false;
    const input = JSON.parse(liftsKey) as {
      readonly answers: PlanningAnswers;
      readonly keep: readonly ExerciseId[];
    };
    void run((planning, deps) => planning.baselineLifts(deps, input)).then((value) => {
      if (!cancelled) setLifts({ key: liftsKey, value });
    });
    return () => {
      cancelled = true;
    };
  }, [liftsKey, run]);
  // While a new list loads, the last one stays: the cards (and the focus in them) never vanish
  // when the first entry adds its lift to `keep`.
  const current = lifts?.value ?? null;

  // The starting e1RM of every complete entry (the same engine as logged sets).
  const estimatesKey = JSON.stringify({ style, baselines: draft.baselines ?? [] });
  const [estimates, setEstimates] = useState<{
    readonly key: string;
    readonly value: ReadonlyMap<string, Explained<BaselineE1rm | null>>;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const input = JSON.parse(estimatesKey) as {
      style: typeof style;
      baselines: readonly Baseline[];
    };
    void run((planning, deps) =>
      Promise.all(
        input.baselines.map(
          async (baseline) =>
            [
              baseline.exerciseId,
              await planning.estimateBaseline(deps, { baseline, style: input.style }),
            ] as const,
        ),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const found = new Map<string, Explained<BaselineE1rm | null>>();
      for (const [exerciseId, estimate] of entries) if (estimate) found.set(exerciseId, estimate);
      setEstimates({ key: estimatesKey, value: found });
    });
    return () => {
      cancelled = true;
    };
  }, [estimatesKey, run]);
  const estimateOf = (exerciseId: ExerciseId) =>
    estimates?.key === estimatesKey ? estimates.value.get(exerciseId) : undefined;

  const change = (exerciseId: ExerciseId, input: BaselineInput) =>
    update(withBaselineInput(draft, exerciseId, input, unit, today));

  return (
    <>
      <p className="text-fg-muted">
        <Trans>
          Optional. If you know a recent set or your 1-rep max for these lifts, POWR works out the
          loads of your first workouts from it. Skip it, and your first workouts start light while
          POWR learns what you lift.
        </Trans>
      </p>
      {current ? (
        <div>
          <WhyButton why={current.fallback} subject={t`starting without these numbers`} />
        </div>
      ) : null}
      {!equipment ? (
        <Callout tone="warning">
          <Trans>Choose your equipment first, so POWR knows which lifts your plan uses.</Trans>
        </Callout>
      ) : current === null ? (
        <output className="block text-fg-muted">
          <Trans>Finding the main lifts of your plan…</Trans>
        </output>
      ) : current.lifts.length === 0 ? (
        <Callout tone="info">
          <Trans>
            Your plan has no lifts with weights to enter here. Your first workouts start light
            instead.
          </Trans>
        </Callout>
      ) : (
        current.lifts.map((lift) => (
          <LiftCard
            key={lift.exerciseId}
            name={labels.exercise(lift.exerciseId)}
            exerciseId={lift.exerciseId}
            input={baselineInput(draft, lift.exerciseId)}
            unit={unit}
            today={today}
            estimate={estimateOf(lift.exerciseId)}
            errors={errors}
            onChange={(input) => change(lift.exerciseId, input)}
          />
        ))
      )}
    </>
  );
}

function LiftCard({
  name,
  exerciseId,
  input,
  unit,
  today,
  estimate,
  errors,
  onChange,
}: {
  name: string;
  exerciseId: ExerciseId;
  input: BaselineInput;
  unit: 'kg' | 'lb';
  today: LocalDate;
  estimate: Explained<BaselineE1rm | null> | undefined;
  errors: Readonly<Record<string, string>>;
  onChange: (input: BaselineInput) => void;
}) {
  const { t } = useLingui();
  const set = (patch: Partial<BaselineInput>) => onChange({ ...input, ...patch });
  const rirOptions: { value: RirChoice; label: string }[] = [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: 'unknown', label: t`Not sure` },
  ];
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <h2 id={headingId} className="text-lg font-bold">
        {name}
      </h2>
      <Segmented<BaselineKind>
        label={t`What do you know about your ${name}?`}
        value={input.kind}
        onChange={(kind) => set({ kind })}
        options={[
          { value: 'none', label: t`Not now` },
          { value: 'recentSet', label: t`A recent set` },
          { value: 'oneRepMax', label: t`My 1-rep max` },
        ]}
      />
      {input.kind === 'none' ? null : (
        <div className="flex flex-wrap gap-3">
          <Field
            className="min-w-0 flex-1 basis-32"
            label={input.kind === 'oneRepMax' ? t`1-rep max` : t`Weight`}
            inputMode="decimal"
            autoComplete="off"
            suffix={unit}
            value={input.load}
            error={errors[baselineErrorKey(exerciseId, 'load')]}
            onChange={(event) => set({ load: event.target.value })}
          />
          {input.kind === 'recentSet' ? (
            <Field
              className="min-w-0 flex-1 basis-32"
              label={t`Reps`}
              inputMode="numeric"
              autoComplete="off"
              value={input.reps}
              error={errors[baselineErrorKey(exerciseId, 'reps')]}
              onChange={(event) => set({ reps: event.target.value })}
            />
          ) : (
            <Field
              className="min-w-0 flex-1 basis-40"
              label={t`When did you lift it? (optional)`}
              type="date"
              max={today}
              value={input.date}
              error={errors[baselineErrorKey(exerciseId, 'date')]}
              onChange={(event) => set({ date: event.target.value })}
            />
          )}
        </div>
      )}
      {input.kind === 'recentSet' ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            <Trans>Reps left in the tank (RIR)</Trans>
          </p>
          <p className="text-sm text-fg-muted">
            <Trans>How many more reps could you have done? Not sure is fine.</Trans>
          </p>
          <Segmented<RirChoice>
            label={t`Reps left in the tank (RIR)`}
            value={input.rir === null ? 'unknown' : (String(input.rir) as RirChoice)}
            onChange={(choice) => set({ rir: choice === 'unknown' ? null : Number(choice) })}
            options={rirOptions}
          />
        </div>
      ) : null}
      {input.kind !== 'none' && estimate ? (
        estimate.value ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              <Trans>
                Estimated 1-rep max:{' '}
                {formatMass(displayMass({ value: estimate.value.e1rmKg, unit: 'kg' }, unit), unit)}
              </Trans>
            </p>
            {estimate.value.old ? (
              <Callout tone="info">
                <Trans>
                  You lifted this max a while ago. POWR starts from it and refines it automatically
                  from the sets you log.
                </Trans>
              </Callout>
            ) : null}
            <div>
              <WhyButton why={estimate.why} subject={t`the estimate for ${name}`} />
            </div>
          </div>
        ) : (
          <p className="text-fg-muted">
            <WhyText why={estimate.why} />
          </p>
        )
      ) : null}
    </section>
  );
}
