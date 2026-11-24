import { EVIDENCE_TAGS, isSourceId } from '@powr/domain';

import { z } from './zod';

export const evidenceTagSchema = z.enum(EVIDENCE_TAGS);

/** A source registry ID such as `src.kubo2019` (convention: data/sources/README.md). */
export const sourceIdSchema = z
  .string()
  .refine(isSourceId, 'Source IDs look like src.kubo2019 (see data/sources/README.md)');

/**
 * One registry row (§8.6.1). The value schema is per parameter; M0 accepts any JSON value
 * and the per-ID schemas arrive with the registry data in M1.
 */
export const paramDefSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/),
  value: z.json(),
  evidence: z.array(evidenceTagSchema).min(1),
  sources: z.array(sourceIdSchema),
  ebRef: z.string().min(1),
  verified: z.boolean(),
  blockedUntilVerified: z.boolean().optional(),
  userOverridable: z.boolean(),
  label: z.string().min(1),
  since: z.string().min(1),
});
export type ParamDef = z.infer<typeof paramDefSchema>;
