import { RAW_TABLE_NAMES } from '../records';
import { z } from '../zod';

export const BACKUP_FORMAT = 'powr-backup';
/** Container layout version (§8.3.2). */
export const BACKUP_FORMAT_VERSION = 1;

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const manifestSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  dataVersion: z.number().int().min(1),
  app: z.strictObject({ version: z.string().max(64), build: z.string().max(64) }),
  rulesVersion: z.string().max(64),
  contentVersion: z.string().max(64),
  createdAt: z.iso.datetime({ offset: true }),
  backupId: z.string().min(1).max(64),
  part: z.strictObject({
    kind: z.literal('data'),
    index: z.literal(1),
    count: z.literal(1),
  }),
  encrypted: z.literal(false),
  counts: z.record(z.enum(RAW_TABLE_NAMES), z.number().int().min(0)),
  dateRange: z.strictObject({ from: z.string().nullable(), to: z.string().nullable() }),
  entries: z
    .array(
      z.strictObject({
        path: z.string().regex(/^data\/[a-zA-Z]+\.json$/),
        bytes: z.number().int().min(0),
        records: z.number().int().min(0),
        sha256: sha256Hex,
      }),
    )
    .max(64),
  contentDigest: sha256Hex,
});

export type BackupManifest = z.infer<typeof manifestSchema>;

/** Loose header check, done before the strict schema so newer files get a precise message. */
export const manifestHeaderSchema = z.looseObject({
  format: z.string(),
  formatVersion: z.number(),
  dataVersion: z.number(),
});
