/**
 * Versions of the health disclaimer (PRD §8.1, LEG-01) and the privacy notice (§8.2, LEG-02).
 * Bump a version whenever its text changes in substance: every user acknowledges again before
 * the next training screen (ONB-01). The texts are drafts until the legal review (V-05, V-06;
 * `legalReview` in publisher.ts).
 *
 * 2026-11-25 (M5s): both texts rewritten in full (PRD §8.1, §8.2: what is stored where, hosting,
 * permissions, backups, data loss, deletion, the user's rights, contact by e-mail).
 */
export const LEGAL_VERSIONS = {
  disclaimerVersion: '2026-11-25',
  privacyVersion: '2026-11-25',
} as const;
