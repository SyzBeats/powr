import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import type { CompetitionLift, MassUnit, SessionOrigin, SessionStatus } from '@powr/domain';
import type {
  CalendarDay as DomainCalendarDay,
  ChartAnnotation as DomainAnnotation,
  DayState,
  SeriesSummary,
} from '@powr/domain/analytics';
import type { ScoreFormula } from '@powr/domain/rules';
import type { PrType } from '@powr/domain/session';

import type { CalendarDay, CalendarStatus } from '#ui/charts/training-calendar';
import type { ChartAnnotation } from '#ui/charts/trend-chart';

import { formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useSummaryWords } from '../session/past/parts';
import { massFromKg } from '../session/words';

/*
 * Words of the Progress screens (M4b: ANL-02…07). Tone (MOT-10): a drop is a fact with its
 * reliability, never a failure; a change is only called real when the PRG-02 label says so.
 */

const KG_PER_LB = 0.45359237;

/** A value stored in kg in the user's unit, to 0.1 (chart values). */
export function inUnit(valueKg: number, unit: MassUnit): number {
  const value = unit === 'kg' ? valueKg : valueKg / KG_PER_LB;
  return Math.round(value * 10) / 10;
}

export function usePrTypeWords() {
  const { t } = useLingui();
  return (type: PrType): string => {
    switch (type) {
      case 'rep':
        return t`Rep PR`;
      case 'load':
        return t`Heaviest weight`;
      case 'e1rm':
        return t`Estimated 1-rep max (an estimate)`;
      case 'volume':
        return t`Volume record`;
      default:
        return assertNever(type);
    }
  };
}

/** Competition lifts with a capital, for headings and table cells. */
export function useLiftName() {
  const { t } = useLingui();
  return (lift: CompetitionLift): string =>
    lift === 'squat' ? t`Squat` : lift === 'bench' ? t`Bench press` : t`Deadlift`;
}

/** Mesocycles as a thin mark at their start; lighter weeks and breaks as shaded spans. */
export function useAnnotations() {
  const { t } = useLingui();
  return (annotations: readonly DomainAnnotation[]): ChartAnnotation[] =>
    annotations.map((annotation) => {
      switch (annotation.kind) {
        case 'mesocycle': {
          const block = (annotation.index ?? 0) + 1;
          return { from: annotation.from, to: annotation.from, label: t`Block ${block}` };
        }
        case 'deload':
          return { from: annotation.from, to: annotation.to, label: t`Lighter week` };
        case 'break':
          return { from: annotation.from, to: annotation.to, label: t`Break` };
        default:
          return assertNever(annotation.kind);
      }
    });
}

/**
 * ANL-11's one sentence for an e1RM trend: where the smoothed trend went over the shown range and
 * whether the change is real by the PRG-02 label ("Squat estimated 1-rep max: 100 kg → 104 kg over
 * 12 weeks (+4%). Likely a real gain."). Never claims what the label does not claim.
 */
export function useTrendSentence() {
  const { t } = useLingui();
  const words = useSummaryWords();
  return (name: string, summary: SeriesSummary, unit: MassUnit): string => {
    if (summary.fromKg === null || summary.toKg === null || summary.fromDate === null) {
      return t`${name}: not enough workouts with an effort rating in this range for a trend yet.`;
    }
    const from = massFromKg(summary.fromKg, unit, 1);
    const to = massFromKg(summary.toKg, unit, 1);
    const weeks = Math.max(0, Math.round(summary.weeks));
    const span = plural(weeks, { one: '# week', other: '# weeks' });
    const pct = formatSignedPercent(summary.deltaPct ?? 0);
    const label = words.trend(summary);
    return weeks === 0
      ? t`${name}: ${to} estimated 1-rep max. ${label}.`
      : t`${name}: ${from} → ${to} estimated 1-rep max over ${span} (${pct}). ${label}.`;
  };
}

/** "+4.1%", "−2%", "0%". */
export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = formatNumber(Math.abs(rounded), 1);
  return rounded > 0 ? `+${text}%` : rounded < 0 ? `−${text}%` : `${text}%`;
}

/** The most telling state first: what happened, then why a day was quiet, then the plan. */
const DAY_ORDER: readonly CalendarStatus[] = [
  'completed',
  'partial',
  'missed',
  'break',
  'deload',
  'planned',
];

/** The calendar's one status per day (the most telling one) and the others in words. */
export function useCalendarDays() {
  const { t } = useLingui();
  const stateWord = (state: DayState): string => {
    switch (state) {
      case 'completed':
        return t`completed`;
      case 'partial':
        return t`partly done`;
      case 'missed':
        return t`missed`;
      case 'planned':
        return t`planned`;
      case 'deload':
        return t`lighter week`;
      case 'break':
        return t`break`;
      default:
        return assertNever(state);
    }
  };
  return (days: readonly DomainCalendarDay[]): CalendarDay[] =>
    days.flatMap((day) => {
      const status = DAY_ORDER.find((state) => day.states.includes(state));
      if (!status) return [];
      const others = day.states.filter((state) => state !== status).map(stateWord);
      const count = day.sessions.length;
      const parts = [
        ...(count > 1 ? [plural(count, { one: '# workout', other: '# workouts' })] : []),
        ...others,
      ];
      return [{ date: day.date, status, ...(parts.length > 0 ? { label: parts.join(', ') } : {}) }];
    });
}

export function useSessionListWords() {
  const { t } = useLingui();
  const status = (value: SessionStatus): string => {
    switch (value) {
      case 'finished':
        return t`Finished`;
      case 'partial':
        return t`Partly done`;
      case 'active':
        return t`In progress`;
      case 'discarded':
        return t`Discarded`;
      default:
        return assertNever(value);
    }
  };
  const origin = (value: SessionOrigin): string => {
    switch (value) {
      case 'planned':
        return t`From the plan`;
      case 'freestyle':
        return t`Freestyle`;
      case 'repeat':
        return t`Repeated workout`;
      default:
        return assertNever(value);
    }
  };
  return { status, origin };
}

export function useScoreWords() {
  const { t } = useLingui();
  const formula = (value: ScoreFormula): string => {
    switch (value) {
      case 'ipfGl':
        return t`IPF GL Points`;
      case 'dots':
        return t`DOTS`;
      case 'ipfPoints':
        return t`IPF Points`;
      case 'wilks':
        return t`Wilks`;
      case 'wilks2020':
        return t`Wilks2020`;
      case 'allometric':
        return t`Allometric index (kg ÷ bodyweight^0.67)`;
      default:
        return assertNever(value);
    }
  };
  const missing = (value: 'sex' | 'bodyweight' | 'lifts'): string => {
    switch (value) {
      case 'sex':
        return t`The formulas need a reference set (female or male coefficients). Choose one in your profile.`;
      case 'bodyweight':
        return t`The formulas need your bodyweight. Log it once and the trend is used from then on.`;
      case 'lifts':
        return t`No squat, bench press or deadlift logged yet.`;
      default:
        return assertNever(value);
    }
  };
  return { formula, missing };
}
