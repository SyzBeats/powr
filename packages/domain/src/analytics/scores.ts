/**
 * The powerlifting score board (ANL-07): current and best IPF GL, DOTS, IPF Points, Wilks,
 * Wilks2020 and the allometric index for the competition-lift total and each lift, from the
 * current e1RMs or the best tested loads (user choice), with the bodyweight trend on the day.
 * Every formula carries its version and its registry provenance (sources, `verified`), so the UI
 * can show where the coefficients come from. The formulas are `@powr/domain/scoring`, implemented
 * from the official IPF documents and the published coefficients; OPL values are test vectors only.
 * Squat-only and deadlift-only IPF and GL scores do not exist; Wilks and DOTS for a single lift
 * are "informal".
 */
import { paramsUsed, type Explanation, type ParamRef } from '../explain';
import type { ExerciseId, LocalDate, SourceId } from '../ids';
import type { CompetitionLift } from '../model';
import { SCORE_FORMULAS, type ScoreFormula, type SexReference } from '../rules';
import { score, type Division, type ScoringRules } from '../scoring';

/** The formula and coefficient set each score uses (shown next to the value). */
export const SCORE_FORMULA_VERSIONS: Readonly<Record<ScoreFormula, string>> = {
  ipfGl: 'ipf-gl-2020',
  dots: 'dots-2019',
  ipfPoints: 'ipf-points-2019',
  wilks: 'wilks-original',
  wilks2020: 'wilks-2020',
  allometric: 'allometric-0.67',
};

/** ANL-07: Wilks and Wilks2020 are shown as legacy. */
export const LEGACY_FORMULAS: readonly ScoreFormula[] = ['wilks', 'wilks2020'];

export type ScoreSource = 'e1rm' | 'tested';

export interface LiftValue {
  readonly lift: CompetitionLift;
  /** The exercise the value comes from (the best of the lift's competition exercises). */
  readonly exerciseId: ExerciseId | null;
  readonly kg: number | null;
}

/** A dated total for the best score and the points history (ANL-07 "points history chart"). */
export interface DatedTotal {
  readonly localDate: LocalDate;
  readonly bodyweightKg: number;
  readonly lifts: Readonly<Record<CompetitionLift, number | null>>;
}

export interface ScoreBoardInput {
  readonly sex: SexReference | null;
  readonly division: Division;
  readonly source: ScoreSource;
  /** Bodyweight trend today (BOD-02). */
  readonly bodyweightKg: number | null;
  readonly lifts: readonly LiftValue[];
  /** The totals over time (complete or not), oldest first. */
  readonly history: readonly DatedTotal[];
}

export interface FormulaScore {
  readonly formula: ScoreFormula;
  readonly version: string;
  readonly legacy: boolean;
  /** The current total's score; null when the total or the inputs are missing. */
  readonly total: number | null;
  readonly best: {
    readonly value: number;
    readonly localDate: LocalDate;
    readonly totalKg: number;
    readonly bodyweightKg: number;
  } | null;
  /** Per lift; null where the formula has no single-lift form (IPF/GL squat and deadlift). */
  readonly lifts: readonly {
    readonly lift: CompetitionLift;
    readonly value: number | null;
    readonly informal: boolean;
  }[];
  /** Registry provenance of the coefficients and clamps (LEG-05). */
  readonly sources: readonly SourceId[];
  readonly verified: boolean;
  readonly params: readonly ParamRef[];
  readonly why: Explanation | null;
}

export interface ScoreBoard {
  readonly available: boolean;
  readonly missing: readonly ('sex' | 'bodyweight' | 'lifts')[];
  readonly source: ScoreSource;
  readonly division: Division;
  readonly bodyweightKg: number | null;
  /** The total of the three lifts; null until all three have a value. */
  readonly totalKg: number | null;
  readonly lifts: readonly LiftValue[];
  readonly formulas: readonly FormulaScore[];
  /** ANL-07 points history: complete totals over time with every formula's score. */
  readonly history: readonly {
    readonly localDate: LocalDate;
    readonly totalKg: number;
    readonly bodyweightKg: number;
    readonly scores: Readonly<Record<ScoreFormula, number | null>>;
  }[];
}

const LIFTS: readonly CompetitionLift[] = ['squat', 'bench', 'deadlift'];

export function scoreBoard(input: ScoreBoardInput, rules: ScoringRules): ScoreBoard {
  const byLift = new Map(input.lifts.map((entry) => [entry.lift, entry]));
  const values = LIFTS.map((lift) => byLift.get(lift)?.kg ?? null);
  const totalKg = values.every((value) => value !== null && value > 0)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const missing: ('sex' | 'bodyweight' | 'lifts')[] = [];
  if (input.sex === null) missing.push('sex');
  if (input.bodyweightKg === null) missing.push('bodyweight');
  if (values.every((value) => value === null)) missing.push('lifts');
  const sex = input.sex;
  const bodyweight = input.bodyweightKg;

  const history =
    sex === null
      ? []
      : input.history.flatMap((point) => {
          const lifts = LIFTS.map((lift) => point.lifts[lift]);
          if (lifts.some((value) => value === null || value <= 0)) return [];
          const total = lifts.reduce<number>((sum, value) => sum + (value ?? 0), 0);
          return [
            {
              localDate: point.localDate,
              totalKg: total,
              bodyweightKg: point.bodyweightKg,
              scores: Object.fromEntries(
                SCORE_FORMULAS.map((formula) => [
                  formula,
                  score(
                    formula,
                    {
                      sex,
                      bodyweightKg: point.bodyweightKg,
                      liftedKg: total,
                      division: input.division,
                      lift: 'total',
                    },
                    rules,
                  ).value,
                ]),
              ) as Record<ScoreFormula, number | null>,
            },
          ];
        });

  const formulas = SCORE_FORMULAS.map((formula): FormulaScore => {
    const current =
      sex !== null && bodyweight !== null && totalKg !== null
        ? score(
            formula,
            {
              sex,
              bodyweightKg: bodyweight,
              liftedKg: totalKg,
              division: input.division,
              lift: 'total',
            },
            rules,
          )
        : null;
    let best: FormulaScore['best'] = null;
    for (const point of history) {
      const value = point.scores[formula];
      if (value !== null && (best === null || value > best.value)) {
        best = {
          value,
          localDate: point.localDate,
          totalKg: point.totalKg,
          bodyweightKg: point.bodyweightKg,
        };
      }
    }
    const lifts = LIFTS.map((lift) => {
      const kg = byLift.get(lift)?.kg ?? null;
      const value =
        sex !== null && bodyweight !== null && kg !== null && kg > 0
          ? score(
              formula,
              { sex, bodyweightKg: bodyweight, liftedKg: kg, division: input.division, lift },
              rules,
            ).value
          : null;
      return {
        lift,
        value,
        informal:
          (formula === 'wilks' || formula === 'wilks2020' || formula === 'dots') &&
          lift !== 'bench',
      };
    });
    const params = provenance(formula, rules);
    return {
      formula,
      version: SCORE_FORMULA_VERSIONS[formula],
      legacy: LEGACY_FORMULAS.includes(formula),
      total: current?.value ?? null,
      best,
      lifts,
      sources: [...new Set(params.flatMap((param) => param.sources))],
      verified: params.every((param) => param.verified),
      params,
      why: current?.why ?? null,
    };
  });

  return {
    available: missing.length === 0 && totalKg !== null,
    missing,
    source: input.source,
    division: input.division,
    bodyweightKg: bodyweight,
    totalKg,
    lifts: LIFTS.map((lift) => byLift.get(lift) ?? { lift, exerciseId: null, kg: null }),
    formulas,
    history,
  };
}

/** The registry parameters behind a formula (its coefficients and bodyweight limits). */
function provenance(formula: ScoreFormula, rules: ScoringRules): readonly ParamRef[] {
  const why = score(
    formula,
    { sex: 'male', bodyweightKg: 80, liftedKg: 100, division: 'classic', lift: 'total' },
    rules,
  ).why;
  return paramsUsed(why);
}
