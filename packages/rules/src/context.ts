import type {
  CompetitionLift,
  CurveClass,
  ExerciseId,
  Goal,
  Mechanics,
  MovementPattern,
  RestClass,
  TrainingStyle,
} from '@powr/domain';
import type { SexReference, TraineeLevel } from '@powr/domain/rules';

import type { Condition } from './schema';

/** What the rules are resolved for (§8.6.2): the user's profile and, optionally, one exercise. */
export interface ResolveContext {
  readonly level?: TraineeLevel;
  readonly style?: TrainingStyle;
  readonly goal?: Goal;
  readonly sex?: SexReference;
  /** Time-saver mode of the session (TMR-02). */
  readonly timeSaver?: boolean;
  readonly exercise?: {
    readonly id?: ExerciseId;
    readonly competitionLift?: CompetitionLift;
    readonly restClass?: RestClass;
    readonly pattern?: MovementPattern;
    readonly mechanics?: Mechanics;
    readonly curveClass?: CurveClass;
  };
}

/** Whether a variant's condition holds: every key it names matches the context. */
export function matchesCondition(condition: Condition, context: ResolveContext): boolean {
  const exercise = context.exercise ?? {};
  const actual: Record<keyof Condition, string | boolean | undefined> = {
    level: context.level,
    style: context.style,
    goal: context.goal,
    sex: context.sex,
    timeSaver: context.timeSaver,
    competitionLift: exercise.competitionLift,
    restClass: exercise.restClass,
    pattern: exercise.pattern,
    mechanics: exercise.mechanics,
    curveClass: exercise.curveClass,
  };
  return (Object.keys(condition) as (keyof Condition)[]).every((key) => {
    const expected: unknown = condition[key];
    const value = actual[key];
    if (value === undefined) return false;
    return Array.isArray(expected) ? expected.includes(value) : expected === value;
  });
}
