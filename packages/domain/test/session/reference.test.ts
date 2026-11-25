/**
 * Session engine reference suite (M3a): every rule checked against the PRD's and the evidence
 * base's own numbers (PRG-04…08, PRG-11/13, WKT-03…16, TMR-01…13, RDY-02/03, MOT-01).
 */
import { describe, expect, it } from 'vitest';

import {
  addDays,
  type Baseline,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type ReadinessEntry,
  type SessionId,
} from '../../src';
import {
  calibrationStatus,
  currentE1rm,
  emptyExerciseState,
  exposurePrs,
  EMPTY_BESTS,
  foldExposure,
  rebuildExerciseState,
  reduceSession,
  seedFromBaseline,
  sessionSummary,
  sessionView,
  suggestSet,
  timerView,
  assessReadiness,
  pastSession,
  applyPastEdits,
  type ExerciseState,
} from '../../src/session';
import { rules } from '../fixtures/rules';
import {
  T0,
  at,
  context,
  epoch,
  empty,
  kg,
  libraryLookup,
  pastSet,
  plannedSession,
  run,
  slot,
  start,
} from '../fixtures/session';

const RULES = rules();
const foldInput = (id: string) => ({
  exercise: libraryLookup(id as ExerciseId)!,
  rules: RULES,
  level: 'intermediate' as const,
  bodyweightAt: () => 80,
});

/** History seeded from a baseline (ONB-08). */
function seeded(id: string, baseline: Omit<Baseline, 'exerciseId'>): ExerciseState {
  return seedFromBaseline(
    emptyExerciseState(id as ExerciseId, 'k'),
    { exerciseId: id as ExerciseId, ...baseline },
    { today: '2026-11-24' as LocalDate, fallback: '2026-11-20' as LocalDate },
    foldInput(id),
  );
}

/** History from logged sessions, one per date. */
function history(id: string, sessions: readonly (readonly LoggedSet[])[]): ExerciseState {
  return rebuildExerciseState(
    empty(id),
    sessions.map((sets) => ({
      sessionId: sets[0]!.sessionId,
      localDate: sets[0]!.localDate,
      sets,
    })),
    foldInput(id),
  ).state;
}

const squat = 'ex.back-squat';
const bench = 'ex.bench-press';

describe('suggestions (PRG-03…08)', () => {
  it('PRG-05: e1RM 150 kg, 5 @ RPE 8 → 120.9 kg → 120 kg on a 2.5 kg plate step (golden)', () => {
    const hist = { [squat]: seeded(squat, { kind: 'oneRepMax', load: kg(150), reps: 1, rir: 0 }) };
    expect(currentE1rm(hist[squat])).toBeCloseTo(150, 6);
    const ctx = context({ history: hist });
    const { state } = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('a', squat, {
            prescription: { mode: 'rpe', sets: 3, repRange: [5, 5], rir: [2, 2] },
            progression: 'rpe',
          }),
        ]),
      },
      ctx,
      { warmups: false },
    );
    const first = suggestSet(state, 'a', 's1', ctx)!;
    expect(first.value).toMatchObject({ load: kg(120), reps: 5, rir: 2, basis: 'progression' });
    const target = first.why.children[0]!;
    expect(target.rule).toBe('e1rm.loadForTarget');
    expect((target.args['total'] as { mass: { value: number } }).mass.value).toBeCloseTo(120.94, 1);
  });

  it('PRG-05 in session: a top set at RPE 9 instead of 8 lowers the back-offs by about 3%', () => {
    const hist = { [squat]: seeded(squat, { kind: 'oneRepMax', load: kg(150), reps: 1, rir: 0 }) };
    const ctx = context({ history: hist });
    const started = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('a', squat, {
            prescription: {
              mode: 'topBackoff',
              top: { repRange: [5, 5], rir: [2, 2] },
              backoff: { sets: 3, repRange: [5, 5], rir: [2, 2] },
            },
            progression: 'rpe',
          }),
        ]),
      },
      ctx,
      { warmups: false },
    );
    const { state } = run(
      started.state,
      [
        {
          type: 'CONFIRM_SET',
          slotKey: 'a',
          setKey: 's1',
          values: { load: kg(120), reps: 5, rir: 1 },
        },
      ],
      { history: hist },
    );
    const backoff = suggestSet(state, 'a', 's2', context({ history: hist }))!;
    expect(backoff.value).toMatchObject({ load: kg(117.5), basis: 'autoregulated' });
    expect(backoff.why.rule).toBe('progression.rpe.backoff');
    // Today's e1RM 120 / 83.1% = 144.4 kg; 5 @ RIR 2 → 80.6% → 116.4 kg (−3.0%).
    const total = (backoff.why.children[1]!.args['total'] as { mass: { value: number } }).mass
      .value;
    expect(total / 120).toBeCloseTo(0.97, 2);
  });

  it('PRG-04: 3 × 12 @ RIR 2–3 at 30 kg (8–12 @ RIR 2) → 32.5 kg × 8', () => {
    const curl = 'ex.curl';
    const hist = {
      [curl]: history(curl, [
        [12, 12, 12].map((reps, index) =>
          pastSet('p1', curl, index, { load: 30, reps, rir: [2, 3, 2][index]! }, '2026-11-20'),
        ),
      ]),
    };
    const ctx = context({ history: hist });
    const { state } = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('c', curl, {
            prescription: { mode: 'doubleProgression', sets: 3, repRange: [8, 12], rir: [2, 2] },
          }),
        ]),
      },
      ctx,
      { warmups: false },
    );
    expect(suggestSet(state, 'c', 's1', ctx)!.value).toMatchObject({
      load: kg(32.5),
      reps: 8,
      basis: 'progression',
    });
  });

  it('PRG-06: novice +2.5 kg on a met squat session; two misses in a row reset by 10%', () => {
    const met = (date: string, session: string, reps: number) =>
      [0, 1, 2].map((index) =>
        pastSet(session, squat, index, { load: 100, reps, rir: 2 }, date, {
          prescription: { load: kg(100), reps: 5, rir: 2 },
        }),
      );
    const linearSlot = slot('a', squat, {
      prescription: { mode: 'rpe', sets: 3, repRange: [5, 5], rir: [1, 3] },
      progression: 'linear',
    });
    const linearSlotDp = {
      ...linearSlot,
      prescription: {
        mode: 'doubleProgression' as const,
        sets: 3,
        repRange: [5, 5] as const,
        rir: [1, 3] as const,
      },
    };
    const good = { [squat]: history(squat, [met('2026-11-20', 'p1', 5)]) };
    const ctx = context({ history: good, level: 'novice' });
    const up = start({ kind: 'planned', planned: plannedSession([linearSlotDp]) }, ctx, {
      warmups: false,
    });
    expect(suggestSet(up.state, 'a', 's1', ctx)!.value).toMatchObject({ load: kg(102.5), reps: 5 });

    const stalled = {
      [squat]: history(squat, [met('2026-11-17', 'p1', 4), met('2026-11-20', 'p2', 4)]),
    };
    const ctx2 = context({ history: stalled, level: 'novice' });
    const reset = start({ kind: 'planned', planned: plannedSession([linearSlotDp]) }, ctx2, {
      warmups: false,
    });
    const suggestion = suggestSet(reset.state, 'a', 's1', ctx2)!;
    expect(suggestion.value.load).toEqual(kg(90));
    expect(suggestion.why.rule).toBe('progression.linear.stallReset');
  });

  it('PRG-08: an exercise without history calibrates at RIR 3–4, then loads from the first set', () => {
    const row = 'ex.row';
    const ctx = context();
    const started = start({ kind: 'planned', planned: plannedSession([slot('r', row)]) }, ctx);
    const first = suggestSet(started.state, 'r', 's1', ctx)!;
    expect(first.value).toMatchObject({
      load: null,
      rir: 3.5,
      rirRange: [3, 4],
      basis: 'calibration',
    });
    expect(first.why.rule).toBe('session.calibration');
    expect(first.why.args['status']).toBe('uncalibrated');
    // No working load is known, so no warm-up ramp yet (the user picks the load).
    expect(started.state.session.exercises[0]!.sets.every((set) => set.type !== 'warmup')).toBe(
      true,
    );

    const { state } = run(started.state, [
      {
        type: 'CONFIRM_SET',
        slotKey: 'r',
        setKey: 's1',
        values: { load: kg(50), reps: 10, rir: 3 },
      },
    ]);
    // 50 × 10 @ RIR 3 → r_eff 13.5 → e1RM 73.2 kg; 10 @ RIR 3.5 → 67.6% → 49.5 → 50 kg.
    const second = suggestSet(state, 'r', 's2', context())!;
    expect(second.value).toMatchObject({ load: kg(50), rir: 3.5, basis: 'autoregulated' });
  });

  it('PRG-08 state machine: one reliable exposure calibrates, a low-weight one needs a second', () => {
    const row = 'ex.row';
    const reliable = history(row, [
      [pastSet('p1', row, 0, { load: 60, reps: 8, rir: 3 }, '2026-11-20')],
    ]);
    expect(calibrationStatus(reliable, RULES)).toBe('calibrated');
    // RIR 4 (RPE 6) weighs 0.1: not reliable, a second exposure calibrates.
    const easy = history(row, [
      [pastSet('p1', row, 0, { load: 50, reps: 10, rir: 4 }, '2026-11-20')],
    ]);
    expect(calibrationStatus(easy, RULES)).toBe('calibrating');
    const twice = history(row, [
      [pastSet('p1', row, 0, { load: 50, reps: 10, rir: 4 }, '2026-11-17')],
      [pastSet('p2', row, 0, { load: 52.5, reps: 10, rir: 4 }, '2026-11-20')],
    ]);
    expect(calibrationStatus(twice, RULES)).toBe('calibrated');
    expect(calibrationStatus(null, RULES)).toBe('uncalibrated');
    expect(
      calibrationStatus(seeded(row, { kind: 'recentSet', load: kg(60), reps: 8, rir: 2 }), RULES),
    ).toBe('calibrated');
  });

  it('ONB-08 seeding: 100 kg × 4 @ RIR 2 → e1RM 120.3 kg (EB worked example)', () => {
    const state = seeded(squat, { kind: 'recentSet', load: kg(100), reps: 4, rir: 2 });
    expect(currentE1rm(state)).toBeCloseTo(120.3, 1);
    expect(state.baseline).toMatchObject({ localDate: '2026-11-20', old: false });
  });

  it('PRG-11: a deload slot loads at the middle of 85–100% of the normal load', () => {
    const hist = { [squat]: seeded(squat, { kind: 'oneRepMax', load: kg(150), reps: 1, rir: 0 }) };
    const ctx = context({ history: hist });
    const { state } = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('a', squat, {
            prescription: { mode: 'rpe', sets: 2, repRange: [5, 5], rir: [4, 4] },
            progression: 'rpe',
            loadPct: { min: 85, max: 100 },
          }),
        ]),
      },
      ctx,
      { warmups: false },
    );
    const suggestion = suggestSet(state, 'a', 's1', ctx)!;
    // Normal: 5 @ RIR 4 → r_eff 9.5 → 75.7% of 150 = 113.5 → 112.5 kg; × 92.5% = 104.1 → 105 kg.
    expect(suggestion.why.rule).toBe('session.adjustment.load');
    expect(suggestion.value.load).toEqual(kg(105));
  });

  it('WKT-06: a heavy squat at 120 kg × 5 gets the bar and 40/60/75/85% steps', () => {
    const hist = { [squat]: seeded(squat, { kind: 'oneRepMax', load: kg(150), reps: 1, rir: 0 }) };
    const ctx = context({ history: hist });
    const { state } = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('a', squat, {
            prescription: { mode: 'rpe', sets: 3, repRange: [5, 5], rir: [2, 2] },
            progression: 'rpe',
          }),
        ]),
      },
      ctx,
    );
    const warmups = state.session.exercises[0]!.sets.filter((set) => set.type === 'warmup');
    expect(warmups.map((set) => [set.load?.value, set.reps?.[0]])).toEqual([
      [20, 8],
      [47.5, 5],
      [72.5, 3],
      [90, 2],
      [102.5, 1],
    ]);
    expect(state.session.cursor).toEqual({ slotKey: 'a', setKey: 'w1' });
  });
});

describe('PR detection (MOT-01, E-1)', () => {
  const squatDef = libraryLookup(squat as ExerciseId)!;
  const first = history(squat, [
    [pastSet('p1', squat, 0, { load: 100, reps: 5, rir: 2 }, '2026-11-20')],
  ]);
  const live = (sets: LoggedSet[]) =>
    exposurePrs({
      bests: first.bests,
      firstExposure: false,
      sets,
      exercise: squatDef,
      rules: RULES,
      bodyweightKg: 80,
    });

  it('the first exposure is a milestone without PRs', () => {
    const result = foldExposure(
      empty(squat),
      {
        sessionId: 'p1' as SessionId,
        localDate: '2026-11-20' as LocalDate,
        sets: [pastSet('p1', squat, 0, { load: 100, reps: 5, rir: 2 }, '2026-11-20')],
      },
      foldInput(squat),
    );
    expect(result.prs).toEqual([]);
    expect(result.firstTimeSetId).toBe('p1-ex.back-squat-0');
  });

  it('rep, load, e1RM and volume PRs from actual sets; an equal set is no PR', () => {
    const sets = [
      pastSet('s2', squat, 0, { load: 100, reps: 5, rir: 2 }, '2026-11-24'),
      pastSet('s2', squat, 1, { load: 102.5, reps: 5, rir: 2 }, '2026-11-24'),
      pastSet('s2', squat, 2, { load: 90, reps: 8, rir: 2 }, '2026-11-24'),
    ];
    const prs = live(sets).prs.map((pr) => [pr.setId.slice(-1), pr.type, pr.reps]);
    expect(prs).toEqual([
      ['1', 'rep', 5],
      ['1', 'load', 5],
      ['1', 'e1rm', null],
      ['1', 'volume', null],
      ['2', 'rep', 8],
    ]);
    const volume = live(sets).prs.find((pr) => pr.type === 'volume')!;
    expect(volume).toMatchObject({ valueKg: 100 * 5 + 102.5 * 5 + 90 * 8, previousKg: 500 });
  });

  it('a set without effort sets rep and load PRs but never an e1RM PR (E-1)', () => {
    const prs = live([
      pastSet('s2', squat, 0, { load: 110, reps: 5, rir: null }, '2026-11-24'),
    ]).prs;
    expect(prs.map((pr) => pr.type).toSorted()).toEqual(['load', 'rep', 'volume']);
  });

  it('a low-weight set (RPE 6 at 12 reps) sets no e1RM PR; warm-ups set none at all', () => {
    expect(
      live([pastSet('s2', squat, 0, { load: 90, reps: 12, rir: 4 }, '2026-11-24')]).prs.map(
        (pr) => pr.type,
      ),
    ).not.toContain('e1rm');
    expect(
      live([pastSet('s2', squat, 0, { load: 140, reps: 5, rir: 2, type: 'warmup' }, '2026-11-24')])
        .prs,
    ).toEqual([]);
    expect(EMPTY_BESTS.reps).toEqual([]);
  });
});

describe('trend memory (TD-60)', () => {
  // 70 sessions every second day (3.5 a week), a steady +0.5% a week on heavy triples.
  const sessions = Array.from({ length: 70 }, (_, i) => {
    const localDate = addDays('2026-01-05' as LocalDate, i * 2);
    const load = Math.round(150 * 1.005 ** ((i * 2) / 7) * 2) / 2;
    return [pastSet(`t${i}`, squat, 0, { load, reps: 3, rir: 1 }, localDate)];
  });
  const rebuilt = rebuildExerciseState(
    empty(squat),
    sessions.map((sets) => ({
      sessionId: sets[0]!.sessionId,
      localDate: sets[0]!.localDate,
      sets,
    })),
    { ...foldInput(squat), level: 'advanced' },
  );

  it('keeps the last 60 trend points and recent exposures (before: 30 and 12)', () => {
    expect(rebuilt.state.points).toHaveLength(60);
    expect(rebuilt.state.recent).toHaveLength(60);
    expect(rebuilt.state.points[0]?.localDate).toBe(sessions[10]![0]!.localDate);
  });

  it("labels an advanced lifter's change against the point 12 weeks back (rules 1.7.0)", () => {
    const last = rebuilt.points.at(-1)!;
    expect(last.change?.referenceDate).toBe(addDays(last.localDate, -84));
  });
});

describe('timers (TMR-01/03/07/13)', () => {
  const planned = plannedSession([
    slot('b', bench, { restSeconds: 180 }),
    slot('r', 'ex.row', { restSeconds: 90 }),
  ]);
  const values = { load: kg(60), reps: 10, rir: 2 };

  it('a working set starts the slot rest; the last set of the session starts none', () => {
    const started = start({ kind: 'planned', planned }, context(), { warmups: false });
    const { transitions } = run(started.state, [
      { type: 'CONFIRM_SET', slotKey: 'b', setKey: 's1', values },
    ]);
    const timer = transitions[0]!.state.session.timer!;
    expect(timer).toMatchObject({
      kind: 'rest',
      mode: 'countdown',
      targetMs: 180_000,
      adjustMs: 0,
      slotKey: 'b',
    });
    expect(transitions[0]!.effects).toContainEqual({ kind: 'timer.arm', timer });

    const events = ['b', 'r'].flatMap((key) =>
      ['s1', 's2', 's3'].map((setKey) => ({
        type: 'CONFIRM_SET' as const,
        slotKey: key,
        setKey,
        values,
      })),
    );
    const done = run(started.state, events);
    expect(done.state.session.timer).toBeNull();
    expect(done.state.session.cursor).toBeNull();
  });

  it('a superset runs the 20 s transition inside a round and the longer rest after it', () => {
    const started = start({ kind: 'planned', planned }, context(), { warmups: false });
    const { transitions } = run(started.state, [
      { type: 'GROUP', kind: 'superset', slotKeys: ['b', 'r'] },
      { type: 'CONFIRM_SET', slotKey: 'b', setKey: 's1', values },
      { type: 'CONFIRM_SET', slotKey: 'r', setKey: 's1', values },
    ]);
    expect(transitions[1]!.state.session.timer).toMatchObject({
      kind: 'transition',
      targetMs: 20_000,
      slotKey: 'r',
    });
    expect(transitions[1]!.state.session.cursor).toEqual({ slotKey: 'r', setKey: 's1' });
    expect(transitions[2]!.state.session.timer).toMatchObject({ kind: 'rest', targetMs: 180_000 });
    expect(transitions[2]!.state.session.cursor).toEqual({ slotKey: 'b', setKey: 's2' });
  });

  it('count-up keeps the suggested rest as target and adds the 90 s compound soft minimum', () => {
    const started = start({ kind: 'planned', planned }, context(), { warmups: false });
    const { state } = run(
      started.state,
      [{ type: 'CONFIRM_SET', slotKey: 'b', setKey: 's1', values }],
      { preferences: { restMode: 'countup' } },
    );
    expect(state.session.timer).toMatchObject({
      mode: 'countup',
      targetMs: 180_000,
      softMinMs: 90_000,
    });
  });

  it('± 15 s re-arms the whole timer; a view is never negative', () => {
    const started = start({ kind: 'planned', planned }, context(), { warmups: false });
    const { state, transitions } = run(started.state, [
      { type: 'CONFIRM_SET', slotKey: 'b', setKey: 's1', values },
      { type: 'TIMER_ADJUST', deltaMs: 15_000 },
      { type: 'TIMER_ADJUST', deltaMs: -400_000 },
    ]);
    expect(transitions[1]!.effects).toContainEqual({
      kind: 'timer.arm',
      timer: transitions[1]!.state.session.timer,
    });
    const timer = state.session.timer!;
    expect(timer.adjustMs).toBe(-180_000);
    const view = timerView(timer, timer.startedAtEpochMs - 10_000);
    expect(view).toMatchObject({ elapsedMs: 0, remainingMs: 0, ended: true });
    expect(timerView(timer, timer.startedAtEpochMs + 42_000).overMs).toBe(42_000);
  });

  it('TMR-08: the actual rest before a set is logged with it', () => {
    const started = start({ kind: 'planned', planned }, context(), { warmups: false });
    const { state } = run(
      started.state,
      [
        { type: 'CONFIRM_SET', slotKey: 'b', setKey: 's1', values },
        { type: 'CONFIRM_SET', slotKey: 'b', setKey: 's2', values },
      ],
      { stepMs: 150_000 },
    );
    expect(state.sets.map((set) => set.restBeforeMs)).toEqual([undefined, 150_000]);
  });
});

describe('guardrails (WKT-16)', () => {
  it('RIR 0 on a barbell squat and a short rest on a competition lift raise hints', () => {
    const started = start(
      { kind: 'planned', planned: plannedSession([slot('a', squat)]) },
      context(),
      {
        warmups: false,
      },
    );
    const { transitions } = run(
      started.state,
      [
        {
          type: 'CONFIRM_SET',
          slotKey: 'a',
          setKey: 's1',
          values: { load: kg(100), reps: 5, rir: 0 },
        },
        {
          type: 'CONFIRM_SET',
          slotKey: 'a',
          setKey: 's2',
          values: { load: kg(100), reps: 5, rir: 2 },
        },
      ],
      { stepMs: 90_000 },
    );
    expect(transitions[0]!.result.hints.map((hint) => hint.kind)).toEqual(['failure']);
    const failure = transitions[0]!.result.hints[0]!.why;
    // Failure: 48–72 h instead of 24–48 h → "adds 24–48 h of recovery" (PRD WKT-16).
    expect(failure.args).toEqual({ extraHoursMin: 24, extraHoursMax: 48 });
    expect(transitions[1]!.result.hints.map((hint) => hint.kind)).toEqual(['shortRest']);
    const hintsOff = run(
      started.state,
      [
        {
          type: 'CONFIRM_SET',
          slotKey: 'a',
          setKey: 's1',
          values: { load: kg(100), reps: 5, rir: 0 },
        },
      ],
      { preferences: { hintsOff: ['failure'] } },
    );
    expect(hintsOff.transitions[0]!.result.hints).toEqual([]);
  });

  it('a muscle above ~11 fractional sets in a session gets one hint', () => {
    const started = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('a', 'ex.leg-extension', {
            prescription: { mode: 'doubleProgression', sets: 13, repRange: [10, 15], rir: [1, 2] },
          }),
        ]),
      },
      context(),
      { warmups: false },
    );
    const events = Array.from({ length: 13 }, (_, index) => ({
      type: 'CONFIRM_SET' as const,
      slotKey: 'a',
      setKey: `s${index + 1}`,
      values: { load: kg(40), reps: 12, rir: 2 },
    }));
    const { transitions } = run(started.state, events);
    const hinted = transitions.flatMap((transition, index) =>
      transition.result.hints.map((hint) => [index + 1, hint.kind, hint.muscle]),
    );
    expect(hinted).toEqual([[9, 'sessionVolume', 'mu.quads']]);
  });
});

/** A check-in on a day of November 2026. */
const entry = (day: number, items: ReadinessEntry['items']): ReadinessEntry => ({
  id: `r${day}`,
  localDate: `2026-11-${String(day).padStart(2, '0')}` as LocalDate,
  recordedAt: at(epoch(`2026-11-${String(day).padStart(2, '0')}T08:00:00Z`)),
  items,
});

describe('readiness (RDY-02/03)', () => {
  const baseline = [10, 11, 12, 13, 14, 15, 16].map((day) =>
    entry(day, { energy: day % 2 === 0 ? 4 : 3, prs: 7, sleepHours: 8 }),
  );

  it('no flag before 7 baseline entries; then z-scores against the 28-day baseline', () => {
    expect(assessReadiness(entry(17, { energy: 1 }), baseline.slice(0, 6), RULES).value.flag).toBe(
      'insufficientData',
    );
    // energy: mean 3.571, sd 0.535 → 2 gives z = −2.94; PRS (always 7) z = 0; composite −1.47.
    const low = assessReadiness(entry(17, { energy: 2, prs: 7 }), baseline, RULES).value;
    expect(low.z['energy']).toBeCloseTo(-2.94, 2);
    expect(low.composite).toBeCloseTo(-1.47, 2);
    expect(low.flag).toBe('low');
    expect(assessReadiness(entry(17, { energy: 1, prs: 7 }), baseline, RULES).value.flag).toBe(
      'modify',
    );
    const fine = assessReadiness(entry(17, { energy: 4, prs: 7 }), baseline, RULES).value;
    expect(fine.flag).toBe('none');
  });

  it('PRS ≤ 3 on two days in a row is "consider modifying"; short nights are counted', () => {
    const earlier = [...baseline, entry(17, { prs: 3, sleepHours: 5.5 })];
    const today = assessReadiness(entry(18, { prs: 2, sleepHours: 5 }), earlier, RULES).value;
    expect(today).toMatchObject({
      prsLowDays: 2,
      flag: 'modify',
      shortSleep: true,
      shortNights: 2,
    });
  });

  it('low readiness proposes +1 RIR on top sets and dropping back-offs; a short PM night trims', () => {
    const hist = { [squat]: seeded(squat, { kind: 'oneRepMax', load: kg(150), reps: 1, rir: 0 }) };
    const pm = epoch('2026-11-18T17:00:00Z');
    const started = start(
      {
        kind: 'planned',
        planned: plannedSession([
          slot('a', squat, {
            prescription: {
              mode: 'topBackoff',
              top: { repRange: [5, 5], rir: [2, 2] },
              backoff: { sets: 3, repRange: [5, 5], rir: [2, 2] },
            },
            progression: 'rpe',
          }),
        ]),
      },
      context({ history: hist, nowMs: pm }),
      { warmups: false },
    );
    const { transitions } = run(
      started.state,
      [{ type: 'READINESS', items: { energy: 2, prs: 2, sleepHours: 5 } }],
      { history: hist, nowMs: pm, readiness: [...baseline, entry(17, { prs: 3, sleepHours: 8 })] },
    );
    const outcome = transitions[0]!.result.readiness!;
    expect(outcome.assessment!.value.flag).toBe('modify');
    expect(outcome.proposals.map((proposal) => proposal.change.kind)).toEqual([
      'capTopSet',
      'dropBackoff',
      'trimVolume',
    ]);
    expect(outcome.proposals[1]!.change.dropSets).toBe(2);
    const applied = run(
      transitions[0]!.state,
      [{ type: 'APPLY_CHANGES', changes: outcome.proposals.slice(0, 2).map((p) => p.change) }],
      { history: hist, nowMs: pm },
    ).state;
    const sets = applied.session.exercises[0]!.sets;
    expect(sets.map((set) => [set.type, set.rir])).toEqual([
      ['top', [3, 3]],
      ['backoff', [2, 2]],
    ]);
  });

  it('PRG-13: a lift last trained 10 days ago gets the 8–14-day return proposal at start', () => {
    const benchHist = history(bench, [
      [pastSet('p1', bench, 0, { load: 80, reps: 5, rir: 2 }, '2026-11-14')],
    ]);
    const started = start(
      { kind: 'planned', planned: plannedSession([slot('b', bench)]) },
      context({ history: { [bench]: benchHist } }),
      { warmups: false },
    );
    const [proposal] = started.result.readiness!.proposals;
    expect(proposal!.change).toMatchObject({
      kind: 'returnFromBreak',
      slotKeys: ['b'],
      daysOff: 10,
      loadPct: { min: 90, max: 95 },
      rirAdd: 1,
    });
    expect(proposal!.why.rule).toBe('break.return.reduce');
  });
});

describe('summary and past sessions (WKT-13, WKT-15)', () => {
  it('summarises sets, volume, PRs and the e1RM change; a partial session counts at ≥ 50%', () => {
    const hist = {
      [squat]: history(squat, [
        [pastSet('p1', squat, 0, { load: 100, reps: 5, rir: 2 }, '2026-11-20')],
      ]),
    };
    const started = start(
      { kind: 'planned', planned: plannedSession([slot('a', squat)]) },
      context({ history: hist }),
      {
        warmups: false,
      },
    );
    const { state } = run(
      started.state,
      [
        {
          type: 'CONFIRM_SET',
          slotKey: 'a',
          setKey: 's1',
          values: { load: kg(105), reps: 5, rir: 2 },
        },
        {
          type: 'CONFIRM_SET',
          slotKey: 'a',
          setKey: 's2',
          values: { load: kg(105), reps: 5, rir: 1 },
        },
        { type: 'FINISH', as: 'partial' },
      ],
      { history: hist },
    );
    const summary = sessionSummary(state, context({ history: hist, nowMs: T0 + 600_000 }));
    expect(summary).toMatchObject({
      status: 'partial',
      sets: { done: 2, skipped: 0, plannedWorking: 3, doneWorking: 2 },
      countsForStreak: true,
    });
    expect(summary.prs.map((pr) => pr.type).toSorted()).toEqual(['e1rm', 'load', 'rep', 'volume']);
    expect(summary.e1rm[0]!.afterKg!).toBeGreaterThan(summary.e1rm[0]!.beforeKg!);
    expect(summary.volume.find((row) => row.muscle === 'mu.quads')).toMatchObject({
      fractional: 2,
      direct: 2,
    });
  });

  it('logs a past session and edits it; the touched exercises are reported for the recompute', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `past-${index}`);
    const logged = pastSession(
      {
        sessionId: 'past' as SessionId,
        localDate: '2026-11-10' as LocalDate,
        startedAt: at(epoch('2026-11-10T17:00:00Z')),
        versions: { engine: '0', rules: 'r', content: 'c' },
        equipmentProfileId: null,
        exercises: [
          {
            exerciseId: squat as ExerciseId,
            sets: [
              { load: kg(100), reps: 5, rir: 2 },
              { load: kg(100), reps: 5, rir: null },
            ],
          },
        ],
      },
      ids,
    );
    if (!('state' in logged)) throw new Error('not logged');
    expect(logged.state.session).toMatchObject({
      status: 'finished',
      backdated: true,
      localDate: '2026-11-10',
    });
    expect(
      logged.state.sets.map((set) => [
        set.index,
        set.performedAt.epochMs - logged.state.session.startedAt.epochMs,
      ]),
    ).toEqual([
      [0, 0],
      [1, 60_000],
    ]);
    const edited = applyPastEdits(
      logged.state,
      [
        { kind: 'editSet', setId: logged.state.sets[1]!.id, values: { reps: 6 } },
        {
          kind: 'addSet',
          exerciseId: bench as ExerciseId,
          values: { load: kg(70), reps: 8, rir: 2 },
        },
      ],
      ['edit-0'],
    );
    if (!('state' in edited)) throw new Error('not edited');
    expect(edited.touched).toEqual([squat, bench]);
    expect(edited.state.sets.map((set) => [set.exerciseId, set.reps])).toEqual([
      [squat, 5],
      [squat, 6],
      [bench, 8],
    ]);
  });
});

describe('the session view (WKT-02, TMR-11)', () => {
  it('shows the last time, the suggestion of every pending set and the remaining time', () => {
    const hist = {
      [squat]: history(squat, [
        [pastSet('p1', squat, 0, { load: 100, reps: 5, rir: 2 }, '2026-11-20')],
      ]),
    };
    const ctx = context({ history: hist });
    const started = start({ kind: 'planned', planned: plannedSession([slot('a', squat)]) }, ctx, {
      warmups: false,
    });
    const view = sessionView(started.state, ctx);
    expect(view.exercises[0]!.lastTime?.sets.map((set) => set.reps)).toEqual([5]);
    expect(view.exercises[0]!.sets.every((set) => set.suggestion !== null)).toBe(true);
    expect(view.clock.elapsedMs).toBe(0);
    // 3 sets × (10 reps × 3.5 s + 120 s rest) + 90 s transition = 555 s.
    expect(view.clock.remainingS).toBe(555);
    expect(reduceSession(started.state, { type: 'RESUME' }, ctx).result.stale).toBe(false);
  });
});
