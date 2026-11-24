import {
  SET_LIMITS,
  isLocalDate,
  toKg,
  type Baseline,
  type ExerciseId,
  type LocalDate,
  type MassUnit,
} from '@powr/domain';

import { parseNumber } from '../equipment/inventory';
import type { BaselineInput, Draft } from './answers';

/*
 * ONB-08 baselines step: what the user typed per lift (`Draft.baselineInputs`) and the stored
 * entries it gives (`Draft.baselines`, the use cases' input). Only complete entries are stored;
 * an unfinished one is pointed out on Continue (WCAG 3.3.1).
 */

/** Reps the step accepts for a recent set: the e1RM estimate only covers sets close to a max. */
export const MAX_BASELINE_REPS = 30;

const EMPTY: BaselineInput = { kind: 'none', load: '', reps: '', rir: 2, date: '' };

/** The input of one lift: as typed, else from a stored baseline (re-planning), else empty. */
export function baselineInput(draft: Draft, exerciseId: ExerciseId): BaselineInput {
  const typed = draft.baselineInputs?.[exerciseId];
  if (typed) return typed;
  const stored = draft.baselines?.find((baseline) => baseline.exerciseId === exerciseId);
  if (!stored) return EMPTY;
  return {
    kind: stored.kind,
    load: String(stored.load.value),
    reps: stored.kind === 'recentSet' ? String(stored.reps) : '',
    rir: stored.kind === 'recentSet' ? stored.rir : 2,
    date: stored.date ?? '',
  };
}

export type BaselineProblem = 'load' | 'reps' | 'date';

/** A complete entry, or what is missing or out of range; null for "not now". */
function parseBaseline(
  exerciseId: ExerciseId,
  input: BaselineInput,
  unit: MassUnit,
  today: LocalDate,
): { readonly baseline: Baseline | null; readonly problems: readonly BaselineProblem[] } {
  if (input.kind === 'none') return { baseline: null, problems: [] };
  const problems: BaselineProblem[] = [];
  const load = parseNumber(input.load);
  if (load === null || !(load > 0) || toKg({ value: load, unit }) > SET_LIMITS.loadMaxKg)
    problems.push('load');
  const reps = input.kind === 'oneRepMax' ? 1 : parseNumber(input.reps);
  if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > MAX_BASELINE_REPS)
    problems.push('reps');
  const date = input.kind === 'oneRepMax' ? input.date.trim() : '';
  if (date !== '' && (!isLocalDate(date) || date > today)) problems.push('date');
  if (problems.length > 0 || load === null || reps === null) return { baseline: null, problems };
  return {
    baseline: {
      exerciseId,
      kind: input.kind,
      load: { value: load, unit },
      reps,
      rir: input.kind === 'oneRepMax' ? 0 : input.rir,
      ...(date !== '' ? { date: date as LocalDate } : {}),
    },
    problems,
  };
}

/**
 * The draft after a change of one lift's input: the inputs as typed, and the stored entries with
 * this lift's complete entry (or none). Entries of lifts the step does not show stay as they are.
 */
export function withBaselineInput(
  draft: Draft,
  exerciseId: ExerciseId,
  input: BaselineInput,
  unit: MassUnit,
  today: LocalDate,
): Pick<Draft, 'baselines' | 'baselineInputs'> {
  const { baseline } = parseBaseline(exerciseId, input, unit, today);
  const others = (draft.baselines ?? []).filter((entry) => entry.exerciseId !== exerciseId);
  return {
    baselineInputs: { ...draft.baselineInputs, [exerciseId]: input },
    baselines: baseline ? [...others, baseline] : others,
  };
}

/** The lifts whose input is started but not complete (Continue points to them). */
export function unfinishedBaselines(
  draft: Draft,
  unit: MassUnit,
  today: LocalDate,
): { readonly exerciseId: ExerciseId; readonly problems: readonly BaselineProblem[] }[] {
  return Object.entries(draft.baselineInputs ?? {}).flatMap(([id, input]) => {
    const { problems } = parseBaseline(id as ExerciseId, input, unit, today);
    return problems.length > 0 ? [{ exerciseId: id as ExerciseId, problems }] : [];
  });
}
