import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { emptyRawTables } from '@powr/formats';

import { SAFETY_COPIES, safetyCopiesToPrune } from '../src/data';
import { applyImport, exportBackup, previewImport } from '../src/usecases/backup';
import { createTestDeps } from './fakes';

/*
 * M6c: the five-copy cap on safety copies (product owner 2026-11-25, TD-67 follow-up). The rule:
 * the latest two copies, plus any younger than 30 days, but never more than five; past five the
 * oldest go first.
 */

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-25T09:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const copy = (id: number, daysAgo: number) => ({ id, at: iso(daysAgo) });

describe('safety copies: never more than five (M6c)', () => {
  it('caps young copies at five, deleting the oldest first', () => {
    expect(SAFETY_COPIES.keepMax).toBe(5);
    const young = [copy(1, 20), copy(2, 15), copy(3, 10), copy(4, 5), copy(5, 3), copy(6, 2)];
    expect(safetyCopiesToPrune(young, NOW)).toEqual([1]);
    const seven = [...young, copy(7, 1)];
    // The two oldest young copies go, the oldest first.
    expect(safetyCopiesToPrune(seven, NOW)).toEqual([1, 2]);
  });

  it('several restores on one day keep the newest five (same time: the later ID is newer)', () => {
    const sameDay = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => copy(id, 0));
    expect(safetyCopiesToPrune(sameDay, NOW)).toEqual([1, 2, 3]);
  });

  it('old copies still go after the latest two; young ones below the cap stay', () => {
    const mixed = [copy(1, 300), copy(2, 200), copy(3, 100), copy(4, 20), copy(5, 10), copy(6, 1)];
    // Three young copies are kept; the three old ones go, oldest first.
    expect(safetyCopiesToPrune(mixed, NOW)).toEqual([1, 2, 3]);
    // One young copy: the latest two stay, so one old copy stays with it.
    expect(safetyCopiesToPrune([copy(1, 300), copy(2, 200), copy(3, 1)], NOW)).toEqual([1]);
  });

  it('copies whose time cannot be read count as new, and the cap still holds', () => {
    const unreadable = [1, 2, 3, 4, 5, 6].map((id) => ({ id, at: 'not a time' }));
    expect(safetyCopiesToPrune(unreadable, NOW)).toEqual([1]);
    expect(safetyCopiesToPrune([...unreadable.slice(0, 4), copy(9, 1), copy(10, 2)], NOW)).toEqual([
      10,
    ]);
  });

  it('property: at most five kept, never fewer than two (or all), the kept are the newest', () => {
    const arbitraryCopies = fc.uniqueArray(
      fc.record({
        id: fc.integer({ min: 1, max: 10_000 }),
        daysAgo: fc.integer({ min: 0, max: 400 }),
      }),
      { selector: (entry) => entry.id, maxLength: 20 },
    );
    fc.assert(
      fc.property(arbitraryCopies, (entries) => {
        const copies = entries.map((entry) => copy(entry.id, entry.daysAgo));
        const pruned = safetyCopiesToPrune(copies, NOW);
        const keptIds = copies.map((entry) => entry.id).filter((id) => !pruned.includes(id));
        const time = (id: number) => Date.parse(copies.find((entry) => entry.id === id)!.at);
        const newer = (a: number, b: number) => time(a) - time(b) || a - b;

        expect(new Set(pruned).size).toBe(pruned.length);
        expect(keptIds.length).toBeLessThanOrEqual(SAFETY_COPIES.keepMax);
        expect(keptIds.length).toBeGreaterThanOrEqual(Math.min(copies.length, 2));
        // Every kept copy is newer than every pruned one.
        for (const kept of keptIds)
          for (const gone of pruned) expect(newer(kept, gone)).toBeGreaterThan(0);
        // A young copy goes only when five newer copies are kept.
        const youngGone = pruned.filter(
          (id) => time(id) >= NOW - SAFETY_COPIES.keepDays * DAY,
        ).length;
        expect(youngGone === 0 || keptIds.length === SAFETY_COPIES.keepMax).toBe(true);
        // Oldest first.
        expect(pruned).toEqual(pruned.toSorted(newer));
      }),
    );
  });
});

describe('safety copies through the restore (M6c)', () => {
  it('six restores in a row leave five copies, with the last restore copy among them', async () => {
    const source = createTestDeps(emptyRawTables());
    await exportBackup(source.deps);
    const backup = source.savedFiles[0]!.bytes;
    const target = createTestDeps(emptyRawTables(), { start: '2026-11-25T09:00:00Z' });

    const made: string[] = [];
    for (let restore = 0; restore < 6; restore += 1) {
      const preview = await previewImport(target.deps, backup);
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;
      made.push((await applyImport(target.deps, preview.value)).safetySnapshot);
    }

    expect(target.safetySnapshots).toHaveLength(5);
    // The first copy (the oldest) went; the five newest stay in order.
    expect(target.safetySnapshots.map((entry) => entry.id)).toEqual([2, 3, 4, 5, 6]);
    expect(target.safetySnapshots.at(-1)!.fileName).toBe(made.at(-1));
  });
});
