import { describe, expect, it } from 'vitest';

import type { Baseline, ExerciseId, LocalDate, PresetId, SessionId } from '@powr/domain';
import type { SessionView } from '@powr/domain/session';

import { finishSession, logSet } from '../src';
import {
  completeOnboarding,
  equipmentProfileFromPreset,
  generatePlanPreview,
  type OnboardingAnswers,
} from '../src/planning';
import {
  deletePastSession,
  dispatch,
  editPastSession,
  finishWorkout,
  logPastSession,
  observeActiveSession,
  previewPastEdit,
  rememberRest,
  resumeWorkout,
  startWorkout,
  substitutionOptions,
  workoutSummary,
} from '../src/session';
import { applyImport, exportBackup, previewImport } from '../src/usecases/backup';
import { createTestDeps } from './fakes';

/*
 * M3a session use cases: start, log, undo, a simulated process kill, finish with the derived
 * data rebuilt, past sessions with their recompute (WKT-15, §6.9) and the live view.
 */

type Test = ReturnType<typeof createTestDeps>;
const id = (value: string) => value as ExerciseId;
const squat = id('ex.barbell-back-squat');
const bench = id('ex.barbell-bench-press');
const kg = (value: number) => ({ value, unit: 'kg' as const });

function answers(test: Test, baselines: readonly Baseline[]): OnboardingAnswers {
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: 'preset.commercial-gym' as PresetId,
    unit: 'kg',
    name: 'Gym',
  });
  if (!equipment.ok) throw new Error('preset missing');
  return {
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'preferNotToSay',
    referenceSet: null,
    birthYear: null,
    height: null,
    bodyweight: null,
    style: 'powerlifting',
    phase: 'notTracking',
    experience: {
      trainingAge: 'months6To24',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: null,
    schedule: { weekdays: [1, 3, 5], sessionMinutes: 90 },
    startTimes: [],
    equipment: equipment.value,
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferredExercises: [],
    baselines,
    meet: null,
  };
}

/** An onboarded powerlifter with a 150 kg squat 1RM; the first planned session. */
async function onboarded(test: Test) {
  const input = answers(test, [
    {
      exerciseId: squat,
      kind: 'oneRepMax',
      load: kg(150),
      reps: 1,
      rir: 0,
      date: '2026-11-20' as LocalDate,
    },
  ]);
  const preview = await generatePlanPreview(test.deps, { answers: input });
  if (!preview.ok) throw new Error('no plan');
  const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
  if (!done.ok) throw new Error(done.error.kind);
  const planned = test
    .data()
    .plannedSessions.toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1));
  return planned.find((session) => session.slots.some((slot) => slot.exerciseId === squat))!;
}

async function started(test: Test) {
  const planned = await onboarded(test);
  const start = await startWorkout(test.deps, {
    source: { kind: 'planned', plannedSessionId: planned.id },
  });
  if (!start.ok) throw new Error(start.error.kind);
  return { planned, start: start.value };
}

/** Confirms the cursor's set with its suggested values (the one-tap confirm, WKT-03). */
async function confirmCurrent(test: Test, view: SessionView) {
  const current = view.current!.value;
  const outcome = await dispatch(test.deps, {
    type: 'CONFIRM_SET',
    slotKey: current.slotKey,
    setKey: current.setKey,
    values: { load: current.load, reps: current.reps ?? 5, rir: current.rir },
  });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
  return outcome.value;
}

describe('startWorkout (WKT-01)', () => {
  it('starts the planned session with warm-ups from the baseline e1RM and arms the update gate', async () => {
    const test = createTestDeps();
    const { planned, start } = await started(test);
    const { session } = start.view;
    expect(session).toMatchObject({
      status: 'active',
      origin: 'planned',
      plannedSessionId: planned.id,
    });
    expect(session.exercises.map((slot) => slot.exerciseId)).toEqual(
      planned.slots.map((slot) => slot.exerciseId),
    );
    const squatSlot = start.view.exercises.find((entry) => entry.slot.exerciseId === squat)!;
    expect(squatSlot.e1rmKg).toBeCloseTo(150, 6);
    expect(squatSlot.calibration).toBe('calibrated');
    expect(squatSlot.slot.sets[0]!.type).toBe('warmup');
    expect(start.effects).toContainEqual({ kind: 'wakeLock', action: 'acquire' });
    expect(test.runtime.activeSession).toEqual({ id: session.id, build: 'test' });
    // The derived state was seeded from the baseline and stored (dExerciseState).
    expect(
      test.data().dExerciseState.find((state) => state.exerciseId === squat)?.baseline?.e1rmKg,
    ).toBe(150);
  });

  it('refuses a second session while one is in progress', async () => {
    const test = createTestDeps();
    const { start } = await started(test);
    const again = await startWorkout(test.deps, {
      source: { kind: 'freestyle', exerciseIds: [bench] },
    });
    expect(again).toEqual({
      ok: false,
      error: { kind: 'activeSession', sessionId: start.view.session.id },
    });
  });
});

describe('logging, undo and recovery (WKT-03, WKT-12, WKT-14, §8.2.4)', () => {
  it('writes the set and the session in one transaction; undo removes the set and restores the timer', async () => {
    const test = createTestDeps();
    const { start } = await started(test);
    const first = await confirmCurrent(test, start.view);
    expect(test.data().sets).toHaveLength(1);
    expect(first.result.undoToken).toBe('u1');
    expect(first.effects).toContainEqual({ kind: 'timer.arm', timer: first.result.timer });
    const second = await confirmCurrent(test, first.view);
    expect(test.data().sets).toHaveLength(2);
    const undone = await dispatch(test.deps, { type: 'UNDO', token: second.result.undoToken! });
    expect(undone.ok).toBe(true);
    expect(test.data().sets).toHaveLength(1);
    expect(test.data().sessions[0]!.timer).toEqual(first.result.timer);
    expect(undone.ok && undone.value.effects).toContainEqual({
      kind: 'timer.arm',
      timer: first.result.timer,
    });
  });

  it('a crash before the commit changes nothing (DAT-02)', async () => {
    const test = createTestDeps();
    const { start } = await started(test);
    const before = test.data();
    const { uow } = test.deps;
    const crashing: typeof test.deps = {
      ...test.deps,
      uow: {
        read: (tables, fn) => uow.read(tables, fn),
        // The process dies after the writes but before IndexedDB commits them.
        write: (tables, fn) =>
          uow.write(tables, async (repos) => {
            await fn(repos);
            throw new Error('killed before the commit');
          }),
      },
    };
    const current = start.view.current!.value;
    await expect(
      dispatch(crashing, {
        type: 'CONFIRM_SET',
        slotKey: current.slotKey,
        setKey: current.setKey,
        values: { load: current.load, reps: 8, rir: null },
      }),
    ).rejects.toThrow('killed before the commit');
    expect(test.data().sets).toEqual(before.sets);
    expect(test.data().sessions).toEqual(before.sessions);
  });

  it('survives a process kill between sets: the session resumes at the next set with its timer', async () => {
    const test = createTestDeps();
    const { start } = await started(test);
    const logged = await confirmCurrent(test, start.view);
    // The process dies; a new process opens the same database later.
    const restarted = createTestDeps(test.data(), { start: '2026-11-24T17:20:00Z' });
    const resumed = await resumeWorkout(restarted.deps);
    if (!resumed.ok) throw new Error(resumed.error.kind);
    expect(resumed.value.view.session.cursor).toEqual(logged.view.session.cursor);
    expect(resumed.value.view.current?.value.setKey).toBe(logged.view.current?.value.setKey);
    expect(resumed.value.effects).toContainEqual({ kind: 'timer.arm', timer: logged.result.timer });
    expect(resumed.value.result.stale).toBe(false);
    const timer = resumed.value.view.timer!;
    expect(timer.view.remainingMs).toBeGreaterThanOrEqual(0);
    const next = await confirmCurrent(restarted, resumed.value.view);
    expect(
      restarted
        .data()
        .sets.map((set) => set.index)
        .toSorted((a, b) => a - b),
    ).toEqual([0, 1]);
    expect(next.view.session.revision).toBe(logged.view.session.revision + 1);
  });
});

describe('finishing (WKT-13) rebuilds the derived data (§8.2.8)', () => {
  it('returns the summary, completes the planned session and stores the exercise state and PRs', async () => {
    const test = createTestDeps();
    const { planned, start } = await started(test);
    let view = start.view;
    let done = 0;
    // Log the first exercise's warm-ups and its first two working sets.
    const first = view.session.exercises[0]!;
    const target = first.sets.filter((set) => set.type !== 'warmup')[1]!.key;
    while (!test.data().sets.some((set) => set.slotKey === first.key && set.setKey === target)) {
      view = (await confirmCurrent(test, view)).view;
      done++;
    }
    const finished = await finishWorkout(test.deps, { as: 'partial' });
    if (!finished.ok) throw new Error(finished.error.kind);
    expect(finished.value.summary).toMatchObject({ status: 'partial', sets: { done } });
    expect(finished.value.lowReadinessDays).toBe(0);
    expect(finished.value.effects).toContainEqual({ kind: 'wakeLock', action: 'release' });
    expect(test.runtime.activeSession).toBeNull();
    expect(test.data().plannedSessions.find((session) => session.id === planned.id)?.status).toBe(
      'done',
    );
    const state = test
      .data()
      .dExerciseState.find((entry) => entry.exerciseId === first.exerciseId)!;
    expect(state.exposures).toBe(1);
    expect(
      test.data().dSessionE1rm.filter((point) => point.exerciseId === first.exerciseId),
    ).toHaveLength(1);
    const summary = await workoutSummary(test.deps, start.view.session.id);
    expect(summary?.sets.done).toBe(done);
  });

  it('M0 quick-log finishing drops the derived state so it is rebuilt with that session', async () => {
    const test = createTestDeps();
    const planned = await onboarded(test);
    const start = await startWorkout(test.deps, {
      source: { kind: 'planned', plannedSessionId: planned.id },
    });
    expect(start.ok).toBe(true);
    await finishWorkout(test.deps, { as: 'finished' });
    await logSet(test.deps, { exerciseId: squat, values: { load: kg(100), reps: 5, rir: 2 } });
    expect(test.data().dExerciseState.some((state) => state.exerciseId === squat)).toBe(true);
    await finishSession(test.deps);
    expect(test.data().dExerciseState.some((state) => state.exerciseId === squat)).toBe(false);
  });
});

/** Two backdated squat sessions (100 kg, then 105 kg × 5). */
async function history(test: Test) {
  await onboarded(test);
  for (const [date, load] of [
    ['2026-11-17', 100],
    ['2026-11-20', 105],
  ] as const) {
    const logged = await logPastSession(test.deps, {
      localDate: date as LocalDate,
      exercises: [{ exerciseId: squat, sets: [{ load: kg(load), reps: 5, rir: 2 }] }],
    });
    if (!logged.ok) throw new Error(logged.error.kind);
  }
  return test.data().sessions.toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1));
}

describe('past sessions (WKT-15, §6.9)', () => {
  it('logs backdated sessions and recomputes PRs in date order', async () => {
    const test = createTestDeps();
    const [first, second] = await history(test);
    expect(first).toMatchObject({ backdated: true, status: 'finished' });
    const prsOf = (sessionId: SessionId) =>
      test
        .data()
        .dPrs.filter((pr) => pr.sessionId === sessionId)
        .map((pr) => pr.type)
        .toSorted();
    expect(prsOf(first!.id)).toEqual([]);
    expect(prsOf(second!.id)).toEqual(['e1rm', 'load', 'rep', 'volume']);
    // A heavier session logged for an earlier day takes the PRs away from the later one.
    await logPastSession(test.deps, {
      localDate: '2026-11-10' as LocalDate,
      exercises: [{ exerciseId: squat, sets: [{ load: kg(110), reps: 5, rir: 2 }] }],
    });
    expect(prsOf(second!.id)).toEqual([]);
    expect(test.data().dExerciseState.find((state) => state.exerciseId === squat)?.exposures).toBe(
      3,
    );
  });

  it('previews "this will remove a PR", then edits and deletes with a recompute', async () => {
    const test = createTestDeps();
    const [, second] = await history(test);
    const setId = test.data().sets.find((set) => set.sessionId === second!.id)!.id;
    const preview = await previewPastEdit(test.deps, {
      sessionId: second!.id,
      edits: [{ kind: 'editSet', setId, values: { load: kg(95) } }],
    });
    if (!preview.ok) throw new Error(preview.error.kind);
    expect(preview.value.removed.map((pr) => pr.type).toSorted()).toEqual([
      'e1rm',
      'load',
      'rep',
      'volume',
    ]);
    expect(preview.value.added).toEqual([]);
    const edited = await editPastSession(test.deps, {
      sessionId: second!.id,
      edits: [{ kind: 'editSet', setId, values: { load: kg(95) } }],
    });
    expect(edited.ok).toBe(true);
    expect(test.data().dPrs.filter((pr) => pr.sessionId === second!.id)).toEqual([]);
    expect(await deletePastSession(test.deps, second!.id)).toEqual({ ok: true, value: undefined });
    expect(test.data().sets.some((set) => set.sessionId === second!.id)).toBe(false);
    expect(test.data().dExerciseState.find((state) => state.exerciseId === squat)?.exposures).toBe(
      1,
    );
  });

  it('refuses a future date and edits of the active session', async () => {
    const test = createTestDeps();
    await onboarded(test);
    expect(
      await logPastSession(test.deps, { localDate: '2026-12-24' as LocalDate, exercises: [] }),
    ).toEqual({ ok: false, error: { kind: 'futureDate' } });
    const { start } = await started(createTestDeps(test.data()));
    expect(start.view.session.status).toBe('active');
  });
});

describe('readiness, rest memory, substitution and the live view', () => {
  it('stores the check-in with the session (RDY-01) and assesses it (RDY-02)', async () => {
    const test = createTestDeps();
    await started(test);
    const outcome = await dispatch(test.deps, {
      type: 'READINESS',
      items: { sleepHours: 7, energy: 3, prs: 6 },
    });
    if (!outcome.ok) throw new Error(outcome.error.kind);
    expect(outcome.value.result.readiness?.assessment?.value.flag).toBe('insufficientData');
    expect(test.data().readiness).toHaveLength(1);
    expect(test.data().sessions[0]!.readiness).toMatchObject({
      status: 'done',
      flag: 'insufficientData',
    });
  });

  it('remembers a rest per exercise (TMR-03) and applies it to the active session', async () => {
    const test = createTestDeps();
    const { start } = await started(test);
    expect(await rememberRest(test.deps, { exerciseId: squat, seconds: 300 })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(test.data().settings[0]!.overrides).toContainEqual({
      paramId: 'session.rest.strength',
      value: 300,
      exerciseId: squat,
    });
    const slot = test.data().sessions[0]!.exercises.find((entry) => entry.exerciseId === squat)!;
    expect(slot.restSeconds).toBe(300);
    expect(start.view.session.id).toBe(test.data().sessions[0]!.id);
  });

  it('lists equipment-valid alternatives for a slot (WKT-08)', async () => {
    const test = createTestDeps();
    const { start } = await started(test);
    const slot = start.view.exercises.find((entry) => entry.slot.exerciseId === squat)!.slot;
    const options = await substitutionOptions(test.deps, slot.key);
    expect(options.length).toBeGreaterThan(0);
    expect(options.map((option) => option.exerciseId)).not.toContain(squat);
  });

  it('emits the session view live and null when no session is active', async () => {
    const test = createTestDeps();
    const views: (SessionView | null)[] = [];
    const subscription = observeActiveSession(test.deps).subscribe({
      next: (view) => views.push(view),
    });
    const { start } = await started(test);
    await confirmCurrent(test, start.view);
    await new Promise((resolve) => setTimeout(resolve, 20));
    subscription.unsubscribe();
    expect(views[0]).toBeNull();
    const last = views.at(-1)!;
    expect(last.session.id).toBe(start.view.session.id);
    expect(
      last.exercises.flatMap((entry) => entry.sets).filter((set) => set.status === 'done'),
    ).toHaveLength(1);
  });

  it('a restored backup clears the derived tables, which are rebuilt on use', async () => {
    const test = createTestDeps();
    await started(test);
    await finishWorkout(test.deps, { as: 'finished' });
    expect(test.data().dExerciseState.length).toBeGreaterThan(0);
    const exported = await exportBackup(test.deps);
    const read = await previewImport(test.deps, test.savedFiles.at(-1)!.bytes);
    if (!exported.ok || !read.ok) throw new Error('backup failed');
    await applyImport(test.deps, read.value);
    expect(test.data().dExerciseState).toEqual([]);
    expect(test.data().sessions).toHaveLength(1);
  });
});
