import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import { useTrainingPreferences } from '../../hooks/use-settings';
import { formatNumber } from '../../i18n/format';

const number = (value: number) => formatNumber(value, 1);

/** RPE = 10 − RIR (PRD SET-05, half points allowed); stored effort is always RIR. */
export function rpeOf(rir: number): number {
  return 10 - rir;
}

/**
 * SET-05 (M5s): effort shown as RIR ("RIR 2") or RPE ("RPE 8"), as the user chose in Settings →
 * Training. Only the words change: the engine and the records keep RIR. An open-ended "5+" RIR
 * is "RPE 5 or less".
 */
export function useEffortWords() {
  const { t } = useLingui();
  const { effortScale: scale, rirInput: input } = useTrainingPreferences();

  /** One logged or suggested effort: "RIR 2", "RIR 5+", "RPE 8", "RPE 5 or less". */
  const value = (rir: number, openEnded = false): string => {
    if (scale === 'rpe') {
      const rpe = number(rpeOf(rir));
      return openEnded ? t`RPE ${rpe} or less` : t`RPE ${rpe}`;
    }
    const shown = number(rir);
    return openEnded ? t`RIR ${shown}+` : t`RIR ${shown}`;
  };

  /** A prescribed range: "1–2 reps in reserve" or "RPE 8–9" (the higher RPE is the lower RIR). */
  const target = (low: number, high: number): string => {
    if (scale === 'rpe') {
      const from = number(rpeOf(high));
      const to = number(rpeOf(low));
      return low === high ? t`RPE ${to}` : t`RPE ${from}–${to}`;
    }
    const from = number(low);
    const to = number(high);
    return low === high
      ? plural(low, { one: '# rep in reserve', other: '# reps in reserve' })
      : t`${from}–${to} reps in reserve`;
  };

  /** A plan's short form: "RIR 1–2" or "RPE 8–9". */
  const short = (low: number, high: number): string => {
    if (scale === 'rpe') {
      const from = number(rpeOf(high));
      const to = number(rpeOf(low));
      return low === high ? t`RPE ${to}` : t`RPE ${from}–${to}`;
    }
    const from = number(low);
    const to = number(high);
    return low === high ? t`RIR ${from}` : t`RIR ${from}–${to}`;
  };

  return { scale, input, value, target, short };
}
