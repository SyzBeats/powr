import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  addDays,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type Plan,
  type SessionId,
} from '../../src';
import {
  calendarDays,
  chartAnnotations,
  compareSeries,
  e1rmSeries,
  filterSessions,
  performanceSeries,
  prHistory,
  rangeStart,
  repMaxTable,
  repsAtLoad,
  scoreBoard,
  weeklyMaxima,
  type E1rmSeriesPoint,
} from '../../src/analytics';
import { progressionPace } from '../../src/progression';
import {
  emptyExerciseState,
  exposuresOf,
  rebuildExerciseState,
  type PrRecord,
  type SessionE1rmPoint,
} from '../../src/session';
import { repRangeShift } from '../../src/trend';
import { exercise } from '../fixtures/planning';
import { rules } from '../fixtures/rules';
import { pastSet } from '../fixtures/session';

/** Test environment (no Node types in this project). */
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/*
 * Trends (ANL-02, PRG-02), the PRG-07 pace check (TD-44), the rep-max table (ANL-04), PR history
 * (ANL-05), the calendar and session list (ANL-06) and the score board (ANL-07), with the
 * evidence-base numbers: typical error 3.3% trained / 5.5% novice, "likely real" above 1 TE,
 * "very likely real" above 2.8 TE; the EB scoring cross-check table.
 */

const RULES = rules();
const BENCH = exercise('ex.bench', {
  pattern: 'horizontalPush',
  lift: 'bench',
  muscles: [['mu.chest', 1]],
});
const START = '2026-06-01' as LocalDate;

/** One exposure per entry (every 3–4 days), each `sets` sets of `reps` at the load, RIR given. */
function history(
  loads: readonly number[],
  reps = 5,
  rir: number | null = 1,
  setsPer = 3,
  repsOf: (index: number) => number = () => reps,
) {
  const sets: LoggedSet[] = [];
  const sessions = loads.map((load, index) => {
    const date = addDays(START, Math.round(index * 3.5));
    const id = `s${String(index).padStart(3, '0')}`;
    for (let n = 0; n < setsPer; n++) {
      sets.push(pastSet(id, 'ex.bench', n, { load, reps: repsOf(index), rir }, date));
    }
    return { id: id as SessionId, localDate: date };
  });
  const input = {
    exercise: BENCH,
    rules: RULES,
    level: 'intermediate' as const,
    bodyweightAt: () => 80,
  };
  const result = rebuildExerciseState(
    emptyExerciseState(BENCH.id, 'k'),
    exposuresOf(sets, sessions),
    input,
  );
  return { ...result, sets, sessions };
}

const labels = (points: readonly SessionE1rmPoint[]) =>
  points.map((point) => point.change?.label ?? null);

describe('e1RM series and the "likely real" labels (ANL-02, PRG-02)', () => {
  it('never labels a flat series a change, and labels a sustained rise beyond the noise', () => {
    const flat = history(Array.from({ length: 14 }, (_, i) => 100 + (i % 2 === 0 ? 0 : 1.25)));
    expect(
      labels(flat.points).filter((label) => label === 'likely' || label === 'veryLikely'),
    ).toEqual([]);
    // +0.9% a week for 24 weeks of typical sets (σ 9%; a trained lifter's good block): the
    // smoothed trend (which lags, intermediate process noise 1% per week) rises about 5.5–6.8%
    // against its reference (rules 1.6.0: 8 weeks back for intermediates, else the oldest point
    // after the first three): beyond 1 TE (3.3%) and 1.5 SD of its own uncertainty (likelyZ 1.5)
    // for three sessions, short of 1.96 SD. "Likely real" from week 17.
    const rising = history(Array.from({ length: 48 }, (_, i) => 100 * 1.009 ** (i / 2)));
    const last = rising.points.at(-1)!.change!;
    expect(last).toMatchObject({ label: 'likely', direction: 'up', repRange: false });
    expect(last.deltaPct).toBeGreaterThan(3.3);
    expect(last.deltaPct).toBeLessThan(2.8 * 3.3);
    expect(labels(rising.points).indexOf('likely')).toBe(34);
    // +3% a week (M4a's example): "very likely" (beyond 1.96 SD) from week 7.5. With likelyZ 1.5
    // a steady rise this fast is beyond 1.96 SD by the time it has held beyond 1.5 SD for three
    // sessions, so no "likely" comes first (with likelyZ 1: "likely" from week 6).
    const fast = history(Array.from({ length: 16 }, (_, i) => 100 * 1.03 ** (i / 2)));
    expect(fast.points.at(-1)!.change).toMatchObject({ label: 'veryLikely', direction: 'up' });
    expect(labels(fast.points).indexOf('veryLikely')).toBe(15);
    expect(labels(fast.points)).not.toContain('likely');
    // A 30% step held over ten sessions becomes "very likely real" (beyond 2.8 TE).
    const step = history([
      ...Array.from({ length: 8 }, () => 100),
      ...Array.from({ length: 10 }, () => 130),
    ]);
    const strong = step.points.filter((point) => point.change?.label === 'veryLikely');
    expect(strong.length).toBeGreaterThan(0);
    expect(
      strong.every(
        (point) => point.change!.direction === 'up' && point.change!.deltaPct > 2.8 * 3.3,
      ),
    ).toBe(true);
  });

  it('flags a change that coincides with a rep-range shift as possibly a rep-range effect (TD-26)', () => {
    // Sixteen sessions of 6s at 100 kg (e1RM 124 kg), then doubles at 125 kg (e1RM 136.2 kg): the
    // strength trend rises 8.4% while the typical reps drop by 4. (Rules 1.6.0, likelyZ 1.5: a
    // step needs a well-smoothed reference and seven sessions to beat 1.5 SD of the trend's own
    // uncertainty; doubles at 120 kg, +5.5%, no longer do within eight.)
    const loads = [
      ...Array.from({ length: 16 }, () => 100),
      ...Array.from({ length: 8 }, () => 125),
    ];
    const shifted = history(loads, 0, 1, 3, (index) => (index < 16 ? 6 : 2));
    const real = shifted.points.filter(
      (point) => point.change?.label === 'likely' || point.change?.label === 'veryLikely',
    );
    expect(real.length).toBeGreaterThan(0);
    expect(real.at(-1)!.change!.repRange).toBe(true);
    expect(
      repRangeShift(
        [
          { localDate: '2026-01-01' as LocalDate, medianReps: 10 },
          { localDate: '2026-01-05' as LocalDate, medianReps: 9 },
          { localDate: '2026-02-01' as LocalDate, medianReps: 8 },
        ],
        '2026-01-05' as LocalDate,
        RULES,
      ).value,
    ).toMatchObject({ shifted: false, medianBefore: 9.5, medianNow: 8.5 });
    // Samples that start after the reference date (the session engine keeps its latest 12; the
    // 8-week window of rules 1.6.0 can reach past them): the oldest before the latest stand in.
    const kept = [8, 8, 8, 3, 3].map((medianReps, i) => ({
      localDate: addDays('2026-03-02' as LocalDate, i * 4),
      medianReps,
    }));
    expect(repRangeShift(kept, '2026-01-05' as LocalDate, RULES).value).toMatchObject({
      shifted: true,
      medianBefore: 8,
      medianNow: 3,
    });
  });

  it('claims a change only beyond one typical error, for any series (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 900, max: 1100 }), { minLength: 3, maxLength: 24 }),
        fc.constantFrom('intermediate' as const, 'novice' as const),
        (tenths, level) => {
          const built = history(tenths.map((t) => t / 10));
          const series = e1rmSeries(
            {
              exerciseId: BENCH.id,
              points: built.points,
              prs: [],
              source: 'all',
              from: null,
              to: '2027-12-31' as LocalDate,
              level,
              weekStartsOn: 1,
            },
            RULES,
          );
          const te = RULES['load.trend.typicalErrorCv'].value[level] * 100;
          // deltaPct is (e^Δ − 1)·100, Δ the log change: every claim has |Δ| beyond one TE.
          const claimed = series.points.flatMap((point) =>
            point.change?.label === 'likely' || point.change?.label === 'veryLikely'
              ? [Math.abs(Math.log(1 + point.change.deltaPct / 100))]
              : [],
          );
          expect(claimed.every((size) => size > te / 100)).toBe(true);
        },
      ),
      { numRuns: env['CI'] ? 100 : 200 },
    );
  });

  it('builds the chart data: raw points, band, PR markers, summary, weekly maxima, comparisons', () => {
    const built = history(Array.from({ length: 16 }, (_, i) => 100 * 1.03 ** (i / 2)));
    const prs: PrRecord[] = [
      {
        id: 'x.e1rm',
        type: 'e1rm',
        exerciseId: BENCH.id,
        sessionId: 's015' as SessionId,
        setId: 'x' as never,
        localDate: built.sessions[15]!.localDate,
        reps: null,
        valueKg: 120,
        previousKg: 118,
      },
    ];
    const series = e1rmSeries(
      {
        exerciseId: BENCH.id,
        points: built.points,
        prs,
        source: 'strength',
        from: rangeStart('4w', addDays(START, 53)),
        to: addDays(START, 53),
        level: 'intermediate',
        weekStartsOn: 1,
      },
      RULES,
    );
    expect(series.aggregated).toBe(false);
    expect(series.points.every((point) => point.localDate >= addDays(START, 25))).toBe(true);
    const last = series.points.at(-1)!;
    expect(last.prs).toEqual(['e1rm']);
    expect(last.trend!.lowKg).toBeLessThan(last.trend!.e1rmKg);
    expect(last.trend!.highKg).toBeGreaterThan(last.trend!.e1rmKg);
    expect(series.summary.deltaPct).toBeGreaterThan(0);
    // +3% a week over 8 weeks: beyond 2.8 TE against the 8-week reference (rules 1.6.0). The label
    // rebuilt from the stored bands equals the one the session engine stored.
    expect(series.latest?.value.label).toBe('veryLikely');
    expect(series.latest?.value.label).toBe(built.points.at(-1)!.change!.label);
    const weekly = weeklyMaxima(series.points, 1);
    expect(weekly.length).toBeLessThan(series.points.length);
    expect(weekly.every((point) => point.rawKg !== null)).toBe(true);
    const [compared] = compareSeries([series]);
    expect(compared!.points[0]!.pct).toBe(0);
    expect(compared!.points.at(-1)!.pct).toBeCloseTo(series.summary.deltaPct!, 6);
  });

  it('aggregates ranges over a year to weekly maxima (§8.10)', () => {
    const point = (date: string, raw: number): SessionE1rmPoint => ({
      exerciseId: BENCH.id,
      sessionId: date as SessionId,
      localDate: date as LocalDate,
      e1rmKg: raw,
      weight: 1,
      strength: { e1rmKg: raw, lowKg: raw - 5, highKg: raw + 5 },
      all: { e1rmKg: raw, lowKg: raw - 5, highKg: raw + 5 },
    });
    const points = [point('2025-01-06', 100), point('2025-01-08', 104), point('2026-11-02', 110)];
    const series = e1rmSeries(
      {
        exerciseId: BENCH.id,
        points,
        prs: [],
        source: 'all',
        from: null,
        to: '2026-11-25' as LocalDate,
        level: 'intermediate',
        weekStartsOn: 1,
      },
      RULES,
    );
    expect(series.aggregated).toBe(true);
    expect(series.points.map((entry: E1rmSeriesPoint) => [entry.localDate, entry.rawKg])).toEqual([
      ['2025-01-08', 104],
      ['2026-11-02', 110],
    ]);
  });

  it('annotates mesocycles, deloads and breaks in the range', () => {
    const plan = {
      mesocycles: [
        {
          index: 0,
          startDate: '2026-09-07',
          accumulationWeeks: 4,
          deloadWeeks: 1,
          deload: { skipped: false },
        },
      ],
    } as unknown as Plan;
    expect(
      chartAnnotations(
        [plan],
        [{ startDate: '2026-10-20' as LocalDate, endDate: null }],
        '2026-09-01' as LocalDate,
        '2026-10-25' as LocalDate,
      ),
    ).toEqual([
      { kind: 'mesocycle', from: '2026-09-07', to: '2026-10-11', index: 0 },
      { kind: 'deload', from: '2026-10-05', to: '2026-10-11', index: 0 },
      { kind: 'break', from: '2026-10-20', to: '2026-10-25', index: null },
    ]);
  });

  it('gives the performance series: best set, volume load, reps at a load', () => {
    const built = history([100, 102.5], 5, 2, 3);
    const exposures = exposuresOf(built.sets, built.sessions).map((exposure) => ({ ...exposure }));
    const performance = performanceSeries(exposures, BENCH, RULES);
    expect(
      performance.map((point) => [point.volumeKg, point.topLoadKg, point.bestSet?.reps]),
    ).toEqual([
      [1500, 100, 5],
      [1537.5, 102.5, 5],
    ]);
    expect(repsAtLoad(exposures, 101).map((point) => point.reps)).toEqual([5]);
  });
});

const dayAfterStart = (n: number) => addDays(START, n);

const samples = (perWeekPct: number, count = 8) =>
  Array.from({ length: count }, (_, i) => ({
    localDate: dayAfterStart(Math.round(i * 3.5)),
    e1rmKg: 120 * (1 + perWeekPct / 100) ** ((i * 3.5) / 7),
    weight: 1,
  }));

describe('PRG-07: planned increases against the observed trend (TD-44)', () => {
  it('switches a novice whose e1RM is flat while the plan adds 2.5 kg a session', () => {
    const pace = progressionPace(
      {
        samples: samples(0),
        today: dayAfterStart(25),
        level: 'novice',
        region: 'upper',
        loadKg: 100,
      },
      RULES,
    );
    expect(pace.value.outrun).toBe(true);
    expect(pace.why.rule).toBe('progression.pace.switch');
    // The registry's upper-body novice increment (1 kg) on 100 kg, 1.96 sessions a week.
    const increment = RULES['progression.increment.noviceUpperKg'].value;
    expect(pace.value.plannedPctPerWeek).toBeCloseTo(increment * (49 / 25), 6);
  });

  it('keeps linear progression while the e1RM keeps up (within the noise)', () => {
    const pace = progressionPace(
      {
        samples: samples(5),
        today: dayAfterStart(25),
        level: 'novice',
        region: 'upper',
        loadKg: 100,
      },
      RULES,
    );
    expect(pace.value).toMatchObject({ outrun: false });
    expect(pace.value.observedPctPerWeek).toBeCloseTo(5, 0);
  });

  it('needs six exposures over half the window, and never switches advanced lifters (no increments)', () => {
    const few = progressionPace(
      {
        samples: samples(0, 3),
        today: dayAfterStart(25),
        level: 'novice',
        region: 'upper',
        loadKg: 100,
      },
      RULES,
    );
    expect(few.value.outrun).toBe(false);
    expect(few.why.args['insufficient']).toBe(true);
    // Five flat exposures switched before rules 1.8.0 (minimum 4); six are needed now (T-01).
    const five = progressionPace(
      {
        samples: samples(0, 5),
        today: dayAfterStart(25),
        level: 'novice',
        region: 'upper',
        loadKg: 100,
      },
      RULES,
    );
    expect(five.value).toMatchObject({ outrun: false, exposures: 5 });
    expect(five.why.args['insufficient']).toBe(true);
    const advanced = progressionPace(
      {
        samples: samples(0),
        today: dayAfterStart(25),
        level: 'advanced',
        region: 'upper',
        loadKg: 100,
      },
      RULES,
    );
    expect(advanced.value).toMatchObject({ outrun: false, plannedPctPerWeek: null });
  });
});

const pr = (
  id: string,
  type: PrRecord['type'],
  date: string,
  exerciseId = 'ex.bench',
): PrRecord => ({
  id,
  type,
  exerciseId: exerciseId as ExerciseId,
  sessionId: 's' as SessionId,
  setId: 'x' as never,
  localDate: date as LocalDate,
  reps: null,
  valueKg: 1,
  previousKg: null,
});

const item = (id: string, note: string, exerciseIds: string[], epochMs: number) => ({
  session: {
    id: id as SessionId,
    localDate: '2026-11-01' as LocalDate,
    status: 'finished' as const,
    origin: 'planned' as const,
    startedAt: { epochMs, offsetMin: 0, zone: 'UTC' },
    note,
  },
  exerciseIds: exerciseIds as ExerciseId[],
  doneSets: 3,
  prs: id === 'b' ? 1 : 0,
});

const names = (id: ExerciseId) => (id === 'ex.squat' ? 'Kniebeuge (Rücken)' : 'Bankdrücken');

describe('history (ANL-04, ANL-05, ANL-06)', () => {
  it('fills the rep-max table with the heaviest load for at least n reps, effort flags and e1RM', () => {
    const sets = [
      pastSet('a', 'ex.bench', 0, { load: 100, reps: 5, rir: 2 }, '2026-10-01'),
      pastSet('b', 'ex.bench', 0, { load: 110, reps: 1, rir: null }, '2026-10-05'),
      pastSet('c', 'ex.bench', 0, { load: 80, reps: 12, rir: 1 }, '2026-10-09'),
      pastSet('c', 'ex.bench', 1, { load: 60, reps: 15, rir: 0, type: 'warmup' }, '2026-10-09'),
    ];
    const table = repMaxTable(sets, BENCH, RULES);
    expect(table).toHaveLength(12);
    expect(table.map((row) => row.loadKg)).toEqual([
      110, 100, 100, 100, 100, 80, 80, 80, 80, 80, 80, 80,
    ]);
    expect(table[0]).toMatchObject({
      setReps: 1,
      effortKnown: false,
      rir: null,
      localDate: '2026-10-05',
    });
    expect(table[4]).toMatchObject({ setReps: 5, effortKnown: true, rir: 2 });
    // 100 × 5 @ RIR 2 → r_eff 7 → Wathan 80.6% → 124.0 kg.
    expect(table[4]!.e1rmKg).toBeCloseTo(100 / 0.80633, 1);
  });

  it('filters the PR history by type, exercise and date, newest first', () => {
    const all = [
      pr('1', 'rep', '2026-10-01'),
      pr('2', 'load', '2026-10-03'),
      pr('3', 'rep', '2026-10-05', 'ex.squat'),
    ];
    expect(prHistory(all).map((entry) => entry.id)).toEqual(['3', '2', '1']);
    expect(
      prHistory(all, { types: ['rep'], exerciseIds: ['ex.bench' as ExerciseId] }).map(
        (entry) => entry.id,
      ),
    ).toEqual(['1']);
    expect(
      prHistory(all, { from: '2026-10-02' as LocalDate, to: '2026-10-04' as LocalDate }).map(
        (entry) => entry.id,
      ),
    ).toEqual(['2']);
  });

  it('marks calendar days completed, partial, missed, planned, deload and break', () => {
    const days = calendarDays({
      from: '2026-11-02' as LocalDate,
      to: '2026-11-08' as LocalDate,
      today: '2026-11-05' as LocalDate,
      sessions: [
        { id: 'a' as SessionId, localDate: '2026-11-02' as LocalDate, status: 'finished' },
        {
          id: 'b' as SessionId,
          localDate: '2026-11-03' as LocalDate,
          status: 'partial',
          plannedAdjustments: ['deload'],
        },
        { id: 'c' as SessionId, localDate: '2026-11-03' as LocalDate, status: 'discarded' },
      ],
      planned: [
        {
          id: 'p1' as never,
          localDate: '2026-11-04' as LocalDate,
          status: 'planned',
          kind: 'regular',
        },
        {
          id: 'p2' as never,
          localDate: '2026-11-06' as LocalDate,
          status: 'planned',
          kind: 'deload',
        },
        {
          id: 'p3' as never,
          localDate: '2026-11-07' as LocalDate,
          status: 'onBreak',
          kind: 'regular',
        },
      ],
      breaks: [{ startDate: '2026-11-07' as LocalDate, endDate: null }],
    });
    expect(days.map((entry) => entry.states)).toEqual([
      ['completed'],
      ['partial', 'deload'],
      ['missed'],
      [],
      ['planned', 'deload'],
      ['break'],
      ['break'],
    ]);
  });

  it('searches the session list by exercise name or note, accents ignored', () => {
    const items = [
      item('a', 'Leichtes Training', ['ex.bench'], 1),
      item('b', 'Schwer', ['ex.squat'], 2),
    ];
    expect(
      filterSessions(items, { query: 'bankdrucken' }, names).map((entry) => entry.session.id),
    ).toEqual(['a']);
    expect(
      filterSessions(items, { query: 'kniebeuge rucken' }, names).map((entry) => entry.session.id),
    ).toEqual(['b']);
    expect(
      filterSessions(items, { withPrs: true }, names).map((entry) => entry.session.id),
    ).toEqual(['b']);
    expect(filterSessions(items, {}, names).map((entry) => entry.session.id)).toEqual(['b', 'a']);
  });
});

const lifts = (squat: number, bench: number, deadlift: number) => [
  { lift: 'squat' as const, exerciseId: 'ex.squat' as ExerciseId, kg: squat },
  { lift: 'bench' as const, exerciseId: 'ex.bench' as ExerciseId, kg: bench },
  { lift: 'deadlift' as const, exerciseId: 'ex.deadlift' as ExerciseId, kg: deadlift },
];

describe('the score board (ANL-07; EB §Scoring cross-check values)', () => {
  it('reproduces the EB table: male 83 kg / 700 kg and female 63 kg / 400 kg (± 0.01)', () => {
    const male = scoreBoard(
      {
        sex: 'male',
        division: 'classic',
        source: 'e1rm',
        bodyweightKg: 83,
        lifts: lifts(250, 170, 280),
        history: [],
      },
      RULES,
    );
    const score = (board: typeof male, formula: string) =>
      board.formulas.find((entry) => entry.formula === formula)!.total!;
    expect(male.totalKg).toBe(700);
    expect(score(male, 'wilks')).toBeCloseTo(467.25, 2);
    expect(score(male, 'wilks2020')).toBeCloseTo(561.15, 2);
    expect(score(male, 'dots')).toBeCloseTo(472.56, 2);
    expect(score(male, 'ipfGl')).toBeCloseTo(96.9, 2);
    expect(score(male, 'allometric')).toBeCloseTo(36.25, 2);
    const female = scoreBoard(
      {
        sex: 'female',
        division: 'classic',
        source: 'e1rm',
        bodyweightKg: 63,
        lifts: lifts(140, 80, 180),
        history: [],
      },
      RULES,
    );
    expect(score(female, 'wilks')).toBeCloseTo(429.58, 2);
    expect(score(female, 'wilks2020')).toBeCloseTo(511.45, 2);
    expect(score(female, 'dots')).toBeCloseTo(430.21, 2);
    expect(score(female, 'ipfGl')).toBeCloseTo(87.51, 2);
  });

  it('names each formula’s version and provenance; legacy and informal labels; IPF/GL single-lift gaps', () => {
    const board = scoreBoard(
      {
        sex: 'male',
        division: 'classic',
        source: 'tested',
        bodyweightKg: 83,
        lifts: lifts(250, 170, 280),
        history: [],
      },
      RULES,
    );
    const wilks = board.formulas.find((entry) => entry.formula === 'wilks')!;
    expect(wilks).toMatchObject({ version: 'wilks-original', legacy: true });
    expect(wilks.params.map((param) => param.id)).toEqual([
      'scoring.wilks.coefficients',
      'scoring.wilks.bodyweightClampKg',
    ]);
    expect(wilks.lifts.map((lift) => [lift.lift, lift.informal])).toEqual([
      ['squat', true],
      ['bench', false],
      ['deadlift', true],
    ]);
    const gl = board.formulas.find((entry) => entry.formula === 'ipfGl')!;
    expect(gl.lifts.map((lift) => lift.value === null)).toEqual([true, false, true]);
    expect(gl.version).toBe('ipf-gl-2020');
  });

  it('finds the best score over the history and says what is missing', () => {
    const board = scoreBoard(
      {
        sex: 'male',
        division: 'classic',
        source: 'e1rm',
        bodyweightKg: 90,
        lifts: lifts(250, 170, 280),
        history: [
          {
            localDate: '2026-01-01' as LocalDate,
            bodyweightKg: 83,
            lifts: { squat: 250, bench: 170, deadlift: 280 },
          },
          {
            localDate: '2026-02-01' as LocalDate,
            bodyweightKg: 83,
            lifts: { squat: 240, bench: null, deadlift: 280 },
          },
        ],
      },
      RULES,
    );
    expect(board.history).toHaveLength(1);
    expect(board.formulas.find((entry) => entry.formula === 'ipfGl')!.best).toMatchObject({
      localDate: '2026-01-01',
      totalKg: 700,
    });
    const none = scoreBoard(
      {
        sex: null,
        division: 'classic',
        source: 'e1rm',
        bodyweightKg: null,
        lifts: [],
        history: [],
      },
      RULES,
    );
    expect(none).toMatchObject({
      available: false,
      missing: ['sex', 'bodyweight', 'lifts'],
      totalKg: null,
    });
  });
});
