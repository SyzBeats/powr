import { z } from './zod';

export const EVIDENCE_TAGS = [
  'MA',
  'SR',
  'RCT-T',
  'RCT-U',
  'RCT',
  'POS',
  'OBS',
  'DELPHI/SURVEY',
  'NARR',
  'PREPRINT',
  'PRACT',
  'OFFICIAL',
  'MODEL',
  'INF',
] as const;

export const evidenceTagSchema = z.enum(EVIDENCE_TAGS);
export type EvidenceTag = z.infer<typeof evidenceTagSchema>;

/**
 * One registry row (§8.6.1). The value schema is per parameter; M0 accepts any JSON value
 * and the per-ID schemas arrive with the registry data in M1.
 */
export const paramDefSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/),
  value: z.json(),
  evidence: z.array(evidenceTagSchema).min(1),
  sources: z.array(z.string().min(1)),
  ebRef: z.string().min(1),
  verified: z.boolean(),
  blockedUntilVerified: z.boolean().optional(),
  userOverridable: z.boolean(),
  label: z.string().min(1),
  since: z.string().min(1),
});
export type ParamDef = z.infer<typeof paramDefSchema>;
