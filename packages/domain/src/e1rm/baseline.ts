import { explain, explained, type Explained, type Explanation } from '../explain';
import type { LocalDate } from '../ids';
import type { Baseline } from '../model';
import type { RuleSlice } from '../rules';
import { daysBetween } from '../time';
import { displayMass } from '../units';
import { estimateSetE1rm, type E1rmExercise, type E1rmRules, type SetE1rm } from './estimate';

/*
 * ONB-08 baselines: a known 1RM or a recent set of a main lift, entered in onboarding, gives the
 * starting e1RM, so the first session's loads come from PRG-05 (load = e1RM × pct(reps + RIR))
 * instead of the calibration fallback (PRG-08: RIR 3–4 and a load the user picks). The estimate
 * is the same pipeline as a logged set (`estimateSetE1rm`, technical concept §8.7.4): no formula
 * of its own. The entry is raw user data (`Profile.baselines`); the e1RM is derived from it with
 * the current rules whenever it is needed, like every other derived value (§4).
 */

export type BaselineRules = E1rmRules & RuleSlice<'load.baseline.refineAfterDays'>;

export interface BaselineE1rm extends SetE1rm {
  /** A known 1RM dated more than `load.baseline.refineAfterDays` ago (PRD ONB-08 hint). */
  readonly old: boolean;
}

/**
 * The starting e1RM of a baseline. A known 1RM is a single at RIR 0 (effective reps 1, so the
 * e1RM is the load); a recent set uses its reps and RIR, or the unknown-effort prior (E-1) when
 * the user does not know the RIR, at that prior's lower weight. Null, with the engine's reason,
 * when the set cannot give an estimate (too many reps, a load type without an e1RM, no load).
 */
export function baselineE1rm(
  baseline: Baseline,
  exercise: E1rmExercise,
  today: LocalDate,
  rules: BaselineRules,
): Explained<BaselineE1rm | null> {
  const single = baseline.kind === 'oneRepMax';
  const estimate = estimateSetE1rm(
    {
      type: 'working',
      load: baseline.load,
      reps: single ? 1 : baseline.reps,
      effort: single
        ? { rir: 0, source: 'entered' }
        : baseline.rir === null
          ? { rir: null, source: 'none' }
          : { rir: baseline.rir, source: 'entered' },
    },
    exercise,
    {},
    rules,
  );
  if (!estimate.value) return { value: null, why: estimate.why };
  const refineAfter = rules['load.baseline.refineAfterDays'];
  const ageDays = baseline.date === undefined ? null : daysBetween(baseline.date, today);
  const old = single && ageDays !== null && ageDays > refineAfter.value;
  return explained({ ...estimate.value, old }, 'e1rm.baseline', {
    args: {
      kind: baseline.kind,
      // In the unit the user entered (the set's own explanation keeps kg, like a logged set's).
      e1rm: {
        mass: {
          value: displayMass({ value: estimate.value.e1rmKg, unit: 'kg' }, baseline.load.unit),
          unit: baseline.load.unit,
        },
      },
      old,
      ageDays,
    },
    params: single ? [refineAfter] : [],
    children: [estimate.why],
  });
}

/**
 * ONB-08 without a baseline: the calibration fallback the first exposures of an exercise follow
 * (PRG-08): a conservative effort target and a load the user picks, the e1RM from those sets.
 */
export function calibrationFallback(rules: RuleSlice<'progression.calibration'>): Explanation {
  const calibration = rules['progression.calibration'];
  return explain('e1rm.baseline.none', {
    args: {
      exposuresMin: calibration.value.exposures.min,
      exposuresMax: calibration.value.exposures.max,
      rirMin: calibration.value.targetRir.min,
      rirMax: calibration.value.targetRir.max,
    },
    params: [calibration],
  });
}
