import { PROGRESSION_MODELS, type E1RM_EQUATIONS, type ProgressionModel } from '@powr/domain/rules';
import type { SettingsRecord } from '@powr/formats';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { changeSettings } from './preferences';
import { restContext } from './rest';

/**
 * SET-05 (M5s): the advanced training choices that are registry values the user may override
 * (§8.6.3): the main-lift and accessory progression, the e1RM equation and how often a lighter
 * week comes. They apply to new plans and blocks (the plan keeps its prescriptions) and, for the
 * equation, to every estimate from now on.
 */
const TRAINING_PARAMS = {
  mainLift: 'progression.model.mainLift',
  accessory: 'progression.model.accessory',
  equation: 'load.e1rm.equation',
  deloadWeeks: 'deload.planned.everyWeeks',
} as const;
export type TrainingChoice = keyof typeof TRAINING_PARAMS;

/** The models Settings offers (APRE stays a template choice). */
export const OFFERED_MODELS = [
  'linear',
  'rpe',
  'doubleProgression',
] as const satisfies readonly ProgressionModel[];
/** RTS is a chart from a secondary source; the three rep-max equations are offered. */
export const OFFERED_EQUATIONS = ['wathan', 'epley', 'brzycki'] as const;

export interface TrainingParameters {
  /** The main-lift model for the user's level (an override sets it for every level). */
  readonly mainLift: TrainingParameter<ProgressionModel>;
  readonly accessory: TrainingParameter<ProgressionModel>;
  readonly equation: TrainingParameter<(typeof E1RM_EQUATIONS)[number]>;
  readonly deloadEveryWeeks: TrainingParameter<number> & {
    readonly min: number;
    readonly max: number;
  };
}

export interface TrainingParameter<V> {
  readonly value: V;
  readonly evidenceDefault: V;
  readonly own: boolean;
}

/** SET-05: the four values with their evidence defaults for the user's style and level. */
export async function trainingParameters(deps: Deps): Promise<TrainingParameters> {
  const context = await restContext(deps);
  const settings = await deps.uow.read(['settings'], (repos) => repos.settings.get());
  const global = (settings?.overrides ?? []).filter((entry) => entry.exerciseId === undefined);
  const { rules } = await deps.rules.resolve(context, global);
  const level = context.level ?? 'intermediate';
  const main = rules['progression.model.mainLift'];
  const mainDefault = main.meta.defaultValue as typeof main.value;
  const accessory = rules['progression.model.accessory'];
  const equation = rules['load.e1rm.equation'];
  const deload = rules['deload.planned.everyWeeks'];
  return {
    mainLift: {
      value: main.value[level],
      evidenceDefault: mainDefault[level],
      own: main.meta.origin === 'user',
    },
    accessory: {
      value: accessory.value,
      evidenceDefault: accessory.meta.defaultValue as ProgressionModel,
      own: accessory.meta.origin === 'user',
    },
    equation: {
      value: equation.value,
      evidenceDefault: equation.meta.defaultValue as (typeof E1RM_EQUATIONS)[number],
      own: equation.meta.origin === 'user',
    },
    deloadEveryWeeks: {
      value: deload.value,
      evidenceDefault: deload.meta.defaultValue as number,
      own: deload.meta.origin === 'user',
      min: 3,
      max: 8,
    },
  };
}

export type TrainingParameterError = { readonly kind: 'invalidValue' };

/**
 * SET-05: sets one of the four values, or with `null` goes back to the evidence default. A main
 * lift model applies to every level. Values are checked against what Settings offers.
 */
export async function setTrainingParameter(
  deps: Deps,
  input:
    | { readonly choice: 'mainLift'; readonly value: ProgressionModel | null }
    | { readonly choice: 'accessory'; readonly value: ProgressionModel | null }
    | { readonly choice: 'equation'; readonly value: string | null }
    | { readonly choice: 'deloadWeeks'; readonly value: number | null },
): Promise<Result<void, TrainingParameterError>> {
  const paramId = TRAINING_PARAMS[input.choice];
  const value = storedValue(input.choice, input.value);
  if (value === undefined) return err({ kind: 'invalidValue' });
  await changeSettings(deps, (settings) => {
    const others = (settings.overrides ?? []).filter(
      (entry) => !(entry.paramId === paramId && entry.exerciseId === undefined),
    );
    const next: NonNullable<SettingsRecord['overrides']> =
      value === null ? others : [...others, { paramId, value }];
    return { ...settings, overrides: next };
  });
  return ok(undefined);
}

type OverrideValue = NonNullable<SettingsRecord['overrides']>[number]['value'];

/** The value to store (null: remove the override), or undefined when it is not allowed. */
function storedValue(choice: TrainingChoice, value: unknown): OverrideValue | null | undefined {
  if (value === null) return null;
  switch (choice) {
    case 'mainLift':
      return isModel(value) ? { novice: value, intermediate: value, advanced: value } : undefined;
    case 'accessory':
      return isModel(value) ? value : undefined;
    case 'equation':
      return typeof value === 'string' && (OFFERED_EQUATIONS as readonly string[]).includes(value)
        ? value
        : undefined;
    case 'deloadWeeks':
      return Number.isInteger(value) && (value as number) >= 3 && (value as number) <= 8
        ? (value as number)
        : undefined;
    default:
      return undefined;
  }
}

function isModel(value: unknown): value is ProgressionModel {
  return (
    typeof value === 'string' &&
    (OFFERED_MODELS as readonly string[]).includes(value) &&
    (PROGRESSION_MODELS as readonly string[]).includes(value)
  );
}
