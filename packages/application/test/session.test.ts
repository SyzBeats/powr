import { describe, expect, it } from 'vitest';

import type { ExerciseId } from '@powr/domain';

import { finishSession, logSet, reconcileRuntimeFlags } from '../src';
import { createTestDeps } from './fakes';

const squat = 'ex.barbell-back-squat' as ExerciseId;
const bench = 'ex.barbell-bench-press' as ExerciseId;
const values = { load: { value: 100, unit: 'kg' as const }, reps: 5, rir: 2 };

describe('logSet', () => {
  it('starts a session with the first set and arms the update gate', async () => {
    const { deps, data, runtime } = createTestDeps();
    const result = await logSet(deps, { exerciseId: squat, values });

    expect(result.ok).toBe(true);
    const { sessions, sets } = data();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ status: 'active', localDate: '2026-11-24' });
    expect(sets).toEqual([
      expect.objectContaining({
        sessionId: sessions[0]!.id,
        exerciseId: squat,
        index: 0,
        load: { value: 100, unit: 'kg' },
        effort: { rir: 2, source: 'entered' },
      }),
    ]);
    expect(runtime.activeSession).toEqual({ id: sessions[0]!.id, build: 'test' });
  });

  it('adds later sets to the active session and numbers them per exercise', async () => {
    const { deps, data } = createTestDeps();
    await logSet(deps, { exerciseId: squat, values });
    await logSet(deps, { exerciseId: bench, values });
    await logSet(deps, { exerciseId: squat, values: { ...values, rir: null } });

    const { sessions, sets } = data();
    expect(sessions).toHaveLength(1);
    expect(sets.map((set) => [set.exerciseId, set.index])).toEqual([
      [squat, 0],
      [bench, 0],
      [squat, 1],
    ]);
    expect(sets[2]!.effort).toEqual({ rir: null, source: 'none' });
  });

  it('rejects implausible values and unknown exercises without writing', async () => {
    const { deps, data } = createTestDeps();
    expect(await logSet(deps, { exerciseId: squat, values: { ...values, reps: 2.5 } })).toEqual({
      ok: false,
      error: { kind: 'invalidValues', issues: [{ field: 'reps', kind: 'notInteger' }] },
    });
    expect(await logSet(deps, { exerciseId: 'ex.unknown' as ExerciseId, values })).toEqual({
      ok: false,
      error: { kind: 'unknownExercise' },
    });
    expect(data().sessions).toEqual([]);
  });
});

describe('finishSession', () => {
  it('finishes the active session, releases the update gate and lets the next set start anew', async () => {
    const { deps, data, runtime } = createTestDeps();
    await logSet(deps, { exerciseId: squat, values });

    const finished = await finishSession(deps);
    expect(finished.ok && finished.value.status).toBe('finished');
    expect(runtime.activeSession).toBeNull();
    expect(await finishSession(deps)).toEqual({ ok: false, error: { kind: 'noActiveSession' } });

    await logSet(deps, { exerciseId: squat, values });
    expect(
      data()
        .sessions.map((session) => session.status)
        .toSorted(),
    ).toEqual(['active', 'finished']);
  });

  it('reconciles a lost runtime flag from the database on boot', async () => {
    const { deps, runtime } = createTestDeps();
    await logSet(deps, { exerciseId: squat, values });
    runtime.activeSession = null;

    await reconcileRuntimeFlags(deps);
    expect(runtime.activeSession).not.toBeNull();
  });
});
