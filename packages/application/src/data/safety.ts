import type { Deps } from '../deps';
import type { SafetySnapshotInfo } from '../ports';
import { err, ok, type Result } from '../result';

/**
 * Safety copies (§8.2.1, TD-14): the backups POWR took by itself before a restore replaced the
 * data and before a data update (migration). Listed in Data and backups with save and delete;
 * never deleted silently except by the rotation that keeps the latest two.
 */
export function listSafetyCopies(deps: Deps): Promise<SafetySnapshotInfo[]> {
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
