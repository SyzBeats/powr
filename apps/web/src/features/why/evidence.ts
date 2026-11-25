import { useLingui } from '@lingui/react/macro';

import type { EvidenceTag } from '@powr/domain';

import { assertNever } from '../exhaustive';

/** The user-facing evidence labels of technical concept §8.6.4 (LEG-05), in their reading order. */
export const EVIDENCE_LABELS = ['strong', 'limited', 'convention', 'estimate', 'official'] as const;
export type EvidenceLabel = (typeof EVIDENCE_LABELS)[number];

/** EB tag → label (§8.6.4). There is no EMG label: EMG-only studies are tagged OBS. */
function evidenceLabelOf(tag: EvidenceTag): EvidenceLabel {
  switch (tag) {
    case 'MA':
    case 'SR':
    case 'POS':
    case 'RCT-T':
      return 'strong';
    case 'RCT':
    case 'RCT-U':
    case 'OBS':
    case 'PREPRINT':
    case 'NARR':
      return 'limited';
    case 'PRACT':
    case 'DELPHI/SURVEY':
      return 'convention';
    case 'INF':
    case 'MODEL':
      return 'estimate';
    case 'OFFICIAL':
      return 'official';
    default:
      return assertNever(tag);
  }
}

/** The labels in words; `of(tags)` gives each label once, in reading order. */
export function useEvidenceLabels() {
  const { t } = useLingui();
  const name = (label: EvidenceLabel): string => {
    switch (label) {
      case 'strong':
        return t`Strong research`;
      case 'limited':
        return t`Limited research`;
      case 'convention':
        return t`Coaching convention`;
      case 'estimate':
        return t`App estimate`;
      case 'official':
        return t`Official standard`;
      default:
        return assertNever(label);
    }
  };
  const of = (tags: readonly EvidenceTag[]): string[] => {
    const labels = new Set(tags.map(evidenceLabelOf));
    return EVIDENCE_LABELS.filter((label) => labels.has(label)).map(name);
  };
  return { name, of };
}
