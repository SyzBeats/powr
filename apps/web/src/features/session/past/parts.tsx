import { useLingui } from '@lingui/react/macro';

import type { LoggedSet, SessionChange } from '@powr/domain';
import type { ChangeLabel } from '@powr/domain/trend';

import { formatNumber } from '../../../i18n/format';
import { assertNever } from '../../exhaustive';
import { massText, rirText } from '../words';

/** Words for logged sets, e1RM trend labels and the session's accepted changes. */
export function useSummaryWords() {
  const { t } = useLingui();

  /** "100 kg × 5 · RIR 2", "Bodyweight × 12", "Skipped". */
  const setValues = (set: LoggedSet): string => {
    if (set.state === 'skipped') return t`Skipped`;
    const load = massText(set.load) ?? t`Bodyweight`;
    const reps = set.reps ?? 0;
    const seconds = formatNumber((set.durationMs ?? 0) / 1000, 0);
    const values =
      set.durationMs !== undefined && set.reps === null
        ? t`${load} for ${seconds} s`
        : t`${load} × ${reps}`;
    if (set.effort.rir === null) return values;
    const rir = rirText(set.effort.rir, set.effort.openEnded === true);
    return t`${values} · RIR ${rir}`;
  };

  /** PRG-02: whether an e1RM change is likely real. */
  const trend = (change: ChangeLabel): string => {
    const up = change.direction === 'up';
    switch (change.label) {
      case 'insufficientData':
        return t`Not enough sessions yet to tell a real change`;
      case 'none':
        return t`Within normal day-to-day variation`;
      case 'likely':
        return up ? t`Likely a real gain` : t`Likely a real drop`;
      case 'veryLikely':
        return up ? t`Very likely a real gain` : t`Very likely a real drop`;
      default:
        return assertNever(change.label);
    }
  };

  /** RDY-03 and PRG-13 changes the user accepted for the session. */
  const change = (accepted: SessionChange): string => {
    switch (accepted.kind) {
      case 'capTopSet': {
        const rir = formatNumber(accepted.rirAdd ?? 1, 1);
        return t`Top sets ${rir} rep easier (readiness)`;
      }
      case 'dropBackoff': {
        const sets = accepted.dropSets ?? 1;
        return t`${sets} back-off set fewer (readiness)`;
      }
      case 'trimVolume':
        return t`One working set fewer per exercise (short sleep)`;
      case 'easeCompounds': {
        const rir = formatNumber(accepted.rirAdd ?? 1, 1);
        return t`Compound lifts ${rir} rep easier (short sleep)`;
      }
      case 'returnFromBreak': {
        const days = accepted.daysOff ?? 0;
        return t`Eased back in after ${days} days off`;
      }
      default:
        return assertNever(accepted.kind);
    }
  };

  return { setValues, trend, change };
}
