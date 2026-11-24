import { describe, expect, it } from 'vitest';

import { BUILT_IN_CONTENT } from '../src/built-in';
import {
  equipmentDefSchema,
  equipmentPresetDefSchema,
  exerciseDefSchema,
  muscleGroupSchema,
  templateDefSchema,
} from '../src/schema';

/** The first problem a schema reports for `input`, as "path: message". */
function problem(schema: { safeParse(input: unknown): unknown }, input: unknown): string {
  const result = schema.safeParse(input) as {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  };
  const issue = result.error?.issues[0];
  return issue ? `${issue.path.map(String).join('.')}: ${issue.message}` : 'valid';
}

const squat = BUILT_IN_CONTENT.exercises[0]!;
const template = BUILT_IN_CONTENT.templates[0]!;

describe('exercise schema', () => {
  it('accepts the shipped exercises and defaults custom and status', () => {
    for (const exercise of BUILT_IN_CONTENT.exercises) {
      expect(problem(exerciseDefSchema, exercise)).toBe('valid');
    }
    const { custom: _custom, status: _status, ...authored } = squat;
    expect(exerciseDefSchema.parse(authored)).toMatchObject({ custom: false, status: 'active' });
  });

  it.each([
    ['an invalid ID', { id: 'Squat' }, /^id: .*ex\.some-name/],
    ['an unknown key', { colour: 'red' }, /Unrecognized key/],
    ['an unknown pattern', { pattern: 'twist' }, /^pattern:/],
    [
      'a credit outside 1, 0.5, 0.25, 0',
      { muscles: [{ ...squat.muscles[0], credit: 0.75 }] },
      /^muscles\.0\.credit/,
    ],
    [
      'a malformed source ID',
      { muscles: [{ ...squat.muscles[0], source: 'kubo-2019' }] },
      /src\.kubo2019/,
    ],
    ['fewer than three cues', { cues: squat.cues.slice(0, 2) }, /^cues: .*3–6 cues/],
    ['more than six cues', { cues: [...squat.cues, ...squat.cues] }, /^cues: .*3–6 cues/],
    [
      'a cue over 140 characters',
      { cues: [{ en: `${'A'.repeat(140)}.` }, ...squat.cues] },
      /^cues\.0\.en/,
    ],
    [
      'a cue that is not a sentence',
      { cues: [{ en: 'no capital and no full stop' }, ...squat.cues.slice(1)] },
      /sentence/,
    ],
    [
      'a tempo outside the four-part format',
      { defaults: { ...squat.defaults, tempo: 'slow' } },
      /Tempo/,
    ],
    [
      'a reversed rep range',
      { defaults: { ...squat.defaults, repRange: { hypertrophy: [12, 6], strength: [1, 6] } } },
      /min ≤ max/,
    ],
    [
      'a one-item anyOf group',
      { equipment: { allOf: [], anyOf: [['eq.power-rack']] } },
      /at least two/,
    ],
    ['a custom built-in exercise', { custom: true }, /^custom:/],
  ])('rejects %s', (_label, change, message) => {
    expect(problem(exerciseDefSchema, { ...squat, ...change })).toMatch(message);
  });
});

describe('taxonomy, equipment and preset schemas', () => {
  const chest = BUILT_IN_CONTENT.muscles[0]!;
  const bar = BUILT_IN_CONTENT.equipment[0]!;
  const preset = BUILT_IN_CONTENT.presets[0]!;

  it('accepts the shipped entries', () => {
    for (const group of BUILT_IN_CONTENT.muscles)
      expect(problem(muscleGroupSchema, group)).toBe('valid');
    for (const item of BUILT_IN_CONTENT.equipment)
      expect(problem(equipmentDefSchema, item)).toBe('valid');
    for (const p of BUILT_IN_CONTENT.presets)
      expect(problem(equipmentPresetDefSchema, p)).toBe('valid');
  });

  it('rejects malformed entries', () => {
    expect(problem(muscleGroupSchema, { ...chest, bodyMap: {} })).toMatch(/at least one view/);
    expect(problem(muscleGroupSchema, { ...chest, bodyMap: { front: 'back.chest' } })).toMatch(
      /front view/,
    );
    expect(problem(muscleGroupSchema, { ...chest, area: 'neck' })).toMatch(/^area:/);
    expect(
      problem(equipmentDefSchema, {
        ...bar,
        loading: { kind: 'bar', defaultWeight: [{ value: 20, unit: 'kg' }], variesByModel: false },
      }),
    ).toMatch(/loading\.defaultWeight/);
    expect(
      problem(equipmentPresetDefSchema, {
        ...preset,
        inventory: { kg: { dumbbells: { from: 2, to: 25, step: 2 } } },
      }),
    ).toMatch(/whole number of steps/);
    expect(
      problem(equipmentPresetDefSchema, {
        ...preset,
        inventory: {
          kg: {
            plates: [
              { weight: 20, pairs: 2 },
              { weight: 20, pairs: 1 },
            ],
          },
        },
      }),
    ).toMatch(/once/);
  });
});

describe('template schema', () => {
  const day = template.days[0]!;
  const slot = day.slots[0]!;

  it('accepts the shipped templates', () => {
    for (const shipped of BUILT_IN_CONTENT.templates) {
      expect(problem(templateDefSchema, shipped)).toBe('valid');
    }
  });

  it.each([
    ['one day too few', { days: template.days.slice(1) }, /one day per training day/],
    [
      'a mesocycle longer than 8 weeks',
      { mesocycle: { ...template.mesocycle, accumulationWeeks: 9 } },
      /accumulationWeeks/,
    ],
    [
      'a malformed rule reference',
      { mesocycle: { ...template.mesocycle, deloadRule: 'Deload' } },
      /deload\.planned/,
    ],
    [
      'back-off sets outside topBackoff',
      {
        days: [
          {
            ...day,
            slots: [
              { ...slot, mode: 'rpe', backoff: { repRange: [3, 5], effort: { rpe: [7, 8] } } },
            ],
          },
          ...template.days.slice(1),
        ],
      },
      /topBackoff/,
    ],
    [
      'an RPE above 10',
      {
        days: [
          { ...day, slots: [{ ...slot, effort: { rpe: [9, 11] } }] },
          ...template.days.slice(1),
        ],
      },
      /effort/,
    ],
    [
      'a quarter-point RIR',
      {
        days: [
          { ...day, slots: [{ ...slot, effort: { rir: [1.25, 2] } }] },
          ...template.days.slice(1),
        ],
      },
      /effort/,
    ],
  ])('rejects %s', (_label, change, message) => {
    expect(problem(templateDefSchema, { ...template, ...change })).toMatch(message);
  });
});
