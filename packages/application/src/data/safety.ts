import type { Deps } from '../deps';
import type { Clock, SafetySnapshotInfo, SafetySnapshots } from '../ports';
import { err, ok, type Result } from '../result';

/**
 * Safety copies (§8.2.1, TD-14, TD-67): the backups POWR took by itself before a restore replaced
 * the data and before a data update (migration). Listed in Data and backups with save and delete.
 *
 * Pruning (TD-67, M6a; the cap: product owner 2026-11-25, M6c): the latest two copies are always
 * kept, and so is every copy younger than 30 days, but never more than five copies in all: past
 * five, the oldest go first. A copy taken before a restore therefore stays up to 30 days (unless
 * five newer ones follow it within that time), and there are never fewer than two. Pruning runs
 * after each new copy and when Data and backups lists them, never during a workout's writes.
 */
export const SAFETY_COPIES = {
  /** The newest copies kept whatever their age. */
  keepLatest: 2,
  /** Copies younger than this are kept too. */
  keepDays: 30,
  /** Never more copies than this; past it the oldest are deleted first. */
  keepMax: 5,
} as const;

const DAY_MS = 86_400_000;

/**
 * The IDs of the copies to delete at `nowEpochMs`, oldest first among them. Pure. Newest first
 * by time, then by ID (the store's insertion order); a copy whose time cannot be read counts as
 * new, so it is kept unless the cap needs room.
 */
export function safetyCopiesToPrune(
  copies: readonly Pick<SafetySnapshotInfo, 'id' | 'at'>[],
  nowEpochMs: number,
): number[] {
  const dated = copies.map((copy) => {
    const at = Date.parse(copy.at);
    return { id: copy.id, at: Number.isNaN(at) ? Number.POSITIVE_INFINITY : at };
  });
  const newestFirst = dated.toSorted((a, b) => b.at - a.at || b.id - a.id);
  const cutoff = nowEpochMs - SAFETY_COPIES.keepDays * DAY_MS;
  // Newest first, the young copies are a prefix; the latest two stay whatever their age.
  const young = newestFirst.filter((copy) => copy.at >= cutoff).length;
  const kept = Math.min(SAFETY_COPIES.keepMax, Math.max(SAFETY_COPIES.keepLatest, young));
  return newestFirst
    .slice(kept)
    .toReversed()
    .map((copy) => copy.id);
}

/** Deletes the copies the rule above lets go; returns their IDs. */
export async function pruneSafetyCopies(env: {
  readonly safety: SafetySnapshots;
  readonly clock: Clock;
}): Promise<number[]> {
  const ids = safetyCopiesToPrune(await env.safety.list(), env.clock.now().epochMs);
  for (const id of ids) await env.safety.delete(id);
  return ids;
}

/** The stored copies, newest first, after pruning the ones the rule lets go (TD-67). */
export async function listSafetyCopies(
  deps: Pick<Deps, 'safety' | 'clock'>,
): Promise<SafetySnapshotInfo[]> {
  await pruneSafetyCopies(deps);
  return deps.safety.list();
}

/** Hands a safety copy to the file gateway (download), like a regular backup. */
export async function saveSafetyCopy(
  deps: Deps,
  id: number,
): Promise<Result<'saved' | 'downloaded', { kind: 'missing' | 'cancelled' }>> {
  const [info, bytes] = await Promise.all([
    deps.safety.list().then((all) => all.find((entry) => entry.id === id)),
    deps.safety.read(id),
  ]);
  if (!info || !bytes) return err({ kind: 'missing' });
  const delivery = await deps.files.save({
    name: info.fileName,
    bytes,
    mime: 'application/zip',
  });
  return delivery === 'cancelled' ? err({ kind: 'cancelled' }) : ok(delivery);
}

export function deleteSafetyCopy(deps: Deps, id: number): Promise<void> {
  return deps.safety.delete(id);
}
