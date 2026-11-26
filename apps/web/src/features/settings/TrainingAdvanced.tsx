import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { setTrainingParameter, TrainingParameters } from '@powr/application/settings';
import type { ProgressionModel } from '@powr/domain/rules';

import { Button } from '#ui/button';
import { Segmented } from '#ui/segmented';

import { useSettingsUseCases } from '../../hooks/use-settings';
import { assertNever } from '../exhaustive';

type Model = 'linear' | 'rpe' | 'doubleProgression';
type Equation = 'wathan' | 'epley' | 'brzycki';
const WEEKS = ['3', '4', '5', '6', '7', '8'] as const;

/**
 * SET-05 (M5s) advanced: the default progression for main lifts and for assistance exercises,
 * the estimated 1-rep max formula and how often a lighter week comes. Registry values the user
 * may override (§8.6.3), each with its evidence default and a way back to it.
 */
export function TrainingAdvanced() {
  const { t } = useLingui();
  const run = useSettingsUseCases();
  const [values, setValues] = useState<TrainingParameters | null>(null);
  const reload = useCallback(
    () => run((settings, deps) => settings.trainingParameters(deps)).then(setValues),
    [run],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  const modelName = useModelName();
  const equationName = useEquationName();
  if (!values) return null;

  const set = (input: Parameters<typeof setTrainingParameter>[1]) =>
    void run((settings, deps) => settings.setTrainingParameter(deps, input)).then(reload);
  const models = (['linear', 'rpe', 'doubleProgression'] as const).map((value) => ({
    value,
    label: modelName(value),
  }));
  const weeks = values.deloadEveryWeeks;

  return (
    <details className="rounded-xl bg-surface-raised p-3" data-testid="training-advanced">
      <summary className="min-h-target-min cursor-pointer font-semibold">
        <Trans>Advanced: progression, formula, lighter weeks</Trans>
      </summary>
      <div className="flex flex-col gap-4 pt-3">
        <p className="text-sm text-fg-muted">
          <Trans>
            Progression and lighter weeks apply to new plans and the next block; your current plan
            keeps its prescriptions. The formula applies to every estimate from now on.
          </Trans>
        </p>
        <Choice
          label={t`Main lifts progress by`}
          own={values.mainLift.own}
          evidenceDefault={modelName(values.mainLift.evidenceDefault)}
          onReset={() => set({ choice: 'mainLift', value: null })}
        >
          <Segmented<Model>
            label={t`Main lifts progress by`}
            value={offered(values.mainLift.value)}
            onChange={(value) => set({ choice: 'mainLift', value })}
            options={models}
          />
        </Choice>
        <Choice
          label={t`Assistance exercises progress by`}
          own={values.accessory.own}
          evidenceDefault={modelName(values.accessory.evidenceDefault)}
          onReset={() => set({ choice: 'accessory', value: null })}
        >
          <Segmented<Model>
            label={t`Assistance exercises progress by`}
            value={offered(values.accessory.value)}
            onChange={(value) => set({ choice: 'accessory', value })}
            options={models}
          />
        </Choice>
        <Choice
          label={t`Estimated 1-rep max formula`}
          own={values.equation.own}
          evidenceDefault={equationName(values.equation.evidenceDefault)}
          onReset={() => set({ choice: 'equation', value: null })}
        >
          <Segmented<Equation>
            label={t`Estimated 1-rep max formula`}
            value={values.equation.value === 'rts' ? null : values.equation.value}
            onChange={(value) => set({ choice: 'equation', value })}
            options={(['wathan', 'epley', 'brzycki'] as const).map((value) => ({
              value,
              label: equationName(value),
            }))}
          />
        </Choice>
        <Choice
          label={t`A lighter week after every`}
          own={weeks.own}
          evidenceDefault={t`${weeks.evidenceDefault} weeks`}
          onReset={() => set({ choice: 'deloadWeeks', value: null })}
        >
          <Segmented<(typeof WEEKS)[number]>
            label={t`A lighter week after every`}
            value={String(weeks.value) as (typeof WEEKS)[number]}
            onChange={(value) => set({ choice: 'deloadWeeks', value: Number(value) })}
            options={WEEKS.map((value) => ({ value, label: t`${value} weeks` }))}
          />
        </Choice>
      </div>
    </details>
  );
}

function Choice({
  label,
  own,
  evidenceDefault,
  onReset,
  children,
}: {
  label: string;
  own: boolean;
  evidenceDefault: string;
  onReset: () => void;
  children: ReactNode;
}) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden="true" className="px-2 font-medium">
        {label}
      </span>
      {children}
      <p className="px-2 text-sm text-fg-muted">
        {own ? (
          <Trans>Your setting. Evidence default: {evidenceDefault}.</Trans>
        ) : (
          <Trans>Evidence default: {evidenceDefault}.</Trans>
        )}
      </p>
      {own ? (
        <Button onClick={onReset} aria-label={t`Use the evidence default: ${label}`}>
          <Trans>Use the evidence default</Trans>
        </Button>
      ) : null}
    </div>
  );
}

function offered(model: ProgressionModel): Model | null {
  return model === 'apre' ? null : model;
}

function useModelName() {
  const { t } = useLingui();
  return (model: ProgressionModel): string => {
    switch (model) {
      case 'linear':
        return t`Fixed steps`;
      case 'rpe':
        return t`Effort (RPE)`;
      case 'doubleProgression':
        return t`Reps, then weight`;
      case 'apre':
        return t`Adjusted by sets of six (APRE)`;
      default:
        return assertNever(model);
    }
  };
}

function useEquationName() {
  const { t } = useLingui();
  return (equation: string): string => {
    switch (equation) {
      case 'wathan':
        return t`Wathan`;
      case 'epley':
        return t`Epley`;
      case 'brzycki':
        return t`Brzycki`;
      default:
        // The commonly circulated decimal chart, not Tuchscherer's own (T-01, load.curve.rts).
        return t`RPE chart (common RTS version)`;
    }
  };
}
