import { evidenceTagSchema, sourceIdSchema } from '../schema';
import { z } from '../zod';

export const SOURCE_STATUSES = ['active', 'excluded'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

const webUrl = z.url({ protocol: /^https?$/ });
const text = z.string().trim().min(1);

/**
 * One source registry entry (technical concept §8.6.1, ADR-0012). The registry is the directory
 * packages/rules/data/sources: every `*.yaml` file there is a list of entries, and all files are
 * merged into one registry. Its README documents the format and the file ownership.
 *
 * Source ID convention (format checked by `isSourceId` in @powr/domain):
 * - `src.<first author><year>`, all lowercase ASCII, the surname without spaces, hyphens or
 *   diacritics: `src.kubo2019`, `src.defranca2015`. A letter suffix tells apart works of the same
 *   first author and year; use the EB's own suffix (`src.remmert2023a`), otherwise letter them in
 *   order of first mention in the EB (`src.barbalho2020a`, `src.barbalho2020b`).
 * - If the EB names no author: the registry name plus identifier, `src.pmid24265879`,
 *   `src.nct07360236`, `src.researchsquare2882506`.
 * - POWR's own documents (the evidence base itself, as the basis of convention rows):
 *   `src.powr-<topic>`, for example `src.powr-eb-mapping`.
 * - A preprint and its published version are two entries (`src.pelland2024`, `src.pelland2026`),
 *   because their numbers can differ (E-2).
 */
export const sourceDefSchema = z
  .strictObject({
    id: sourceIdSchema,
    /** As complete as the EB and its research notes give it; descriptions in [brackets]. */
    citation: text,
    url: webUrl.exactOptional(),
    /** Further links the EB gives for the same work (catalogue records, notices, summaries). */
    seeAlso: z.array(webUrl).min(1).exactOptional(),
    /** The EB tag of the study design ("How to read the evidence tags"). */
    tag: evidenceTagSchema,
    /** `excluded`: no parameter or credit may cite it (§8.6.5 check 2). */
    status: z.enum(SOURCE_STATUSES),
    /** Why the source is excluded; required for, and only for, excluded sources. */
    reason: text.exactOptional(),
    /** Caveats for authors, e.g. "verify before hard-coding" or how the tag was chosen. */
    note: text.exactOptional(),
  })
  .refine((source) => source.status !== 'excluded' || source.reason !== undefined, {
    path: ['reason'],
    error: 'An excluded source needs a reason',
  })
  .refine((source) => source.status !== 'active' || source.reason === undefined, {
    path: ['reason'],
    error: 'Only excluded sources carry a reason; use note for caveats',
  });
export type SourceDef = z.infer<typeof sourceDefSchema>;
