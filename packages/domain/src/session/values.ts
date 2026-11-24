import type { ExerciseId } from '../ids';
/**
 * Set values as the user enters them (WKT-03, WKT-11): range checks with stable issue codes,
 * the plausibility check that asks before storing, and the record fields of a set.
 */
import { SET_LIMITS, validateSetValues, type LoggedSet } from '../model';
import { toKg } from '../units';
import { currentE1rm } from './history';
import type { PlausibilityIssue, SessionContext, SetInput } from './types';

export const NOTE_MAX = 2000;
/** WKT-03: entries above this many times the current e1RM, or this many reps, ask first. */
export const PLAUSIBILITY = { maxE1rmFactor: 3, maxReps: 100 } as const;

/** WKT-03 value checks, as stable issue codes. */
export function inputIssues(values: Partial<SetInput>): string[] {
  const issues = validateSetValues({
    load: values.load ?? null,
    reps: values.reps ?? null,
    rir: values.rir ?? null,
  }).map((issue) => `${issue.field}.${issue.kind}`);
  for (const side of ['repsLeft', 'repsRight'] as const) {
    const reps = values[side];
    if (reps !== undefined && (!Number.isInteger(reps) || reps < 0 || reps > SET_LIMITS.repsMax))
      issues.push(`${side}.outOfRange`);
  }
  if (
    values.durationMs !== undefined &&
    (!Number.isInteger(values.durationMs) ||
      values.durationMs < 0 ||
      values.durationMs > 86_400_000)
  ) {
    issues.push('durationMs.outOfRange');
  }
  const units = values.technique?.units;
  if (units !== undefined && (!Number.isInteger(units) || units < 0 || units > 20))
    issues.push('technique.outOfRange');
  if ((values.note?.length ?? 0) > NOTE_MAX) issues.push('note.tooLong');
  return issues;
}

/** WKT-03: implausible entries ask for confirmation. */
export function plausibilityIssues(
  values: Pick<SetInput, 'load' | 'reps'>,
  exerciseId: ExerciseId,
  ctx: SessionContext,
): PlausibilityIssue[] {
  const issues: PlausibilityIssue[] = [];
  if (values.reps !== null && values.reps > PLAUSIBILITY.maxReps) {
    issues.push({ kind: 'manyReps', reps: values.reps });
  }
  const e1rm = currentE1rm(ctx.history(exerciseId));
  if (values.load && e1rm !== null && toKg(values.load) > PLAUSIBILITY.maxE1rmFactor * e1rm) {
    issues.push({ kind: 'loadAboveE1rm', factor: toKg(values.load) / e1rm, e1rmKg: e1rm });
  }
  return issues;
}

function effortOf(values: Pick<SetInput, 'rir' | 'openEnded'>): LoggedSet['effort'] {
  if (values.rir === null) return { rir: null, source: 'none' };
  return values.openEnded
    ? { rir: values.rir, source: 'entered', openEnded: true }
    : { rir: values.rir, source: 'entered' };
}

/** The values of a set record from an input (WKT-11: per-side reps give the weaker side). */
export function setFields(values: SetInput, perSide: boolean) {
  const sides =
    perSide && values.repsLeft !== undefined && values.repsRight !== undefined
      ? { repsLeft: values.repsLeft, repsRight: values.repsRight }
      : {};
  const reps =
    values.reps ??
    (sides.repsLeft !== undefined ? Math.min(sides.repsLeft, sides.repsRight) : null);
  return {
    load: values.load,
    reps,
    effort: effortOf(values),
    ...sides,
    ...(values.durationMs === undefined ? {} : { durationMs: values.durationMs }),
    ...(values.technique ? { technique: values.technique } : {}),
    ...(values.flags && Object.values(values.flags).some(Boolean) ? { flags: values.flags } : {}),
    ...(values.note?.trim() ? { note: values.note.trim() } : {}),
  };
}
