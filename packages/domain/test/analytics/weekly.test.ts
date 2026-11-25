import * as fc from 'fast-check';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import {
  SESSION_DEFAULTS,
  addDays,
  daysBetween,
  epochDay,
  fromEpochDay,
  weekStartOf,
  type ExerciseDef,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type MuscleId,
  type PlannedSession,
  type Session,
  type SessionId,
} from '../../src';
import {
  HEAT_STEPS,
  averageWeeks,
  buildWeek,
  heatStep,
  plannedRemainder,
  volumeRows,
  type TaxonomyGroup,
  type WeeklyContext,
} from '../../src/analytics';
import { creditTable, setCredit } from '../../src/volume';
import { exercise } from '../fixtures/planning';
import { rules } from '../fixtures/rules';
import { at, epoch, kg, pastSet } from '../fixtures/session';

/** Test environment (no Node types in this project). */
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/*
 * The derived week (dWeekly, TD-43) and the volume rows (ANL-03, MAP-04): the EB counting
 * examples, technique credits, PLN-03 heavy sets and tonnage, sessions and minutes, the heat
 * steps against the target band, and a property that the week equals the sum of its sets'
 * credits (one calculation with the session summary and the plan editor).
 */

const RULES = rules();

const LIBRARY: readonly ExerciseDef[] = [
  exercise('ex.curl', {
    pattern: 'elbowFlexion',
    mechanics: 'isolation',
    muscles: [['mu.biceps', 1]],
  }),
  exercise('ex.row', {
    pattern: 'horizontalPull',
    muscles: [
      ['mu.mid-back', 1],
      ['mu.biceps', 0.5],
    ],
  }),
  exercise('ex.bench', {
    pattern: 'horizontalPush',
    lift: 'bench',
    muscles: [
      ['mu.chest.sternocostal', 1],
      ['mu.triceps', 0.5],
    ],
  }),
  exercise('ex.close-grip-bench', {
    pattern: 'horizontalPush',
    variantOf: 'ex.bench',
    muscles: [
      ['mu.chest', 0.5],
      ['mu.triceps', 1],
    ],
  }),
  exercise('ex.squat', {
    pattern: 'squat',
    lift: 'squat',
    muscles: [
      ['mu.quads.vasti', 1],
      ['mu.glutes', 0.5],
    ],
  }),
];
const lookup = (id: ExerciseId) => LIBRARY.find((entry) => entry.id === id);
const CTX: WeeklyContext = { exercise: lookup, rules: () => RULES };

const MONDAY = '2026-11-23' as LocalDate;

function session(id: string, localDate: string, extra: Partial<Session> = {}): Session {
  const start = epoch(`${localDate}T17:00:00Z`);
  return {
    id: id as SessionId,
    localDate: localDate as LocalDate,
    startedAt: at(start),
    endedAt: at(start + 60 * 60_000),
    status: 'finished',
    versions: { engine: 'test', rules: 'test', content: 'test' },
    ...SESSION_DEFAULTS,
    ...extra,
  };
}

function sets(
  sessionId: string,
  date: string,
  exerciseId: string,
  specs: readonly {
    load: number | null;
    reps: number;
    rir: number | null;
    type?: LoggedSet['type'];
  }[],
  extra: Partial<LoggedSet> = {},
): LoggedSet[] {
  return specs.map((values, index) => pastSet(sessionId, exerciseId, index, values, date, extra));
}

const five = (load: number, reps: number, rir: number | null) =>
  Array.from({ length: 5 }, () => ({ load, reps, rir }));

const planned = (
  id: string,
  status: PlannedSession['status'],
  kind: PlannedSession['kind'] = 'regular',
) => ({ id, status, kind, localDate: '2026-11-27', slots: [] }) as unknown as PlannedSession;

describe('the derived week (dWeekly)', () => {
  it('counts 5 curls + 5 rows as 7.5 fractional and 5 direct biceps sets (EB worked example)', () => {
    const record = buildWeek(
      {
        weekStart: MONDAY,
        key: 'k',
        sessions: [
          {
            session: session('s1', '2026-11-24'),
            sets: [
              ...sets('s1', '2026-11-24', 'ex.curl', five(15, 10, 2)),
              ...sets('s1', '2026-11-24', 'ex.row', five(60, 10, 2)),
            ],
          },
        ],
        planned: [],
        breaks: [],
        targets: null,
      },
      CTX,
    );
    const biceps = record.muscles.find((row) => row.muscle === ('mu.biceps' as MuscleId));
    expect(biceps).toEqual({ muscle: 'mu.biceps', fractional: 7.5, direct: 5 });
    expect(record.exercises.map((row) => [row.exerciseId, row.sets, row.volumeKg])).toEqual([
      ['ex.curl', 5, 750],
      ['ex.row', 5, 3000],
    ]);
  });

  it('credits techniques (a drop set with 2 drops = 2 sets) and skips warm-ups, skipped and easy sets', () => {
    const date = '2026-11-25';
    const record = buildWeek(
      {
        weekStart: MONDAY,
        key: 'k',
        sessions: [
          {
            session: session('s1', date),
            sets: [
              ...sets('s1', date, 'ex.curl', [{ load: 10, reps: 12, rir: 1 }], {
                technique: { kind: 'drop', units: 2 },
              }),
              ...sets('s1', date, 'ex.curl', [{ load: 5, reps: 15, rir: null, type: 'warmup' }], {
                id: 'w' as never,
              }),
              ...sets('s1', date, 'ex.curl', [{ load: 10, reps: 10, rir: 5 }], {
                id: 'easy' as never,
              }),
              ...sets('s1', date, 'ex.curl', [{ load: 10, reps: 10, rir: 2 }], {
                id: 'skip' as never,
                state: 'skipped',
              }),
            ],
          },
        ],
        planned: [],
        breaks: [],
        targets: null,
      },
      CTX,
    );
    expect(record.muscles.find((row) => row.muscle === ('mu.biceps' as MuscleId))?.fractional).toBe(
      2,
    );
  });

  it('counts PLN-03 heavy sets (≥ 80% 1RM, ≤ 6 reps) and tonnage per lift, close variants included', () => {
    const date = '2026-11-26';
    const record = buildWeek(
      {
        weekStart: MONDAY,
        key: 'k',
        sessions: [
          {
            session: session('s1', date),
            sets: [
              // 5 @ RIR 2: r_eff 7, Wathan 80.6% → heavy; 6 @ RIR 1: r_eff 7 → heavy.
              ...sets('s1', date, 'ex.bench', [
                { load: 100, reps: 5, rir: 2 },
                { load: 100, reps: 6, rir: 1 },
                // 8 reps: above 6 → not heavy; 5 without effort: prior RIR 2 → heavy;
                // 6 without effort: r_eff 8, 78.3% → not heavy.
                { load: 80, reps: 8, rir: 2 },
                { load: 100, reps: 5, rir: null },
                { load: 95, reps: 6, rir: null },
              ]),
              ...sets('s1', date, 'ex.close-grip-bench', [{ load: 90, reps: 5, rir: 2 }]),
              ...sets('s1', date, 'ex.bench', [{ load: 60, reps: 5, rir: null, type: 'warmup' }], {
                id: 'wu' as never,
              }),
            ],
          },
        ],
        planned: [],
        breaks: [],
        targets: null,
      },
      CTX,
    );
    expect(record.lifts).toEqual([
      { lift: 'bench', heavySets: 4, sets: 6, tonnageKg: 500 + 600 + 640 + 500 + 570 + 450 },
    ]);
  });

  it('summarises sessions (finished, partial, counting, minutes) and the planned sessions', () => {
    const partialSlot = {
      key: 'a',
      exerciseId: 'ex.curl' as ExerciseId,
      origin: 'plan' as const,
      goal: 'hypertrophy' as const,
      priority: 'primary' as const,
      progression: 'doubleProgression' as const,
      prescription: null,
      sets: [1, 2, 3, 4].map((n) => ({
        key: `s${n}`,
        type: 'working' as const,
        reps: [8, 12] as const,
        rir: null,
        load: null,
      })),
      restSeconds: null,
      skipped: false,
    };
    const record = buildWeek(
      {
        weekStart: MONDAY,
        key: 'k',
        sessions: [
          { session: session('s1', '2026-11-24'), sets: [] },
          {
            session: session('s2', '2026-11-26', { status: 'partial', exercises: [partialSlot] }),
            sets: sets('s2', '2026-11-26', 'ex.curl', [{ load: 10, reps: 10, rir: 2 }]),
          },
          { session: session('s3', '2026-11-27', { status: 'discarded' }), sets: [] },
        ],
        planned: [
          planned('p1', 'done'),
          planned('p2', 'skipped'),
          planned('p3', 'onBreak'),
          planned('p4', 'planned', 'deload'),
        ],
        breaks: [{ startDate: '2026-11-28' as LocalDate, endDate: null }],
        targets: null,
      },
      CTX,
    );
    expect(record.sessions).toEqual({
      finished: 1,
      partial: 1,
      counting: 1,
      minutes: 120,
      ids: ['s1', 's2'],
    });
    expect(record.planned).toEqual({
      asked: 3,
      done: 1,
      skipped: 1,
      open: 1,
      onBreak: 1,
      merged: 0,
      deload: true,
    });
    expect(record.breakDays).toBe(2);
  });

  it('equals the sum of its sets’ credits per muscle (property: one calculation)', () => {
    const exerciseIds = LIBRARY.map((entry) => entry.id);
    const setArb = fc.record({
      exercise: fc.constantFrom(...exerciseIds),
      session: fc.integer({ min: 0, max: 3 }),
      reps: fc.integer({ min: 1, max: 30 }),
      rir: fc.option(
        fc.integer({ min: 0, max: 8 }).map((n) => n / 2),
        { nil: null },
      ),
      type: fc.constantFrom('working', 'warmup', 'top', 'backoff', 'amrap') as fc.Arbitrary<
        LoggedSet['type']
      >,
      skipped: fc.boolean(),
      drops: fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }),
    });
    fc.assert(
      fc.property(fc.array(setArb, { maxLength: 40 }), (specs) => {
        const all = specs.map((spec, index): LoggedSet => ({
          ...pastSet(
            `s${spec.session}`,
            spec.exercise,
            index,
            { load: 50, reps: spec.reps, rir: spec.rir, type: spec.type },
            '2026-11-24',
          ),
          id: `set-${index}` as never,
          ...(spec.skipped ? { state: 'skipped' as const } : {}),
          ...(spec.drops === null
            ? {}
            : { technique: { kind: 'drop' as const, units: spec.drops } }),
        }));
        const record = buildWeek(
          {
            weekStart: MONDAY,
            key: 'k',
            sessions: [0, 1, 2, 3].map((n) => ({
              session: session(`s${n}`, '2026-11-24'),
              sets: all.filter((set) => set.sessionId === `s${n}`),
            })),
            planned: [],
            breaks: [],
            targets: null,
          },
          CTX,
        );
        // Reference: Σ set credit × the exercise's rolled-up credit, set by set.
        const expected = new Map<string, { fractional: number; direct: number }>();
        for (const set of all) {
          if (set.state !== 'done') continue;
          const credit = setCredit(set, RULES).value;
          if (credit === 0) continue;
          for (const [muscle, value] of creditTable(lookup(set.exerciseId)!.muscles)) {
            if (value === 0) continue;
            const total = expected.get(muscle) ?? { fractional: 0, direct: 0 };
            total.fractional += credit * value;
            if (value === 1) total.direct += credit;
            expected.set(muscle, total);
          }
        }
        expect(record.muscles.length).toBe(expected.size);
        for (const row of record.muscles) {
          expect(row.fractional).toBeCloseTo(expected.get(row.muscle)!.fractional, 9);
          expect(row.direct).toBeCloseTo(expected.get(row.muscle)!.direct, 9);
        }
      }),
      { numRuns: env['CI'] ? 150 : 300 },
    );
  });
});

const week = (count: number) => ({
  muscles: [{ muscle: 'mu.chest' as MuscleId, fractional: count, direct: count }],
  exercises: [],
  targets: null,
});

describe('volume rows and the heat map (ANL-03, MAP-04, MAP-07 data)', () => {
  const GROUPS: TaxonomyGroup[] = [
    {
      id: 'mu.chest' as MuscleId,
      optional: false,
      bodyMap: { front: 'front.chest' },
      subRegions: [
        { id: 'mu.chest.sternocostal' as MuscleId, bodyMap: { front: 'front.chest.sternocostal' } },
      ],
    },
    {
      id: 'mu.biceps' as MuscleId,
      optional: false,
      bodyMap: { front: 'front.biceps' },
      subRegions: [],
    },
    {
      id: 'mu.triceps' as MuscleId,
      optional: false,
      bodyMap: { back: 'back.triceps' },
      subRegions: [],
    },
    {
      id: 'mu.glutes' as MuscleId,
      optional: false,
      bodyMap: { back: 'back.glutes' },
      subRegions: [],
    },
  ];
  const bands = RULES['volume.hypertrophy.weeklyBands'].value;

  it('steps the heat map against the target band: none, below floor, below target, in, high, very high', () => {
    const band = { low: 10, high: 20 };
    expect(
      [0, 3, 8, 10, 20, 25, 31].map((count) => HEAT_STEPS[heatStep(count, band, bands)]),
    ).toEqual(['none', 'belowFloor', 'belowTarget', 'inTarget', 'inTarget', 'high', 'veryHigh']);
    // A maintenance target of 4 makes 4 sets "in target".
    expect(HEAT_STEPS[heatStep(4, { low: 4, high: 20 }, bands)]).toBe('inTarget');
  });

  it('rows per display group with the plan target, status, regions, sub-regions, contributors and the planned remainder', () => {
    const rows = volumeRows(
      {
        record: {
          muscles: [
            { muscle: 'mu.chest' as MuscleId, fractional: 12, direct: 12 },
            { muscle: 'mu.chest.sternocostal' as MuscleId, fractional: 12, direct: 12 },
            { muscle: 'mu.triceps' as MuscleId, fractional: 6, direct: 0 },
            { muscle: 'mu.biceps' as MuscleId, fractional: 22, direct: 22 },
          ],
          exercises: [
            { exerciseId: 'ex.bench' as ExerciseId, sets: 12, workingSets: 12, volumeKg: 6000 },
          ],
          targets: {
            planId: 'p' as never,
            mesocycleIndex: 0,
            muscles: [
              { muscle: 'mu.chest' as MuscleId, sets: 14, source: 'band' },
              { muscle: 'mu.glutes' as MuscleId, sets: 4, source: 'maintenance' },
            ],
            lifts: [],
          },
        },
        groups: GROUPS,
        exercise: lookup,
        openPlanned: [
          {
            slots: [
              {
                key: 'a',
                exerciseId: 'ex.bench' as ExerciseId,
                prescription: { mode: 'rpe', sets: 3, repRange: [5, 5], rir: [2, 2] },
              } as never,
            ],
          },
        ],
      },
      RULES,
    );
    const chest = rows[0]!;
    expect(chest).toMatchObject({
      muscle: 'mu.chest',
      fractional: 12,
      status: 'under',
      heatLabel: 'belowTarget',
      target: { low: 14, high: 20, sets: 14, source: 'band' },
      targeted: true,
      remaining: { fractional: 3, direct: 3 },
      regions: { front: 'front.chest' },
    });
    expect(chest.subRegions).toMatchObject([
      {
        muscle: 'mu.chest.sternocostal',
        fractional: 12,
        regions: { front: 'front.chest.sternocostal' },
      },
    ]);
    expect(chest.contributors).toEqual([
      { exerciseId: 'ex.bench', sets: 12, credit: 1, fractional: 12 },
    ]);
    expect(rows.map((row) => [row.muscle, row.status, row.heatLabel])).toEqual([
      ['mu.chest', 'under', 'belowTarget'],
      ['mu.biceps', 'over', 'high'],
      ['mu.triceps', 'under', 'belowTarget'],
      ['mu.glutes', 'under', 'none'],
    ]);
    expect(rows[2]!.targeted).toBe(false);
    expect(rows[2]!.why.rule).toBe('volume.target');
  });

  it('averages four weeks, missing weeks as zero (MAP-04 "4-week average")', () => {
    const average = averageWeeks([week(10), null, week(14), week(8)]);
    expect(average.muscles).toEqual([{ muscle: 'mu.chest', fractional: 8, direct: 8 }]);
  });

  it('counts the planned remainder like the plan editor (sets × rolled-up group credit)', () => {
    const remainder = plannedRemainder(
      [
        {
          slots: [
            {
              exerciseId: 'ex.squat',
              prescription: {
                mode: 'topBackoff',
                top: { repRange: [3, 3], rir: [1, 1] },
                backoff: { sets: 3, repRange: [5, 5], rir: [2, 2] },
              },
            } as never,
          ],
        },
      ],
      lookup,
    );
    expect(remainder.get('mu.quads' as MuscleId)).toEqual({ fractional: 4, direct: 4 });
    expect(remainder.get('mu.glutes' as MuscleId)).toEqual({ fractional: 2, direct: 0 });
  });
});

describe('day arithmetic without Temporal objects (M4a performance)', () => {
  const dateArb = fc
    .integer({ min: epochDay('1900-01-01' as LocalDate), max: epochDay('2199-12-31' as LocalDate) })
    .map((days) => Temporal.PlainDate.from('1970-01-01').add({ days }).toString() as LocalDate);

  it('matches Temporal for epoch days, adding days, differences and week starts', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.integer({ min: -4000, max: 4000 }),
        fc.integer({ min: 1, max: 7 }),
        (date, days, start) => {
          const plain = Temporal.PlainDate.from(date);
          expect(fromEpochDay(epochDay(date))).toBe(date);
          expect(addDays(date, days)).toBe(plain.add({ days }).toString());
          const other = plain.add({ days }).toString() as LocalDate;
          expect(daysBetween(date, other)).toBe(days);
          const offset = (plain.dayOfWeek - start + 7) % 7;
          expect(weekStartOf(date, start as 1)).toBe(plain.subtract({ days: offset }).toString());
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('pins known days', () => {
    expect(epochDay('1970-01-01' as LocalDate)).toBe(0);
    expect(fromEpochDay(-1)).toBe('1969-12-31');
    expect(addDays('2024-02-28' as LocalDate, 1)).toBe('2024-02-29');
    expect(addDays('2100-02-28' as LocalDate, 1)).toBe('2100-03-01');
    expect(weekStartOf('2026-11-29' as LocalDate, 1)).toBe('2026-11-23');
    expect(weekStartOf('2026-11-29' as LocalDate, 7)).toBe('2026-11-29');
    expect(kg(1)).toEqual({ value: 1, unit: 'kg' });
  });
});
