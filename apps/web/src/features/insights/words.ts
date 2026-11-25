import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import type { HeatLabel, MuscleWeekRow, TargetStatus } from '@powr/domain/analytics';
import type { WeekState } from '@powr/domain/streaks';

import type { BodyMapMuscle, HeatBand } from '#ui/body-map/heat';

import { formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';

/*
 * Shared words of the insight screens (M4b): heat bands, volume statuses and streak states.
 * Tone (MOT-10): facts and next steps, never blame; a low week is "below your target", not
 * "behind"; a missed week is "not kept", with what keeps the next one.
 */

/** Weekly hard sets, at most one decimal: "12.5 sets". */
export function useSetsText() {
  return (sets: number): string =>
    plural(Math.round(sets * 10) / 10, { one: '# set', other: '# sets' });
}

/** MAP-04 legend and band names (§8.11 heat steps 0–5 against the user's target band). */
export function useHeatBands(): readonly HeatBand[] {
  const { t } = useLingui();
  return [
    { step: 0, label: t`No hard sets` },
    { step: 1, label: t`Under 4 sets, below the floor` },
    { step: 2, label: t`Below your target` },
    { step: 3, label: t`In your target` },
    { step: 4, label: t`Above your target, up to 30 sets` },
    { step: 5, label: t`Over 30 sets, very high` },
  ];
}

export function useVolumeWords() {
  const { t } = useLingui();
  const labels = useLabels();
  const sets = useSetsText();

  const heatLabel = (label: HeatLabel): string => {
    switch (label) {
      case 'none':
        return t`No hard sets`;
      case 'belowFloor':
        return t`Below the floor`;
      case 'belowTarget':
        return t`Below your target`;
      case 'inTarget':
        return t`In your target`;
      case 'high':
        return t`High`;
      case 'veryHigh':
        return t`Very high`;
      default:
        return assertNever(label);
    }
  };

  const status = (value: TargetStatus): string => {
    switch (value) {
      case 'under':
        return t`Below target`;
      case 'in':
        return t`Target met`;
      case 'over':
        return t`Above target`;
      default:
        return assertNever(value);
    }
  };

  /** "10–20 sets" (the target band of a row). */
  const band = (row: Pick<MuscleWeekRow, 'target'>): string => {
    const low = formatNumber(row.target.low, 1);
    const high = formatNumber(row.target.high, 1);
    return t`${low}–${high} sets`;
  };

  /**
   * The body map's and the list's data for volume rows (MAP-04, MAP-06): name, heat step and the
   * value in words, keyed by display-group muscle ID. `scope` completes the value ("this week").
   */
  const bodyMapMuscles = (
    rows: readonly MuscleWeekRow[],
    scope: 'week' | 'lastWeek' | 'avg4' | 'session',
  ): Record<string, BodyMapMuscle> =>
    Object.fromEntries(
      rows.map((row) => {
        const value = sets(row.fractional);
        const valueText =
          scope === 'week'
            ? t`${value} this week`
            : scope === 'lastWeek'
              ? t`${value} last week`
              : scope === 'avg4'
                ? t`${value} a week on average`
                : t`${value} in this workout`;
        return [row.muscle, { name: labels.muscle(row.muscle), step: row.heat, valueText }];
      }),
    );

  return { heatLabel, status, band, sets, bodyMapMuscles };
}

/**
 * The mini heat map in words (ANL-01, WKT-13): "3 muscles in your target. 5 muscles below your
 * target. 10 muscles with no hard sets yet." Only the groups that occur.
 */
export function useHeatSentence() {
  return (rows: readonly Pick<MuscleWeekRow, 'heatLabel'>[]): string => {
    const count = (labels: readonly HeatLabel[]) =>
      rows.filter((row) => labels.includes(row.heatLabel)).length;
    const inTarget = count(['inTarget']);
    const below = count(['belowFloor', 'belowTarget']);
    const above = count(['high', 'veryHigh']);
    const none = count(['none']);
    const parts = [
      inTarget > 0
        ? plural(inTarget, {
            one: '# muscle in your target.',
            other: '# muscles in your target.',
          })
        : null,
      below > 0
        ? plural(below, {
            one: '# muscle below your target.',
            other: '# muscles below your target.',
          })
        : null,
      above > 0
        ? plural(above, {
            one: '# muscle above your target.',
            other: '# muscles above your target.',
          })
        : null,
      none > 0
        ? plural(none, {
            one: '# muscle with no hard sets yet.',
            other: '# muscles with no hard sets yet.',
          })
        : null,
    ];
    return parts.filter((part) => part !== null).join(' ');
  };
}

export function useStreakWords() {
  const { t } = useLingui();

  /** A week's state in words (MOT-03/04), never blaming (MOT-10). */
  const weekState = (state: WeekState): string => {
    switch (state) {
      case 'kept':
        return t`Kept`;
      case 'graced':
        return t`Kept with the grace session`;
      case 'missed':
        return t`Not kept`;
      case 'paused':
        return t`Paused for a break`;
      case 'pending':
        return t`In progress`;
      default:
        return assertNever(state);
    }
  };

  return { weekState, progress: sessionProgress, weeks: weekCount };
}

/** "2 of 4 sessions" (MOT-03 week progress). */
function sessionProgress(done: number, target: number): string {
  return plural(target, { one: `${done} of # session`, other: `${done} of # sessions` });
}

/** "3 weeks". */
function weekCount(count: number): string {
  return plural(count, { one: '# week', other: '# weeks' });
}
