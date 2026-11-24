import { describe, expect, it } from 'vitest';

import type { ExerciseId, MuscleId, PresetId } from '@powr/domain';
import { isAvailable, itemsOf } from '@powr/domain/equipment';

import { firstRunState, setWeekStart } from '../src';
import {
  acknowledgeLegal,
  addCandidates,
  completeOnboarding,
  equipmentProfileFromPreset,
  generatePlanPreview,
  newPlanSlot,
  slotCandidates,
  type OnboardingAnswers,
} from '../src/planning';
import { createTestDeps } from './fakes';

const VERSIONS = { disclaimerVersion: '1', privacyVersion: '1' };

function answers(test: ReturnType<typeof createTestDeps>, presetId = 'preset.home-barbell-gym') {
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: presetId as PresetId,
    unit: 'kg',
    name: 'Gym',
  });
  if (!equipment.ok) throw new Error('preset missing');
  const result: OnboardingAnswers = {
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'preferNotToSay',
    referenceSet: null,
    birthYear: null,
    height: null,
    bodyweight: null,
    style: 'bodybuilding',
    phase: 'notTracking',
    experience: {
      trainingAge: 'years2To5',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: null,
    schedule: { weekdays: [1, 3, 5], sessionMinutes: 60 },
    startTimes: [],
    equipment: equipment.value,
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferredExercises: [],
    baselines: [],
    meet: null,
  };
  return result;
}

describe('first run (ONB-01, the route guard)', () => {
  it('is "legal" until the current versions are acknowledged, then "onboarding" until a profile exists', async () => {
    const test = createTestDeps();
    expect(await firstRunState(test.deps, VERSIONS)).toBe('legal');
    await acknowledgeLegal(test.deps, VERSIONS);
    expect(await firstRunState(test.deps, VERSIONS)).toBe('onboarding');
    // A changed disclaimer asks again (ONB-01).
    expect(await firstRunState(test.deps, { ...VERSIONS, disclaimerVersion: '2' })).toBe('legal');
    const done = await completeOnboarding(test.deps, { answers: answers(test), preview: null });
    expect(done.ok).toBe(true);
    expect(await firstRunState(test.deps, VERSIONS)).toBe('ready');
  });

  it('re-planning keeps the profile creation time', async () => {
    const test = createTestDeps();
    const input = answers(test);
    const first = await completeOnboarding(test.deps, { answers: input, preview: null });
    const second = await completeOnboarding(test.deps, { answers: input, preview: null });
    if (!first.ok || !second.ok) throw new Error('onboarding failed');
    const stored = await test.deps.uow.read(['profile'], (repos) => repos.profile.get());
    expect(stored?.createdAt).toEqual(first.value.profile.createdAt);
  });
});

describe('week start (SET-11)', () => {
  it('stores the user choice and returns to the locale default with null', async () => {
    const test = createTestDeps();
    await setWeekStart(test.deps, 7);
    expect(
      (await test.deps.uow.read(['settings'], (repos) => repos.settings.get()))?.weekStart,
    ).toBe(7);
    await setWeekStart(test.deps, null);
    const settings = await test.deps.uow.read(['settings'], (repos) => repos.settings.get());
    expect(settings).toMatchObject({ id: 'me', theme: 'system' });
    expect(settings && 'weekStart' in settings).toBe(false);
  });
});

/** A generated and accepted plan, with its test dependencies and equipment items. */
async function withPlan() {
  const test = createTestDeps();
  const input = answers(test);
  const preview = await generatePlanPreview(test.deps, { answers: input });
  if (!preview.ok) throw new Error(preview.error.kind);
  const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
  if (!done.ok || !done.value.plan) throw new Error('no plan');
  return { test, plan: done.value.plan, items: itemsOf(input.equipment) };
}

describe('plan editor lists (PLN-09, EQP-04)', () => {
  it('swap and add candidates are equipment-valid and ranked', async () => {
    const { test, plan, items } = await withPlan();
    const day = plan.mesocycles[0]!.days[0]!;
    const slot = day.slots[0]!;
    const swaps = await slotCandidates(test.deps, {
      planId: plan.id,
      dayKey: day.key,
      slotKey: slot.key,
    });
    expect(swaps.length).toBeGreaterThan(0);
    for (const candidate of swaps)
      expect(isAvailable(test.deps.content.exercise(candidate.exerciseId)!, items)).toBe(true);
    expect(swaps.map((entry) => entry.score)).toEqual(
      swaps.map((entry) => entry.score).toSorted((a, b) => b - a),
    );

    const adds = await addCandidates(test.deps, {
      planId: plan.id,
      muscle: 'mu.chest' as MuscleId,
    });
    expect(adds.length).toBeGreaterThan(0);
    for (const candidate of adds) {
      const exercise = test.deps.content.exercise(candidate.exerciseId)!;
      expect(isAvailable(exercise, items)).toBe(true);
      expect(
        exercise.muscles.some(
          (credit) => credit.credit === 1 && credit.muscle.startsWith('mu.chest'),
        ),
      ).toBe(true);
    }
    expect(
      await slotCandidates(test.deps, { planId: plan.id, dayKey: 'none', slotKey: 'x' }),
    ).toEqual([]);
  });

  it('a new slot gets a unique custom key, the slot minimum of sets and the exercise rest', async () => {
    const { test, plan } = await withPlan();
    const keys = plan.mesocycles[0]!.days.flatMap((day) => day.slots.map((slot) => slot.key));
    const exerciseId = (
      await addCandidates(test.deps, { planId: plan.id, muscle: 'mu.chest' as MuscleId })
    )[0]!.exerciseId;
    const slot = await newPlanSlot(test.deps, {
      planId: plan.id,
      exerciseId,
      existingKeys: [...keys, 'custom.1'],
    });
    expect(slot.ok && slot.value).toMatchObject({
      key: 'custom.2',
      exerciseId,
      goal: 'hypertrophy',
      prescription: { mode: 'doubleProgression', sets: 2 },
    });
    const missing = await newPlanSlot(test.deps, {
      planId: plan.id,
      exerciseId: 'ex.nope' as ExerciseId,
      existingKeys: keys,
    });
    expect(missing).toEqual({ ok: false, error: { kind: 'notFound' } });
  });
});
