import { describe, expect, it } from 'vitest';

import type { LocalDate, Mesocycle, MuscleId, PlanId } from '../../src';
import {
  bringDeloadForward,
  doMissedToday,
  firstWeekStart,
  generatePlan,
  materializeMesocycle,
  mergeMissed,
  missedSessions,
  moveSession,
  pauseForBreak,
  postponeDeload,
  proposeNextMesocycle,
  resumeAfterBreak,
  sessionSpacing,
  skipDeload,
  skipSession,
  swapSessions,
} from '../../src/planning';
import { day, LIBRARY, lookup, planSlot, request, TEMPLATES } from '../fixtures/planning';
import { rules } from '../fixtures/rules';

const RULES = rules();
const date = (value: string) => value as LocalDate;
const planId = 'plan-1' as PlanId;

function mesocycle(overrides: Partial<Mesocycle> = {}): Mesocycle {
  return {
    index: 0,
    startDate: date('2026-11-30'),
    accumulationWeeks: 2,
    deloadWeeks: 1,
    status: 'active',
    level: 'intermediate',
    days: [
      day('a', 1, [
        planSlot('a.press', 'ex.dumbbell-press', 4, { priority: 'primary' }),
        planSlot('a.curl', 'ex.dumbbell-curl', 3, { priority: 'secondary' }),
      ]),
      day('b', 3, [planSlot('b.row', 'ex.dumbbell-row', 4)]),
      day('c', 5, [planSlot('c.press', 'ex.dumbbell-press', 3)]),
    ],
    targets: [{ muscle: 'mu.chest' as MuscleId, sets: 12, source: 'band' }],
    liftTargets: [],
    deload: { postponed: false, skipped: false, broughtForward: false },
    ...overrides,
  };
}

let counter = 0;
const nextId = () => `s-${++counter}`;
const sessions = (from = '2026-11-30') =>
  materializeMesocycle(
    { planId, mesocycle: mesocycle(), weekStartsOn: 1, from: date(from) },
    nextId,
    RULES,
  );

describe('calendar placement (PLN-08, PLN-11)', () => {
  it('starts this week only while none of its training days has passed', () => {
    expect(firstWeekStart(date('2026-11-23'), [1, 3, 5], 1)).toBe('2026-11-23');
    expect(firstWeekStart(date('2026-11-24'), [1, 3, 5], 1)).toBe('2026-11-30');
    expect(firstWeekStart(date('2026-11-24'), [3, 5], 1)).toBe('2026-11-23');
    expect(firstWeekStart(date('2026-11-24'), [1, 3], 7)).toBe('2026-11-29');
  });

  it('places every accumulation week and the deload week on the weekdays', () => {
    const all = sessions();
    expect(all.map((session) => `${session.localDate}/${session.kind}`)).toEqual([
      '2026-11-30/regular',
      '2026-12-02/regular',
      '2026-12-04/regular',
      '2026-12-07/regular',
      '2026-12-09/regular',
      '2026-12-11/regular',
      '2026-12-14/deload',
      '2026-12-16/deload',
      '2026-12-18/deload',
    ]);
    expect(all.at(-1)!.slots[0]).toMatchObject({
      prescription: { sets: 2, rir: [3, 4] },
      loadPct: { min: 80, max: 90 },
    });
    expect(sessions('2026-12-03')).toHaveLength(7);
  });
});

describe('rescheduling (PLN-11) and breaks (PLN-12)', () => {
  it('finds missed sessions outside breaks', () => {
    const all = sessions();
    expect(missedSessions(all, date('2026-12-03'), []).map((session) => session.localDate)).toEqual(
      ['2026-11-30', '2026-12-02'],
    );
    expect(
      missedSessions(all, date('2026-12-03'), [
        { startDate: date('2026-12-01'), endDate: null },
      ]).map((session) => session.localDate),
    ).toEqual(['2026-11-30']);
  });

  it('does a missed session today and shifts the rest of the week only as needed', () => {
    const all = sessions();
    const moved = doMissedToday(all[0]!, all, date('2026-12-02'), 1);
    expect(
      moved.value.map(
        (session) => `${session.scheduledDate}->${session.localDate}@${session.revision}`,
      ),
    ).toEqual(['2026-11-30->2026-12-02@1', '2026-12-02->2026-12-03@1']);
    expect(moved.why.rule).toBe('schedule.missed.doToday');
  });

  it('skips or merges key work into the next session within the caps', () => {
    const all = sessions();
    expect(skipSession(all[0]!).value).toMatchObject({ status: 'skipped', revision: 1 });
    const merged = mergeMissed(all[0]!, all, lookup, RULES);
    const [missed, target] = merged.value!;
    expect(missed).toMatchObject({ status: 'merged', mergedInto: all[1]!.id });
    // Only the primary slot (dumbbell press, 4 sets) is key work; the curl is not merged.
    expect(target!.slots.map((slot) => slot.exerciseId)).toEqual([
      'ex.dumbbell-row',
      'ex.dumbbell-press',
    ]);
    expect(target!.adjustments).toEqual([{ kind: 'mergedWork', notes: [] }]);
    // ~8 direct sets per muscle per session: a target with 7 chest sets takes one more.
    const crowded = { ...all[1]!, slots: [planSlot('x.press', 'ex.dumbbell-press', 7)] };
    const capped = mergeMissed(all[0]!, [all[0]!, crowded], lookup, RULES);
    expect(capped.value![1]!.slots[0]!.prescription).toMatchObject({ sets: 8 });
    expect(capped.why.args['dropped']).toBe('a.press:3');
    expect(mergeMissed(all.at(-1)!, all, lookup, RULES).value).toBeNull();
  });

  it('moves and swaps sessions and reports spacing on the real days', () => {
    const all = sessions();
    expect(moveSession(all[0]!, date('2026-12-01')).value).toMatchObject({
      localDate: '2026-12-01',
      revision: 1,
    });
    const [a, b] = swapSessions(all[0]!, all[1]!).value;
    expect([a.localDate, b.localDate]).toEqual(['2026-12-02', '2026-11-30']);
    // Non-failure work needs 24 h; a high-volume session (≥ 10 sets for a muscle) 48 h.
    const light = [all[0]!, { ...all[2]!, localDate: date('2026-12-01') }];
    expect(sessionSpacing(light, lookup, RULES)).toEqual([]);
    const heavy = [
      { ...all[0]!, slots: [planSlot('a.press', 'ex.dumbbell-press', 10)] },
      light[1]!,
    ];
    expect(sessionSpacing(heavy, lookup, RULES)).toEqual([
      {
        subject: 'mu.chest',
        fromDay: all[0]!.id,
        toDay: all[2]!.id,
        gapHours: 24,
        requiredHours: 48,
      },
    ]);
  });

  it('pauses sessions in a break and ramps back in after it (PRG-13)', () => {
    const all = sessions();
    const paused = pauseForBreak(all, {
      startDate: date('2026-11-30'),
      endDate: date('2026-12-06'),
    });
    expect(paused.map((session) => session.status)).toEqual(['onBreak', 'onBreak', 'onBreak']);
    const merged = all.map((session) => paused.find((entry) => entry.id === session.id) ?? session);
    const resumed = resumeAfterBreak(merged, date('2026-12-07'), 21, RULES);
    expect(resumed.why.rule).toBe('break.return.reduce');
    expect(resumed.value[0]).toMatchObject({ localDate: '2026-12-07', status: 'planned' });
    expect(resumed.value[0]!.adjustments).toEqual([
      expect.objectContaining({ kind: 'returnFromBreak', loadPct: { min: 85, max: 90 } }),
    ]);
    expect(resumed.value.some((session) => session.status === 'onBreak')).toBe(false);
  });
});

describe('deload controls (PRG-11, PRG-12)', () => {
  it('postpones once by a week, skips with a note, or brings the deload forward', () => {
    const all = sessions();
    const postponed = postponeDeload(mesocycle(), all, planId, 1, nextId, RULES);
    expect(postponed.value!.mesocycle).toMatchObject({
      accumulationWeeks: 3,
      deload: { postponed: true },
    });
    expect(postponed.value!.changed.map((session) => session.localDate)).toEqual([
      '2026-12-21',
      '2026-12-23',
      '2026-12-25',
    ]);
    expect(postponed.value!.added.map((session) => `${session.week}/${session.kind}`)).toEqual([
      '3/regular',
      '3/regular',
      '3/regular',
    ]);
    expect(
      postponeDeload(postponed.value!.mesocycle, all, planId, 1, nextId, RULES).value,
    ).toBeNull();

    const skipped = skipDeload(mesocycle(), all);
    expect(skipped.value.changed.every((session) => session.kind === 'regular')).toBe(true);
    expect(skipped.value.mesocycle.deload.skipped).toBe(true);

    const forward = bringDeloadForward(mesocycle(), all, 2, RULES);
    expect(forward.value.changed.map((session) => `${session.week}/${session.kind}`)).toEqual([
      '2/deload',
      '2/deload',
      '2/deload',
    ]);
    expect(forward.value.removed.map((session) => session.week)).toEqual([3, 3, 3]);
    expect(forward.value.mesocycle).toMatchObject({
      accumulationWeeks: 1,
      deload: { broughtForward: true },
    });
  });
});

describe('next mesocycle (PLN-13)', () => {
  const plan = generatePlan(
    request({ style: 'powerlifting' }),
    { exercises: LIBRARY, templates: TEMPLATES },
    RULES,
  ).value!;
  const current: Mesocycle = {
    ...mesocycle(),
    accumulationWeeks: 5,
    days: plan.days.map((entry) => ({
      ...entry,
      slots: entry.slots.map((slot) => (slot.key === 'h.row' ? { ...slot, locked: true } : slot)),
    })),
    targets: plan.targets,
    liftTargets: plan.liftTargets,
  };

  it('keeps lifts and locked slots, starts on the given day and re-derives targets', () => {
    const next = proposeNextMesocycle(
      {
        current,
        request: request({ style: 'powerlifting' }),
        logged: null,
        startDate: date('2027-01-11'),
      },
      { exercises: LIBRARY, templates: TEMPLATES },
      RULES,
    ).value;
    expect(next.mesocycle).toMatchObject({
      index: 1,
      startDate: '2027-01-11',
      status: 'planned',
      accumulationWeeks: 5,
    });
    for (const [index, entry] of next.mesocycle.days.entries()) {
      for (const slot of entry.slots.filter(
        (candidate) => candidate.lift !== undefined || candidate.locked,
      )) {
        expect(slot.exerciseId).toBe(
          current.days[index]!.slots.find((other) => other.key === slot.key)!.exerciseId,
        );
      }
    }
    expect(next.notes.some((note) => note.rule === 'plan.slot.kept')).toBe(true);
  });

  it('rotates exercises between mesocycles and caps targets by logged volume × 1.2', () => {
    const bb = generatePlan(request(), { exercises: LIBRARY, templates: TEMPLATES }, RULES).value!;
    const base: Mesocycle = {
      ...mesocycle(),
      accumulationWeeks: 5,
      days: bb.days,
      targets: bb.targets,
    };
    const next = proposeNextMesocycle(
      {
        current: base,
        request: request(),
        logged: new Map([['mu.chest' as MuscleId, 5]]),
        startDate: date('2027-01-11'),
      },
      { exercises: LIBRARY, templates: TEMPLATES },
      RULES,
    ).value;
    expect(next.rotations.length).toBeGreaterThan(0);
    for (const rotation of next.rotations) expect(rotation.to).not.toBe(rotation.from);
    expect(next.mesocycle.targets.find((target) => target.muscle === 'mu.chest')).toEqual({
      muscle: 'mu.chest',
      sets: 6,
      source: 'logged',
    });
  });

  it('replaces an exercise the equipment no longer allows (EQP-05)', () => {
    const noDumbbells = new Set([...request().equipment].filter((item) => item !== 'eq.dumbbells'));
    const next = proposeNextMesocycle(
      {
        current: mesocycle(),
        request: request({ equipment: noDumbbells }),
        logged: null,
        startDate: date('2027-01-11'),
      },
      { exercises: LIBRARY, templates: TEMPLATES },
      RULES,
    ).value;
    const unavailable = next.rotations.filter((rotation) => rotation.reason === 'unavailable');
    expect(unavailable.map((rotation) => rotation.from)).toContain('ex.dumbbell-press');
    // No curl works without dumbbells in this library: it stays and the report says why.
    expect(
      next.report.issues.find((issue) => issue.why.rule === 'validate.equipment.unavailable')?.why
        .args['exercise'],
    ).toBe('ex.dumbbell-curl');
  });
});
