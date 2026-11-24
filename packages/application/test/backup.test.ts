import { describe, expect, it } from 'vitest';

import type { ExerciseId } from '@powr/domain';
import { emptyRawTables } from '@powr/formats';

import { logSet, requestPersistentStorage, setTheme } from '../src';
import { applyImport, exportBackup, previewImport } from '../src/usecases/backup';
import { createTestDeps } from './fakes';

const squat = 'ex.barbell-back-squat' as ExerciseId;

describe('backup use cases', () => {
  it('exports, restores into an empty app and yields identical raw data (DAT-05)', async () => {
    const source = createTestDeps();
    await setTheme(source.deps, 'dark');
    await logSet(source.deps, {
      exerciseId: squat,
      values: { load: { value: 225, unit: 'lb' }, reps: 5, rir: 1.5 },
    });
    await logSet(source.deps, { exerciseId: squat, values: { load: null, reps: 12, rir: null } });

    const exported = await exportBackup(source.deps);
    expect(exported).toMatchObject({
      ok: true,
      value: { delivery: 'downloaded', counts: { sets: 2 } },
    });
    const file = source.savedFiles[0]!;
    expect(file.name).toMatch(/^powr-backup-2026-11-24-\d{4}\.zip$/);

    const target = createTestDeps();
    const preview = await previewImport(target.deps, file.bytes);
    if (!preview.ok) throw new Error(preview.error.kind);
    expect(preview.value.preview.counts).toMatchObject({ sessions: 1, sets: 2, settings: 1 });

    await applyImport(target.deps, preview.value);
    const restored = target.data();
    const original = source.data();
    expect(restored.sets).toEqual(original.sets);
    expect(restored.sessions).toEqual(original.sessions);
    expect(restored.settings).toEqual(original.settings);
    // The restored active session arms the service-worker install gate again.
    expect(target.runtime.activeSession).toEqual({ id: original.sessions[0]!.id, build: 'test' });
  });

  it('takes a safety snapshot of the current data before replacing it', async () => {
    const source = createTestDeps();
    await logSet(source.deps, { exerciseId: squat, values: { load: null, reps: 1, rir: null } });
    await exportBackup(source.deps);

    const target = createTestDeps();
    await setTheme(target.deps, 'light');
    const preview = await previewImport(target.deps, source.savedFiles[0]!.bytes);
    if (!preview.ok) throw new Error(preview.error.kind);
    await applyImport(target.deps, preview.value);

    const snapshot = target.safetySnapshots[0]!;
    const snapshotContent = await previewImport(target.deps, snapshot.bytes);
    expect(snapshotContent.ok && snapshotContent.value.tables.settings).toEqual([
      { id: 'me', theme: 'light' },
    ]);
    expect(target.data().settings).toEqual([]);
  });

  it('does not record a backup the user cancelled', async () => {
    const { deps, data, cancelNextSave } = createTestDeps();
    cancelNextSave();
    expect(await exportBackup(deps)).toEqual({ ok: false, error: { kind: 'cancelled' } });
    expect(data().meta).toEqual([]);
  });

  it('rejects a corrupted file and leaves the data untouched', async () => {
    const { deps, data } = createTestDeps();
    await logSet(deps, { exerciseId: squat, values: { load: null, reps: 3, rir: null } });
    const before = data();
    const result = await previewImport(deps, new TextEncoder().encode('garbage'));
    expect(result).toEqual({ ok: false, error: { kind: 'notZip' } });
    expect(data()).toEqual(before);
    expect(before).not.toEqual(emptyRawTables());
  });
});

describe('persistent storage', () => {
  it('records the outcome with a timestamp (DAT-03)', async () => {
    const { deps, data } = createTestDeps();
    expect(await requestPersistentStorage(deps, 'user')).toBe(true);
    expect(data().meta).toEqual([
      {
        key: 'persistence',
        value: { granted: true, at: expect.stringMatching(/^2026-11-24T/), trigger: 'user' },
      },
    ]);
  });
});
