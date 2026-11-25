import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

// oxlint-disable-next-line no-restricted-imports -- tests load the backup code eagerly
import { snapshotBeforeUpgrade } from '@powr/application/backup';
import { listSafetyCopies } from '@powr/application/data';
import { makeInstantTz } from '@powr/domain';

import { createSafetySnapshots } from './safety-db';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-25T09:00:00Z');
const at = (daysAgo: number) => makeInstantTz(NOW - daysAgo * DAY, 'Europe/Zurich');

/**
 * TD-67 (M6a) against the real `powr-safety` store (fake-indexeddb): the store keeps what it is
 * given; the application prunes by the rule (the latest two, plus any younger than 30 days).
 */
describe('safety copies in powr-safety (§8.2.1, TD-67)', () => {
  it('stores every copy, then the guard and the list prune only old copies beyond the latest two', async () => {
    const safety = createSafetySnapshots();
    for (const [name, daysAgo] of [
      ['a.zip', 50],
      ['b.zip', 40],
      ['c.zip', 20],
      ['d.zip', 10],
    ] as const)
      await safety.save({
        fileName: name,
        bytes: new Uint8Array([1]),
        reason: 'import',
        at: at(daysAgo),
      });
    // The store itself no longer rotates.
    expect((await safety.list()).map((copy) => copy.fileName)).toEqual([
      'd.zip',
      'c.zip',
      'b.zip',
      'a.zip',
    ]);

    // A data update's snapshot: the two copies older than 30 days beyond the latest two go.
    let id = 0;
    const env = {
      app: { version: '0.0.0', build: 'test' },
      clock: { now: () => makeInstantTz(NOW, 'Europe/Zurich') },
      ids: { next: () => `id-${++id}` },
      safety,
      files: { save: async () => 'downloaded' as const },
      rulesVersion: 'r',
      contentVersion: 'c',
    };
    const snapshot = await snapshotBeforeUpgrade(env, {
      dataVersion: 1,
      tables: { settings: [{ id: 'me', theme: 'dark' }], meta: [], sessions: [], sets: [] },
    });
    expect((await safety.list()).map((copy) => copy.fileName)).toEqual([
      snapshot.fileName,
      'd.zip',
      'c.zip',
    ]);

    // 25 days later, Data and backups lists them: c.zip is now 45 days old, beyond the latest two.
    const later = { now: () => makeInstantTz(NOW + 25 * DAY, 'Europe/Zurich') };
    const copies = await listSafetyCopies({ safety, clock: later });
    expect(copies.map((copy) => copy.fileName)).toEqual([snapshot.fileName, 'd.zip']);

    // Years later the latest two still stay.
    const muchLater = { now: () => makeInstantTz(NOW + 900 * DAY, 'Europe/Zurich') };
    expect(await listSafetyCopies({ safety, clock: muchLater })).toHaveLength(2);
  });
});
