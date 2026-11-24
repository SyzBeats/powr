/**
 * `@powr/domain/deload`: planned deloads, reactive deload triggers and returning from breaks
 * (PRG-11…13; EB §Progression › Deloads, › Breaks; §Defaults › Deloads). All magnitudes are
 * registry presets synthesised from surveys and Delphi data, not trials (EB §Gaps #9); every
 * result explains which preset it used.
 */
import { explain, explained, type Explained, type Explanation, type RuleId } from '../explain';
import type { ExerciseId } from '../ids';
import type { AdjustmentNote, PlanSlot, Prescription, RirRange, SessionAdjustment } from '../model';
import { setsOf, withSets } from '../planning/analysis';
import type { Param, Range, ReturnFromBreakRow, RuleSlice } from '../rules';

export type DeloadRules = RuleSlice<'deload.content'>;

const mid = (range: Range) => (range.min + range.max) / 2;

/** Adds `add` RIR to every effort target of a prescription (RIR ≤ 10). */
export function addRir(prescription: Prescription, add: number): Prescription {
  if (add === 0) return prescription;
  const shift = (rir: RirRange): RirRange => [
    Math.min(10, rir[0] + add),
    Math.min(10, rir[1] + add),
  ];
  switch (prescription.mode) {
    case 'doubleProgression':
    case 'rpe':
      return { ...prescription, rir: shift(prescription.rir) };
    case 'topBackoff':
      return {
        ...prescription,
        top: { ...prescription.top, rir: shift(prescription.top.rir) },
        backoff: { ...prescription.backoff, rir: shift(prescription.backoff.rir) },
      };
    case 'technique':
      return { ...prescription, base: { ...prescription.base, rir: shift(prescription.base.rir) } };
    default:
      return prescription;
  }
}

/**
 * PRG-11 deload week: same exercises and frequency, sets cut by the midpoint of 40–60%, target
 * RIR raised by 2 (the low end of +2–3), load held at 85–100%, or 80–90% for higher-rep
 * (hypertrophy) work; accessories stay, marked optional to drop. Never complete rest.
 */
export function deloadSlots(
  slots: readonly PlanSlot[],
  rules: DeloadRules,
): Explained<{ readonly slots: readonly PlanSlot[]; readonly adjustment: SessionAdjustment }> {
  const param = rules['deload.content'];
  const content = param.value;
  const keepShare = 1 - mid(content.setsReductionPct) / 100;
  const rirAdd = content.rirIncrease.min;
  const higherRep: Range = {
    min: 100 - content.higherRepLoadReductionPct.max,
    max: 100 - content.higherRepLoadReductionPct.min,
  };
  const kept = slots.filter(
    (slot) => content.dropAccessories !== 'always' || slot.priority === 'primary',
  );
  const adjusted = kept.map((slot) => ({
    ...slot,
    prescription: addRir(
      withSets(slot.prescription, Math.max(1, Math.round(setsOf(slot.prescription) * keepShare))),
      rirAdd,
    ),
    loadPct: slot.goal === 'hypertrophy' ? higherRep : content.loadPct,
  }));
  const notes: AdjustmentNote[] =
    content.dropAccessories === 'optional' ? ['accessoriesOptional'] : [];
  return explained(
    {
      slots: adjusted,
      adjustment: {
        kind: 'deload',
        setsPct: {
          min: 100 - content.setsReductionPct.max,
          max: 100 - content.setsReductionPct.min,
        },
        rirAdd,
        loadPct: content.loadPct,
        notes,
      },
    },
    'deload.week',
    { args: { keepSharePct: Math.round(keepShare * 100), rirAdd }, params: [param] },
  );
}

export type ReactiveRules = RuleSlice<'deload.reactive'>;

/** Inputs of the reactive trigger (PRG-12); readiness and pain arrive with M3 and v1.3. */
export interface ReactiveSignals {
  /** Session e1RMs of each main lift in time order (or reps at a fixed load). */
  readonly mainLifts: readonly {
    readonly exerciseId: ExerciseId;
    readonly values: readonly number[];
  }[];
  /** Consecutive days in the "low" readiness range (RDY-02). */
  readonly lowReadinessDays: number;
  /** Pain flags on the same region (RDY-04). */
  readonly painFlags: number;
}

export type ReactiveSignal = 'performanceDecline' | 'lowReadiness' | 'pain';

/**
 * PRG-12: proposes bringing the scheduled deload forward when any two different signals occur
 * (e1RM or reps declining for ≥ 2 consecutive sessions on a main lift; readiness low for ≥ 3
 * days; pain flags). It never adds a deload on top of a scheduled one: the caller only asks
 * while the deload is more than a week away.
 */
export function reactiveDeload(
  signals: ReactiveSignals,
  rules: ReactiveRules,
): Explained<{ readonly propose: boolean; readonly signals: readonly ReactiveSignal[] }> {
  const param = rules['deload.reactive'];
  const found: ReactiveSignal[] = [];
  const declining = signals.mainLifts.filter(
    (lift) => declineStreak(lift.values) >= param.value.declineSessions,
  );
  if (declining.length > 0) found.push('performanceDecline');
  if (signals.lowReadinessDays >= param.value.lowReadinessDays) found.push('lowReadiness');
  if (signals.painFlags > 0) found.push('pain');
  const propose = found.length >= param.value.signalsRequired;
  return explained(
    { propose, signals: found },
    propose ? 'deload.reactive.propose' : 'deload.reactive.none',
    {
      args: {
        signals: found.join(','),
        declining: declining.map((lift) => lift.exerciseId).join(','),
        required: param.value.signalsRequired,
      },
      params: [param],
    },
  );
}

/** Consecutive sessions, counted back from the latest, each lower than the one before. */
export function declineStreak(values: readonly number[]): number {
  let streak = 0;
  for (let index = values.length - 1; index > 0 && values[index]! < values[index - 1]!; index--)
    streak++;
  return streak;
}

export type ReturnRules = RuleSlice<
  | 'deload.returnFromBreak'
  | 'deload.returnFromBreak.sorenessNoteAfterDays'
  | 'progression.calibration'
>;

/** One week of a return-from-break ramp (PRG-13). */
export interface ReturnStep {
  /** 1 = the first week back. */
  readonly week: number;
  readonly loadPct: Range | null;
  readonly setsPct: Range | null;
  readonly rirAdd: number;
  /** RIR targets replaced by the calibration target (PRG-08), for a rebuild after > 2 months. */
  readonly calibrationRir: RirRange | null;
  readonly notes: readonly AdjustmentNote[];
}

/**
 * PRG-13 (EB §Progression › Breaks): the row for the days off, then a ramp back to 100% over the
 * row's longer ramp (the cautious end): ≤ 7 days resume (first top set autoregulated); 8–14 days
 * 90–95% load and +1 RIR; 15–28 days 85–90% load and 60–70% of the sets; 5–8 weeks 75–85% load
 * and 50% volume over 3–4 weeks; longer: rebuild e1RMs by calibration (PRG-08). After > 10 days
 * off, expect extra soreness in the first sessions.
 */
export function returnFromBreak(
  daysOff: number,
  rules: ReturnRules,
): Explained<{
  readonly action: ReturnFromBreakRow['action'];
  readonly steps: readonly ReturnStep[];
}> {
  const table = rules['deload.returnFromBreak'];
  const soreness = rules['deload.returnFromBreak.sorenessNoteAfterDays'];
  const row =
    table.value.find((candidate) => candidate.maxDays === null || daysOff <= candidate.maxDays) ??
    table.value.at(-1)!;
  const sore: AdjustmentNote[] = daysOff > soreness.value ? ['expectSoreness'] : [];
  const params: Param<unknown>[] = [table, soreness];
  let steps: ReturnStep[];
  if (row.action === 'resume') {
    steps = [
      {
        week: 1,
        loadPct: null,
        setsPct: null,
        rirAdd: 0,
        calibrationRir: null,
        notes: ['autoregulateTopSet', ...sore],
      },
    ];
  } else if (row.action === 'recalibrate') {
    const calibration = rules['progression.calibration'];
    params.push(calibration);
    steps = [
      {
        week: 1,
        loadPct: null,
        setsPct: null,
        rirAdd: 0,
        calibrationRir: [calibration.value.targetRir.min, calibration.value.targetRir.max],
        notes: ['calibrate', ...sore],
      },
    ];
  } else {
    const weeks = Math.max(1, row.rampWeeks?.max ?? 1);
    const ramp = (range: Range | null, week: number): Range | null => {
      if (!range) return null;
      const share = (week - 1) / weeks;
      return {
        min: range.min + (100 - range.min) * share,
        max: range.max + (100 - range.max) * share,
      };
    };
    steps = Array.from({ length: weeks }, (_, index) => ({
      week: index + 1,
      loadPct: ramp(row.loadPct, index + 1),
      setsPct: ramp(row.setsPct, index + 1),
      rirAdd: index === 0 ? row.rirAdd : 0,
      calibrationRir: null,
      notes: index === 0 ? sore : [],
    }));
  }
  return explained({ action: row.action, steps }, RETURN_RULES[row.action], {
    args: { daysOff, action: row.action, weeks: steps.length },
    params,
  });
}

const RETURN_RULES = {
  resume: 'break.return.resume',
  reduce: 'break.return.reduce',
  reentry: 'break.return.reentry',
  recalibrate: 'break.return.recalibrate',
} as const satisfies Record<ReturnFromBreakRow['action'], RuleId>;

/** Applies a return step to a session's slots: fewer sets, easier targets, a load note. */
export function applyReturnStep(
  slots: readonly PlanSlot[],
  step: ReturnStep,
  daysOff: number,
): { readonly slots: readonly PlanSlot[]; readonly adjustment: SessionAdjustment } {
  const share = step.setsPct ? (step.setsPct.min + step.setsPct.max) / 200 : 1;
  const adjusted = slots.map((slot) => {
    let prescription = withSets(
      slot.prescription,
      Math.max(1, Math.round(setsOf(slot.prescription) * share)),
    );
    prescription = step.calibrationRir
      ? withRir(prescription, step.calibrationRir)
      : addRir(prescription, step.rirAdd);
    return { ...slot, prescription, ...(step.loadPct ? { loadPct: step.loadPct } : {}) };
  });
  return {
    slots: adjusted,
    adjustment: {
      kind: step.calibrationRir ? 'recalibrate' : 'returnFromBreak',
      ...(step.loadPct ? { loadPct: step.loadPct } : {}),
      ...(step.setsPct ? { setsPct: step.setsPct } : {}),
      ...(step.rirAdd ? { rirAdd: step.rirAdd } : {}),
      daysOff,
      notes: step.notes,
    },
  };
}

function withRir(prescription: Prescription, rir: RirRange): Prescription {
  switch (prescription.mode) {
    case 'doubleProgression':
    case 'rpe':
      return { ...prescription, rir };
    case 'topBackoff':
      return {
        ...prescription,
        top: { ...prescription.top, rir },
        backoff: { ...prescription.backoff, rir },
      };
    default:
      return prescription;
  }
}

/** The explanation of a stored adjustment, rebuilt for the "Why?" sheet. */
export function explainAdjustment(adjustment: SessionAdjustment): Explanation {
  const rule =
    adjustment.kind === 'deload'
      ? 'deload.week'
      : adjustment.kind === 'recalibrate'
        ? 'break.return.recalibrate'
        : adjustment.kind === 'mergedWork'
          ? 'schedule.missed.merge'
          : 'break.return.reduce';
  return explain(rule, {
    args: {
      loadMin: adjustment.loadPct?.min ?? null,
      loadMax: adjustment.loadPct?.max ?? null,
      setsMin: adjustment.setsPct?.min ?? null,
      setsMax: adjustment.setsPct?.max ?? null,
      rirAdd: adjustment.rirAdd ?? 0,
      daysOff: adjustment.daysOff ?? null,
      notes: adjustment.notes.join(','),
    },
  });
}
