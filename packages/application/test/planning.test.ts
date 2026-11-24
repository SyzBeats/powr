import { describe, expect, it } from 'vitest';

import {
  MAX_DISMISSED_ISSUES,
  addDays,
  type ExerciseId,
  type LocalDate,
  type MuscleId,
  type PlanId,
  type PlannedSessionId,
  type PresetId,
  type SessionId,
  type SetId,
} from '@powr/domain';
import { isAvailable, itemsOf } from '@powr/domain/equipment';

import {
  acceptNextMesocycle,
  acceptPlan,
  acknowledgeLegal,
  applyEquipmentChange,
  bringDeloadForward,
  checkReactiveDeload,
  completeOnboarding,
  deleteEquipmentProfile,
  dismissPlanIssue,
  endBreak,
  equipmentProfileFromPreset,
  generatePlanPreview,
  isLegalAcknowledged,
  listEquipmentPresets,
  listMissedSessions,
  loadOnboardingDraft,
  moveSession,
  newCustomEquipmentItem,
  postponeDeload,
  previewEquipmentChange,
  previewPlanEdit,
  proposeNextMesocycle,
  resolveMissedSession,
  restorePlanIssues,
  saveEquipmentProfile,
  saveOnboardingDraft,
  savePlanEdit,
  setDefaultEquipmentProfile,
  skipDeload,
  startBreak,
  swapSessions,
  type OnboardingAnswers,
} from '../src/planning';
import { createTestDeps, testRules } from './fakes';

type TestDeps = ReturnType<typeof createTestDeps>;

function answers(test: TestDeps, overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: 'preset.commercial-gym' as PresetId,
    unit: 'kg',
    name: 'Gym',
  });
  if (!equipment.ok) throw new Error('preset missing');
  return {
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'male',
    referenceSet: 'male',
    birthYear: 1990,
    height: { value: 180, unit: 'cm' },
    bodyweight: { value: 82, unit: 'kg' },
    style: 'bodybuilding',
    phase: 'maintain',
    experience: {
      trainingAge: 'years2To5',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: 'intermediate',
    schedule: { weekdays: [1, 3, 5], sessionMinutes: 60 },
    startTimes: [{ weekday: 1, time: '18:00' }],
    equipment: equipment.value,
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferredExercises: [],
    baselines: [],
    meet: null,
    ...overrides,
  };
}

/** A fresh user with onboarding completed and a plan accepted (clock: Tue 2026-11-24). */
async function onboarded(overrides: Partial<OnboardingAnswers> = {}) {
  const test = createTestDeps();
  const input = answers(test, overrides);
  const preview = await generatePlanPreview(test.deps, { answers: input });
  if (!preview.ok) throw new Error(preview.error.kind);
  const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
  if (!done.ok) throw new Error(done.error.kind);
  return { ...test, input, preview: preview.value, plan: done.value.plan! };
}

describe('onboarding (ONB-01, ONB-10, ONB-12)', () => {
  it('saves the draft after each step and resumes it; an unreadable draft starts over', async () => {
    const test = createTestDeps();
    expect(await loadOnboardingDraft(test.deps)).toBeNull();
    await saveOnboardingDraft(test.deps, {
      step: 'schedule',
      answers: { style: 'powerlifting', birthYear: 1990 },
    });
    expect(await loadOnboardingDraft(test.deps)).toEqual({
      step: 'schedule',
      answers: { style: 'powerlifting', birthYear: 1990 },
    });
    await test.deps.uow.write(['meta'], (repos) =>
      repos.meta.put({ key: 'onboardingDraft', value: [1, 2] }),
    );
    expect(await loadOnboardingDraft(test.deps)).toBeNull();
  });

  it('records the legal acknowledgement per text version (ONB-01)', async () => {
    const test = createTestDeps();
    const versions = { disclaimerVersion: '1', privacyVersion: '1' };
    expect(await isLegalAcknowledged(test.deps, versions)).toBe(false);
    await acknowledgeLegal(test.deps, versions);
    expect(await isLegalAcknowledged(test.deps, versions)).toBe(true);
    expect(await isLegalAcknowledged(test.deps, { ...versions, disclaimerVersion: '2' })).toBe(
      false,
    );
  });

  it('writes profile, settings, equipment, bodyweight, meet and the plan in one go and clears the draft', async () => {
    const test = createTestDeps();
    await saveOnboardingDraft(test.deps, { step: 'plan', answers: {} });
    const input = answers(test, {
      style: 'powerlifting',
      schedule: { weekdays: [1, 3, 5], sessionMinutes: 90 },
      meet: {
        date: '2027-03-20' as LocalDate,
        weighIn: 'hours24',
        weightClass: '-83 kg',
        division: 'classic',
        federation: null,
      },
    });
    const preview = await generatePlanPreview(test.deps, { answers: input });
    if (!preview.ok) throw new Error(preview.error.kind);
    const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
    expect(done.ok).toBe(true);
    const data = test.data();
    expect(data.profile).toHaveLength(1);
    expect(data.profile[0]).toMatchObject({ style: 'powerlifting', referenceSet: 'male' });
    expect(data.settings[0]).toMatchObject({ weekStart: 1 });
    expect(data.equipmentProfiles).toEqual([
      expect.objectContaining({ id: input.equipment.id, isDefault: true }),
    ]);
    expect(data.bodyweights).toEqual([
      expect.objectContaining({ mass: { value: 82, unit: 'kg' }, localDate: '2026-11-24' }),
    ]);
    expect(data.meets).toEqual([
      expect.objectContaining({ date: '2027-03-20', weighIn: 'hours24' }),
    ]);
    expect(data.plans).toHaveLength(1);
    // Five accumulation weeks and a deload week of three days; the plan starts next Monday.
    expect(data.plannedSessions).toHaveLength(18);
    expect(data.plannedSessions.filter((session) => session.kind === 'deload')).toHaveLength(3);
    expect(data.plannedSessions.map((session) => session.localDate).toSorted()[0]).toBe(
      '2026-11-30',
    );
    expect(data.meta.find((record) => record.key === 'onboardingDraft')).toBeUndefined();
  });

  it('stamps the plan with the hashed rules version (TD-31)', async () => {
    const { plan } = await onboarded();
    expect(plan.versions.rules).toBe(testRules.version);
    expect(plan.versions.rules).toMatch(/^1\.3\.0\+[0-9a-f]{12}$/);
  });

  it('"Just let me log" stores the profile without a plan (PLN-15)', async () => {
    const test = createTestDeps();
    const done = await completeOnboarding(test.deps, { answers: answers(test), preview: null });
    expect(done.ok && done.value.plan).toBeNull();
    expect(test.data().plans).toEqual([]);
    expect(test.data().profile).toHaveLength(1);
  });

  it('refuses out-of-range answers and writes nothing', async () => {
    const test = createTestDeps();
    const bad = answers(test, {
      schedule: { weekdays: [1], sessionMinutes: 60 },
      priorities: ['mu.a', 'mu.b', 'mu.c', 'mu.d'] as MuscleId[],
    });
    expect(await completeOnboarding(test.deps, { answers: bad, preview: null })).toEqual({
      ok: false,
      error: { kind: 'invalidAnswers', fields: ['schedule.weekdays', 'priorities'] },
    });
    expect(test.data().profile).toEqual([]);
  });

  it('ramps a returning lifter back in: time off seeds the return-from-break steps (ONB-04, PRG-13)', async () => {
    const { data } = await onboarded({
      experience: {
        trainingAge: 'years2To5',
        timeOff: 'months1To2',
        rpeFamiliarity: 'some',
        recentVolume: [],
      },
    });
    const first = data().plannedSessions.toSorted((a, b) =>
      a.localDate < b.localDate ? -1 : 1,
    )[0]!;
    expect(first.adjustments).toEqual([
      expect.objectContaining({
        kind: 'returnFromBreak',
        daysOff: 56,
        loadPct: { min: 75, max: 85 },
        setsPct: { min: 50, max: 50 },
      }),
    ]);
  });
});

describe('plan preview (ONB-10, PLN-01, PLN-02)', () => {
  it('explains the template, level and schedule and passes the PLN-01 report', async () => {
    const test = createTestDeps();
    const preview = await generatePlanPreview(test.deps, {
      answers: answers(test, { schedule: { weekdays: [1, 2, 4, 5], sessionMinutes: 75 } }),
    });
    if (!preview.ok) throw new Error(preview.error.kind);
    const { proposal, why, calendar } = preview.value;
    expect(proposal.template.id).toBe('tpl.bb-upper-lower-4day');
    expect(why.rule).toBe('plan.template.default');
    expect(why.children.map((child) => child.rule)).toEqual(
      expect.arrayContaining([
        'plan.mesocycle',
        'plan.volume.target',
        'plan.schedule.weekdays',
        'plan.volume.sets',
      ]),
    );
    expect(proposal.report.ok).toBe(true);
    expect(calendar.map((day) => day.date)).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-03',
      '2026-12-04',
    ]);
    expect(preview.value.versions.rules).toBe(testRules.version);
  });

  it('is deterministic: the same answers give the same plan', async () => {
    const test = createTestDeps();
    const input = answers(test);
    const first = await generatePlanPreview(test.deps, { answers: input });
    const second = await generatePlanPreview(test.deps, { answers: input });
    expect(first.ok && second.ok && first.value.proposal).toEqual(
      second.ok && second.value.proposal,
    );
  });

  it('refuses a schedule outside 2–6 days and explains a plan that cannot be built', async () => {
    const test = createTestDeps();
    expect(
      await generatePlanPreview(test.deps, {
        answers: answers(test, { schedule: { weekdays: [1], sessionMinutes: 60 } }),
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'invalidSchedule', why: null },
    });
    const dumbbells = equipmentProfileFromPreset(test.deps, {
      presetId: 'preset.dumbbells-bench' as PresetId,
      unit: 'kg',
      name: 'DB',
    });
    if (!dumbbells.ok) throw new Error('preset');
    const result = await generatePlanPreview(test.deps, {
      answers: answers(test, { style: 'powerlifting', equipment: dumbbells.value }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.why?.rule).toBe('plan.lift.unavailable');
    expect(result.error.why?.children[0]?.rule).toBe('equipment.availability');
  });

  it('accepting a new plan ends the old one and removes its future sessions', async () => {
    const test = await onboarded();
    const preview = await generatePlanPreview(test.deps, {
      answers: answers(test, { schedule: { weekdays: [1, 2, 4, 5], sessionMinutes: 60 } }),
    });
    if (!preview.ok) throw new Error(preview.error.kind);
    const accepted = await acceptPlan(test.deps, {
      preview: preview.value,
      equipmentProfileId: test.input.equipment.id,
    });
    expect(accepted.ok).toBe(true);
    const { plans, plannedSessions } = test.data();
    expect(plans.map((plan) => plan.status).toSorted()).toEqual(['active', 'ended']);
    expect(plannedSessions.every((session) => session.planId !== test.plan.id)).toBe(true);
  });
});

describe('plan editor with live validation (PLN-09)', () => {
  it('validates an edit without writing it', async () => {
    const test = await onboarded();
    const day = test.plan.mesocycles[0]!.days[0]!;
    const before = test.data();
    const preview = await previewPlanEdit(test.deps, {
      planId: test.plan.id,
      edits: day.slots.map((slot) => ({ kind: 'removeSlot', dayKey: day.key, slotKey: slot.key })),
    });
    if (!preview.ok) throw new Error(preview.error.kind);
    expect(preview.value.days.find((entry) => entry.key === day.key)?.slots).toEqual([]);
    expect(preview.value.report.issues.length).toBeGreaterThan(
      test.preview.proposal.report.issues.length,
    );
    expect(test.data()).toEqual(before);
  });

  it('"from the next session" rebuilds the future sessions, keeping their IDs', async () => {
    const test = await onboarded();
    const day = test.plan.mesocycles[0]!.days[0]!;
    const slot = day.slots[0]!;
    const before = test
      .data()
      .plannedSessions.filter(
        (session) => session.dayKey === day.key && session.kind === 'regular',
      );
    const saved = await savePlanEdit(test.deps, {
      planId: test.plan.id,
      edits: [{ kind: 'setSets', dayKey: day.key, slotKey: slot.key, sets: 5 }],
      scope: 'nextSession',
    });
    expect(saved.ok && saved.value.plan.revision).toBe(1);
    const after = test
      .data()
      .plannedSessions.filter(
        (session) => session.dayKey === day.key && session.kind === 'regular',
      );
    expect(after.map((session) => session.id).toSorted()).toEqual(
      before.map((session) => session.id).toSorted(),
    );
    for (const session of after) {
      expect(session.revision).toBe(1);
      expect(session.slots.find((entry) => entry.key === slot.key)?.prescription).toMatchObject({
        sets: 5,
      });
    }
  });

  it('"from the next mesocycle" keeps the edited week for later and leaves the sessions alone', async () => {
    const test = await onboarded();
    const day = test.plan.mesocycles[0]!.days[0]!;
    const before = test.data().plannedSessions;
    const saved = await savePlanEdit(test.deps, {
      planId: test.plan.id,
      edits: [{ kind: 'removeSlot', dayKey: day.key, slotKey: day.slots.at(-1)!.key }],
      scope: 'nextMesocycle',
    });
    expect(saved.ok).toBe(true);
    const mesocycle = test.data().plans[0]!.mesocycles[0]!;
    expect(mesocycle.days).toEqual(test.plan.mesocycles[0]!.days);
    expect(mesocycle.next?.days.find((entry) => entry.key === day.key)?.slots).toHaveLength(
      day.slots.length - 1,
    );
    expect(test.data().plannedSessions).toEqual(before);
  });
});

describe('dismissed warnings (PLN-09)', () => {
  it('stores a dismissed warning key on the plan, once, without a new revision', async () => {
    const test = await onboarded();
    expect(test.plan.dismissedIssues).toEqual([]);
    const warning = test.preview.proposal.report.issues.find(
      (issue) => issue.severity === 'warning',
    )!;
    const input = { planId: test.plan.id, key: warning.key };
    expect(await dismissPlanIssue(test.deps, input)).toEqual({ ok: true, value: undefined });
    expect(await dismissPlanIssue(test.deps, input)).toEqual({ ok: true, value: undefined });
    const stored = test.data().plans[0]!;
    expect(stored.dismissedIssues).toEqual([warning.key]);
    expect(stored.revision).toBe(test.plan.revision);

    // Edits keep the list; the keys encode the plan state, so a changed warning shows again.
    const day = stored.mesocycles[0]!.days[0]!;
    await savePlanEdit(test.deps, {
      planId: test.plan.id,
      edits: [{ kind: 'setSets', dayKey: day.key, slotKey: day.slots[0]!.key, sets: 5 }],
      scope: 'nextSession',
    });
    expect(test.data().plans[0]!.dismissedIssues).toEqual([warning.key]);

    expect(await restorePlanIssues(test.deps, { planId: test.plan.id })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(test.data().plans[0]).toMatchObject({ dismissedIssues: [], revision: 1 });
  });

  it('keeps the newest keys within the limit and refuses an unknown plan', async () => {
    const test = await onboarded();
    for (let index = 0; index <= MAX_DISMISSED_ISSUES; index++)
      await dismissPlanIssue(test.deps, { planId: test.plan.id, key: `test:${index}` });
    const kept = test.data().plans[0]!.dismissedIssues;
    expect(kept).toHaveLength(MAX_DISMISSED_ISSUES);
    expect(kept[0]).toBe('test:1');
    expect(kept.at(-1)).toBe(`test:${MAX_DISMISSED_ISSUES}`);

    const unknown = 'missing' as PlanId;
    expect(await dismissPlanIssue(test.deps, { planId: unknown, key: 'k' })).toEqual({
      ok: false,
      error: { kind: 'notFound' },
    });
    expect(await restorePlanIssues(test.deps, { planId: unknown })).toEqual({
      ok: false,
      error: { kind: 'notFound' },
    });
  });
});

describe('equipment profiles (EQP-02…05, EQP-07, TD-29)', () => {
  it('turns a preset into a profile with its load inventory', () => {
    const test = createTestDeps();
    expect(listEquipmentPresets(test.deps).map((preset) => preset.id)).toContain(
      'preset.home-barbell-gym',
    );
    const home = equipmentProfileFromPreset(test.deps, {
      presetId: 'preset.home-barbell-gym' as PresetId,
      unit: 'lb',
      name: 'Garage',
    });
    if (!home.ok) throw new Error('preset');
    expect(home.value).toMatchObject({
      unit: 'lb',
      bars: [{ item: 'eq.barbell-olympic', weight: { value: 45, unit: 'lb' } }],
      plates: expect.arrayContaining([{ weight: 45, pairs: 4 }]),
      dumbbells: { from: 5, to: 50, step: 5 },
      collarWeight: 0,
    });
    expect(
      equipmentProfileFromPreset(test.deps, {
        presetId: 'preset.nope' as PresetId,
        unit: 'kg',
        name: 'x',
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'unknownPreset' },
    });
  });

  it('saves, switches the default and deletes only what is safe to delete', async () => {
    const test = await onboarded();
    const hotel = equipmentProfileFromPreset(test.deps, {
      presetId: 'preset.hotel-gym' as PresetId,
      unit: 'kg',
      name: 'Hotel',
    });
    if (!hotel.ok) throw new Error('preset');
    const item = newCustomEquipmentItem(test.deps, ' Sandbag ');
    expect(item).toMatchObject({ name: 'Sandbag', id: expect.stringMatching(/^ce\./) });
    expect(
      await saveEquipmentProfile(test.deps, { ...hotel.value, name: ' ', isDefault: false }),
    ).toEqual({
      ok: false,
      error: { kind: 'invalid', fields: ['name'] },
    });
    await saveEquipmentProfile(test.deps, {
      ...hotel.value,
      isDefault: false,
      customItems: [item],
    });
    expect(
      test
        .data()
        .equipmentProfiles.filter((profile) => profile.isDefault)
        .map((profile) => profile.id),
    ).toEqual([test.input.equipment.id]);
    await setDefaultEquipmentProfile(test.deps, hotel.value.id);
    expect(
      test
        .data()
        .equipmentProfiles.filter((profile) => profile.isDefault)
        .map((profile) => profile.id),
    ).toEqual([hotel.value.id]);
    expect(await deleteEquipmentProfile(test.deps, test.input.equipment.id)).toEqual({
      ok: false,
      error: { kind: 'inUse' },
    });
    expect(await deleteEquipmentProfile(test.deps, hotel.value.id)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(await deleteEquipmentProfile(test.deps, test.input.equipment.id)).toEqual({
      ok: false,
      error: { kind: 'lastProfile' },
    });
  });

  it('lists the plan exercises a change breaks, with available substitutes, and applies them (EQP-05)', async () => {
    const test = await onboarded();
    const withoutBarbells = {
      ...test.input.equipment,
      items: test.input.equipment.items.filter(
        (id) => !id.startsWith('eq.barbell') && id !== 'eq.ez-bar' && id !== 'eq.trap-bar',
      ),
    };
    const impact = await previewEquipmentChange(test.deps, withoutBarbells);
    expect(impact.affected.length).toBeGreaterThan(0);
    for (const slot of impact.affected) {
      expect(slot.missing.allOf.length + slot.missing.anyOf.length).toBeGreaterThan(0);
      for (const candidate of slot.substitutes) {
        expect(
          isAvailable(test.deps.content.exercise(candidate.exerciseId)!, itemsOf(withoutBarbells)),
        ).toBe(true);
      }
    }
    const substitutions = impact.affected.flatMap((slot) =>
      slot.substitutes[0]
        ? [
            {
              dayKey: slot.dayKey,
              slotKey: slot.slotKey,
              exerciseId: slot.substitutes[0].exerciseId,
            },
          ]
        : [],
    );
    expect(
      await applyEquipmentChange(test.deps, { profile: withoutBarbells, substitutions }),
    ).toEqual({ ok: true, value: undefined });
    const days = test.data().plans[0]!.mesocycles[0]!.days;
    for (const { dayKey, slotKey, exerciseId } of substitutions) {
      expect(
        days.find((day) => day.key === dayKey)?.slots.find((slot) => slot.key === slotKey)
          ?.exerciseId,
      ).toBe(exerciseId);
    }
  });
});

const byDate = (test: TestDeps) =>
  test.data().plannedSessions.toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1));

describe('scheduling (PLN-11, PLN-12)', () => {
  it('moves and swaps sessions and reports spacing on the new days', async () => {
    const test = await onboarded();
    const [first, second] = byDate(test);
    const moved = await moveSession(test.deps, {
      sessionId: first!.id,
      date: addDays(second!.localDate, 0),
    });
    if (!moved.ok) throw new Error(moved.error.kind);
    expect(moved.value.changed[0]).toMatchObject({ localDate: second!.localDate, revision: 1 });
    expect(moved.value.spacing.length).toBeGreaterThan(0);
    const swapped = await swapSessions(test.deps, { a: first!.id, b: second!.id });
    expect(swapped.ok).toBe(true);
    expect(
      await moveSession(test.deps, {
        sessionId: 'nope' as PlannedSessionId,
        date: second!.localDate,
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'notFound' },
    });
  });

  it('offers missed sessions and resolves them by moving, skipping or merging, never silently', async () => {
    const test = await onboarded();
    test.advanceDays(9); // Thu 2026-12-03: Monday's and Wednesday's sessions have passed.
    const missed = await listMissedSessions(test.deps);
    expect(missed.map((session) => session.localDate)).toEqual(['2026-11-30', '2026-12-02']);
    const today = await resolveMissedSession(test.deps, {
      sessionId: missed[1]!.id,
      choice: 'doToday',
    });
    if (!today.ok) throw new Error(today.error.kind);
    // Wednesday's session moves to today; Friday's stays, a day later (the week shifts only as needed).
    expect(
      today.value.changed.map((session) => [session.scheduledDate, session.localDate]),
    ).toEqual([['2026-12-02', '2026-12-03']]);
    const merged = await resolveMissedSession(test.deps, {
      sessionId: missed[0]!.id,
      choice: 'merge',
    });
    if (!merged.ok) throw new Error(merged.error.kind);
    expect(merged.value.changed[0]).toMatchObject({
      status: 'merged',
      mergedInto: merged.value.changed[1]!.id,
    });
    expect(merged.value.changed[1]!.adjustments.map((adjustment) => adjustment.kind)).toContain(
      'mergedWork',
    );
    expect(await listMissedSessions(test.deps)).toEqual([]);
  });

  it('pauses sessions inside a break and ramps back in when it ends (PRG-13)', async () => {
    const test = await onboarded();
    const started = await startBreak(test.deps, {
      startDate: '2026-11-30' as LocalDate,
      reason: 'vacation',
      note: 'Beach',
    });
    if (!started.ok) throw new Error(started.error.kind);
    expect(started.value.paused).toBe(18);
    test.advanceDays(20); // Mon 2026-12-14
    expect(await listMissedSessions(test.deps)).toEqual([]);
    const ended = await endBreak(test.deps, { breakId: started.value.entry.id });
    if (!ended.ok) throw new Error(ended.error.kind);
    expect(ended.value.daysOff).toBe(15);
    expect(ended.value.adjusted.why.rule).toBe('break.return.reduce');
    const resumed = byDate(test).filter((session) => session.status === 'planned');
    expect(resumed[0]).toMatchObject({ localDate: '2026-12-14' });
    expect(resumed[0]!.adjustments.at(-1)).toMatchObject({
      kind: 'returnFromBreak',
      loadPct: { min: 85, max: 90 },
    });
  });
});

describe('deloads (PRG-11, PRG-12)', () => {
  it('postpones the deload once per mesocycle, or skips it', async () => {
    const test = await onboarded();
    expect((await postponeDeload(test.deps, test.plan.id)).ok).toBe(true);
    const deloads = test.data().plannedSessions.filter((session) => session.kind === 'deload');
    expect(deloads.map((session) => session.week)).toEqual([7, 7, 7]);
    expect(test.data().plannedSessions).toHaveLength(21);
    const again = await postponeDeload(test.deps, test.plan.id);
    expect(!again.ok && again.error.kind).toBe('notAllowed');
    expect((await skipDeload(test.deps, test.plan.id)).ok).toBe(true);
    expect(test.data().plannedSessions.filter((session) => session.kind === 'deload')).toEqual([]);
  });

  it('proposes an earlier deload only for two signals, and moves it without adding one', async () => {
    const test = await onboarded({
      style: 'powerlifting',
      schedule: { weekdays: [1, 3, 5], sessionMinutes: 90 },
    });
    const squat = 'ex.barbell-back-squat' as ExerciseId;
    // Three sessions with a falling squat top set: 140×5, 137.5×5, 135×5 @ RIR 2.
    test.data();
    await test.deps.uow.write(['sets'], async (repos) => {
      for (const [index, load] of [140, 137.5, 135].entries()) {
        await repos.sets.add({
          id: `set-${index}` as SetId,
          sessionId: `session-${index}` as SessionId,
          exerciseId: squat,
          index: 0,
          type: 'working',
          load: { value: load, unit: 'kg' },
          reps: 5,
          effort: { rir: 2, source: 'entered' },
          state: 'done',
          performedAt: {
            epochMs: Date.parse(`2026-12-0${index + 1}T18:00:00Z`),
            offsetMin: 60,
            zone: 'Europe/Zurich',
          },
          localDate: `2026-12-0${index + 1}` as LocalDate,
        });
      }
    });
    test.advanceDays(10);
    const one = await checkReactiveDeload(test.deps, { planId: test.plan.id });
    expect(one.ok && one.value).toMatchObject({ propose: false, signals: ['performanceDecline'] });
    const two = await checkReactiveDeload(test.deps, { planId: test.plan.id, lowReadinessDays: 3 });
    if (!two.ok) throw new Error(two.error.kind);
    expect(two.value).toMatchObject({
      propose: true,
      signals: ['performanceDecline', 'lowReadiness'],
      week: 2,
    });
    await bringDeloadForward(test.deps, { planId: test.plan.id, week: two.value.week! });
    const sessions = test.data().plannedSessions;
    expect(
      sessions.filter((session) => session.kind === 'deload').map((session) => session.week),
    ).toEqual([2, 2, 2]);
    expect(Math.max(...sessions.map((session) => session.week))).toBe(2);
  });
});

describe('next mesocycle (PLN-13)', () => {
  it('rotates exercises, keeps competition lifts and starts after the deload', async () => {
    const test = await onboarded({
      style: 'powerbuilding',
      schedule: { weekdays: [1, 2, 4, 5], sessionMinutes: 75 },
    });
    const proposed = await proposeNextMesocycle(test.deps, test.plan.id);
    if (!proposed.ok) throw new Error(proposed.error.kind);
    const { mesocycle, rotations, report } = proposed.value.proposal;
    expect(mesocycle).toMatchObject({ index: 1, startDate: '2027-01-11', status: 'planned' });
    expect(rotations.length).toBeGreaterThan(0);
    const current = test.plan.mesocycles[0]!;
    for (const day of mesocycle.days) {
      for (const slot of day.slots.filter((entry) => entry.lift !== undefined)) {
        const before = current.days
          .find((entry) => entry.key === day.key)
          ?.slots.find((entry) => entry.key === slot.key);
        expect(slot.exerciseId).toBe(before?.exerciseId);
      }
    }
    expect(report.ok).toBe(true);
    const accepted = await acceptNextMesocycle(test.deps, proposed.value);
    expect(accepted.ok && accepted.value.sessions).toBe(24);
    expect(test.data().plans[0]!.mesocycles.map((entry) => entry.status)).toEqual([
      'completed',
      'active',
    ]);
  });
});
