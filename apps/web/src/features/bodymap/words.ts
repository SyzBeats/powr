import { useLingui } from '@lingui/react/macro';

import type { RankedExercise } from '@powr/domain/analytics';
import type { ExposureSummary } from '@powr/domain/session';

import { formatLocalDate, formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';
import { massText } from '../session/words';
import type { VolumeMode } from './search';

/** Words of the body-map screens (MAP-01…07); MOT-10 tone: facts and next steps. */
export function useBodyMapWords() {
  const { t } = useLingui();
  const labels = useLabels();

  const modes: readonly { readonly value: VolumeMode; readonly label: string }[] = [
    { value: 'week', label: t`This week` },
    { value: 'lastWeek', label: t`Last week` },
    { value: 'avg4', label: t`4-week average` },
  ];

  /** The legend's title per mode (the values are fractional hard sets, EXL-05). */
  const legendTitle = (mode: VolumeMode): string => {
    switch (mode) {
      case 'week':
        return t`Hard sets this week`;
      case 'lastWeek':
        return t`Hard sets last week`;
      case 'avg4':
        return t`Hard sets a week, 4-week average`;
      default:
        return assertNever(mode);
    }
  };

  /** "Primary (credit 1)", "Secondary (credit 0.5)", "Minor (credit 0.25)" (EXL-05). */
  const role = (entry: Pick<RankedExercise, 'role' | 'credit'>): string => {
    const credit = formatNumber(entry.credit, 2);
    switch (entry.role) {
      case 'primary':
        return t`Primary muscle (credit ${credit})`;
      case 'secondary':
        return t`Secondary muscle (credit ${credit})`;
      case 'minor':
        return t`Minor role (credit ${credit}, an unvalidated convention)`;
      default:
        return assertNever(entry.role);
    }
  };

  /** The mapping's evidence tag in words (EXL-05, MAP-03). */
  const evidence = (tag: RankedExercise['evidence']): string | null => {
    switch (tag) {
      case 'H':
        return t`Evidence: hypertrophy studies`;
      case 'EMG':
        return t`Evidence: muscle activation (EMG) only`;
      case 'C':
        return t`Evidence: convention`;
      case null:
        return null;
      default:
        return assertNever(tag);
    }
  };

  /** "Needs a cable machine and a bench or a box" (MAP-02 "include unavailable"). */
  const missing = (entry: RankedExercise['missing']): string | null => {
    if (!entry) return null;
    const or = new Intl.ListFormat(undefined, { type: 'disjunction' });
    const and = new Intl.ListFormat(undefined, { type: 'conjunction' });
    const parts = [
      ...entry.allOf.map((id) => labels.equipment(id)),
      ...entry.anyOf.map((group) => or.format(group.map((id) => labels.equipment(id)))),
    ];
    if (parts.length === 0) return null;
    const items = and.format(parts);
    return t`Needs: ${items}`;
  };

  /** "Last time (12 Nov): 80 kg × 8, 80 kg × 7" (MAP-02 "the user's last performance"). */
  const last = (exposure: ExposureSummary | null): string | null => {
    if (!exposure) return null;
    const date = formatLocalDate(exposure.localDate, 'short');
    const sets = exposure.sets
      .filter((set) => set.state === 'done')
      .map((set) => {
        const load = massText(set.load);
        const reps = set.reps ?? 0;
        return load ? t`${load} × ${reps}` : t`${reps} reps`;
      })
      .join(', ');
    return sets ? t`Last time (${date}): ${sets}` : t`Last time: ${date}`;
  };

  /** MAP-03 scores as a rating out of 100 (effectiveness) or a share (focus). */
  const score = (value: number): string => {
    const points = formatNumber(Math.round(value * 100), 0);
    return t`${points} of 100`;
  };

  return { modes, legendTitle, role, evidence, missing, last, score };
}
