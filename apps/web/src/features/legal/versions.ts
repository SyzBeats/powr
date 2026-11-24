/**
 * Versions of the health disclaimer (PRD §8.1, LEG-01) and the privacy notice (§8.2, LEG-02).
 * Bump a version whenever its text changes in substance: every user acknowledges again before
 * the next training screen (ONB-01). The texts are drafts until the legal review (V-06).
 */
export const LEGAL_VERSIONS = {
  disclaimerVersion: '2026-11-24',
  privacyVersion: '2026-11-24',
} as const;
