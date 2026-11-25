import { describe, expect, it } from 'vitest';

import { makeInstantTz, type LocalDate } from '@powr/domain';
import { emptyRawTables } from '@powr/formats';

import { SAFETY_COPIES, listSafetyCopies, safetyCopiesToPrune } from '../src/data';
import { addReferenceHistory, referenceHistory } from '../src/reference';
import { applyImport, exportBackup, previewImport } from '../src/usecases/backup';
import { createTestDeps } from './fakes';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-25T09:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const copy = (id: number, daysAgo: number) => ({ id, at: iso(daysAgo) });

describe('safety-copy pruning (TD-67, §8.2.1)', () => {
  it('keeps the latest two whatever their age', () => {
    expect(SAFETY_COPIES).toEqual({ keepLatest: 2, keepDays: 30 });
    expect(safetyCopiesToPrune([], NOW)).toEqual([]);
    expect(safetyCopiesToPrune([copy(1, 400)], NOW)).toEqual([]);
    expect(safetyCopiesToPrune([copy(1, 400), copy(2, 300)], NOW)).toEqual([]);
  });

  it('keeps every copy younger than 30 days, however many', () => {
    const young = [copy(1, 29), copy(2, 20), copy(3, 10), copy(4, 1), copy(5, 0)];
    expect(safetyCopiesToPrune(young, NOW)).toEqual([]);
  });

  it('deletes copies that are neither among the latest two nor younger than 30 days', () => {
    const copies = [copy(1, 90), copy(2, 45), copy(3, 25), copy(4, 5), copy(5, 2)];
    expect(safetyCopiesToPrune(copies, NOW)).toEqual([2, 1]);
    // Old copies after the latest two: only the third and later go.
    expect(safetyCopiesToPrune([copy(1, 90), copy(2, 80), copy(3, 70)], NOW)).toEqual([1]);
  });

  it('orders by time, not by the order given, and keeps a copy exactly 30 days old', () => {
    expect(safetyCopiesToPrune([copy(7, 2), copy(3, 60), copy(9, 1), copy(4, 30)], NOW)).toEqual([
      3,
    ]);
    // Equal times: the higher ID (the later insert) counts as newer.
    expect(safetyCopiesToPrune([copy(1, 40), copy(2, 40), copy(3, 40)], NOW)).toEqual([1]);
  });

  it('keeps a copy whose time cannot be read', () => {
    expect(
      safetyCopiesToPrune([copy(1, 90), copy(2, 80), { id: 3, at: 'not a time' }], NOW),
    ).toEqual([1]);
  });
});

describe('safety copies through the use cases (TD-67)', () => {
  it('a restore keeps its copy and prunes old ones beyond the latest two', async () => {
    const source = createTestDeps(emptyRawTables());
    await exportBackup(source.deps);
    const target = createTestDeps(emptyRawTables(), { start: '2026-11-25T09:00:00Z' });
    for (const [index, daysAgo] of [90, 60, 45].entries())
      target.safetySnapshots.push({
        id: 100 + index,
        fileName: `old-${daysAgo}.zip`,
        bytes: new Uint8Array([1]),
        reason: 'import',
        at: iso(daysAgo),
      });

    const preview = await previewImport(target.deps, source.savedFiles[0]!.bytes);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const result = await applyImport(target.deps, preview.value);

    // The new copy and the newest old one are the latest two; the two older ones went.
    expect(target.safetySnapshots.map((entry) => entry.fileName)).toEqual([
      'old-45.zip',
      result.safetySnapshot,
    ]);
  });

  it('listing prunes by the time of the clock', async () => {
    const test = createTestDeps(emptyRawTables());
    for (const [index, daysAgo] of [40, 35, 3].entries())
      test.safetySnapshots.push({
        id: index + 1,
        fileName: `copy-${daysAgo}.zip`,
        bytes: new Uint8Array([1]),
        reason: 'migration',
        at: iso(daysAgo),
      });
    const clock = { now: () => makeInstantTz(NOW, 'Europe/Zurich') };
    const listed = await listSafetyCopies({ safety: test.deps.safety, clock });
    expect(listed.map((entry) => entry.fileName)).toEqual(['copy-3.zip', 'copy-35.zip']);
  });
});

describe('the reference dataset (A-11, §8.19)', () => {
  const end = '2026-11-24' as LocalDate;

  it('has the reference size by default: about 1,300 workouts, 40,000 sets, 1,800 weigh-ins', () => {
    const history = referenceHistory({ end, zone: 'Europe/Zurich' });
    // 260 training weeks of 5; the current week only up to `end` (here a Tuesday).
    expect(history.sessions).toHaveLength(1297);
    expect(history.sets.length).toBeGreaterThanOrEqual(40_000);
    expect(history.sets.length).toBeLessThanOrEqual(40_500);
    expect(history.bodyweights).toHaveLength(1800);
    expect(history.breaks).toHaveLength(5);
    expect(history.sessions.every((session) => session.localDate <= end)).toBe(true);
    expect(history.bodyweights.at(-1)?.localDate).toBe(end);
    // No workout inside a break.
    for (const entry of history.breaks)
      expect(
        history.sessions.some(
          (session) => session.localDate >= entry.startDate && session.localDate <= entry.endDate!,
        ),
      ).toBe(false);
    // Deterministic.
    expect(referenceHistory({ end, zone: 'Europe/Zurich' })).toEqual(history);
  });

  it('is added to the data on the phone and replaced, not doubled, by a second load', async () => {
    const test = createTestDeps(emptyRawTables(), { start: '2026-11-25T09:00:00Z' });
    await test.deps.uow.write(['settings'], (repos) =>
      repos.settings.put({ id: 'me', theme: 'dark' }),
    );
    const first = await addReferenceHistory(test.deps, { weeks: 10, weighIns: 30, breaks: 1 });
    expect(first.sessions).toBeGreaterThan(30);
    expect(test.data().sessions).toHaveLength(first.sessions);
    expect(test.data().sets).toHaveLength(first.sets);
    expect(test.data().bodyweights).toHaveLength(30);
    // Up to yesterday: today stays free for a workout.
    expect(test.data().sessions.every((session) => session.localDate < '2026-11-25')).toBe(true);
    expect(test.data().settings).toEqual([{ id: 'me', theme: 'dark' }]);
    await addReferenceHistory(test.deps, { weeks: 10, weighIns: 30, breaks: 1 });
    expect(test.data().sessions).toHaveLength(first.sessions);
    expect(test.data().sets).toHaveLength(first.sets);
  });
});
