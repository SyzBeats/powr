/** Archive limits for untrusted backup files (§8.3.5). */
export interface ArchiveLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxTotalUncompressedBytes: number;
  readonly maxCompressionRatio: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxArchiveBytes: 200 * 1024 * 1024,
  maxEntries: 64,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 200,
};
