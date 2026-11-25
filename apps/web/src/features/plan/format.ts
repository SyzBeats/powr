import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import type { PlanSlot, Prescription } from '@powr/domain';
import type { MuscleWeek, PlanFix } from '@powr/domain/planning';

import { formatMass, formatMinutes } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { useEffortWords } from '../settings/effort';

const range = ([min, max]: readonly [number, number]) => (min === max ? `${min}` : `${min}–${max}`);

/**
 * Prescriptions in words (PLN-07): "3 × 8–12, 1–2 reps in reserve". Novices see "reps left"
 * instead of "RIR" (NFR-USE-03); others get "RIR", or "RPE" once they chose it (SET-05).
 */
export function usePrescriptionText(novice: boolean) {
  const { t } = useLingui();
  const effortWords = useEffortWords();
  const effort = (rir: readonly [number, number]) => {
    const value = range(rir);
    if (effortWords.scale === 'rpe') return effortWords.short(rir[0], rir[1]);
    return novice ? t`${value} reps left` : t`RIR ${value}`;
  };
  return (prescription: Prescription): string => {
    switch (prescription.mode) {
      case 'doubleProgression':
      case 'rpe': {
        const { sets } = prescription;
        const reps = range(prescription.repRange);
        const rir = effort(prescription.rir);
        return t`${sets} × ${reps} reps · ${rir}`;
      }
      case 'topBackoff': {
        const topReps = range(prescription.top.repRange);
        const topRir = effort(prescription.top.rir);
        const sets = prescription.backoff.sets;
        const reps = range(prescription.backoff.repRange);
        return t`1 × ${topReps} top set · ${topRir}, then ${sets} × ${reps}`;
      }
      case 'percent': {
        const { sets, pct } = prescription;
        const reps = range(prescription.repRange);
        return t`${sets} × ${reps} reps at ${pct}%`;
      }
      case 'fixed': {
        const { sets, reps } = prescription;
        const load = formatMass(prescription.load.value, prescription.load.unit);
        return t`${sets} × ${reps} at ${load}`;
      }
      case 'amrap':
        return t`1 set, as many reps as possible`;
      case 'timed': {
        const { sets, durationS } = prescription;
        return t`${sets} × ${durationS} s`;
      }
      case 'technique': {
        const sets = prescription.base.sets;
        const reps = range(prescription.base.repRange);
        return t`${sets} × ${reps} reps (technique set)`;
      }
      default:
        return assertNever(prescription);
    }
  };
}

export function useRestText() {
  const { t } = useLingui();
  return (slot: Pick<PlanSlot, 'restSeconds'>): string => {
    const minutes = Math.floor(slot.restSeconds / 60);
    const seconds = String(slot.restSeconds % 60).padStart(2, '0');
    return t`rest ${minutes}:${seconds}`;
  };
}

/** Heat-map step of a muscle's weekly volume: colour token, label and an icon-free number. */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

export function heatStep(week: Pick<MuscleWeek, 'fractional' | 'band'>): HeatStep {
  if (week.fractional <= 0) return 0;
  switch (week.band) {
    case 'belowFloor':
      return 1;
    case 'low':
      return 2;
    case 'default':
      return 3;
    case 'high':
      return 4;
    default:
      return 5;
  }
}

/**
 * Labels of the heat-map steps: the evidence bands of `volume.hypertrophy.weeklyBands` (floor 4,
 * 10–20, high band to 30) in words and numbers, so the colour is never the only signal.
 */
export function useHeatLabel() {
  const { t } = useLingui();
  return (step: HeatStep): string =>
    [t`None`, t`Under 4 sets`, t`4–9 sets`, t`10–20 sets`, t`21–30 sets`, t`Over 30 sets`][step]!;
}

/** What a fix does, in words, for the issue list (PLN-14 "concrete fixes"). */
export function useFixText() {
  const { t } = useLingui();
  const labels = useLabels();
  return (fix: PlanFix, slotName: (dayKey: string, slotKey: string) => string): string => {
    switch (fix.kind) {
      case 'removeSets': {
        const name = slotName(fix.dayKey, fix.slotKey);
        return plural(fix.sets, {
          one: `Remove # set of ${name}`,
          other: `Remove # sets of ${name}`,
        });
      }
      case 'addSets': {
        const name = slotName(fix.dayKey, fix.slotKey);
        return plural(fix.sets, { one: `Add # set of ${name}`, other: `Add # sets of ${name}` });
      }
      case 'removeSlot': {
        const name = slotName(fix.dayKey, fix.slotKey);
        return t`Remove ${name} from this day`;
      }
      case 'swapExercise': {
        const from = slotName(fix.dayKey, fix.slotKey);
        const to = labels.exercise(fix.exerciseId);
        return t`Replace ${from} with ${to}`;
      }
      case 'superset': {
        const first = slotName(fix.dayKey, fix.slotKeys[0]);
        const second = slotName(fix.dayKey, fix.slotKeys[1]);
        return t`Pair ${first} and ${second} as a superset`;
      }
      case 'techniqueSet': {
        const name = slotName(fix.dayKey, fix.slotKey);
        return t`Use a time-saving technique set for ${name}`;
      }
      case 'timeSaverRest':
        return t`Use shorter rests on isolation exercises`;
      case 'sessionMinutes': {
        if (fix.minutes === null) return t`Allow sessions of more than 90 minutes`;
        const minutes = formatMinutes(fix.minutes);
        return t`Allow ${minutes} per session`;
      }
      case 'addDay':
        return t`Add a training day`;
      default:
        return t`Change the plan`;
    }
  };
}

/** Fixes that change the inputs (time, days) rather than the week: they regenerate the plan. */
export function isInputFix(fix: PlanFix): boolean {
  return fix.kind === 'sessionMinutes' || fix.kind === 'addDay';
}
