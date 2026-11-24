/**
 * Warm-up ramp reference suite (PRD WKT-06; EB §Session › Warm-up, Rules 1–3 and pruning).
 */
import { describe, expect, it } from 'vitest';

import type { Implement } from '../../src/loading';
import { generateWarmup, type WarmupInput } from '../../src/warmup';
import { rules } from '../fixtures/rules';

const RULES = rules();

const barbell: Implement = {
  kind: 'barbell',
  bar: { weight: 20, unit: 'kg' },
  plates: {
    unit: 'kg',
    plates: [
      { weight: 20, pairs: 4 },
      { weight: 10, pairs: 1 },
      { weight: 5, pairs: 1 },
      { weight: 2.5, pairs: 1 },
      { weight: 1.25, pairs: 1 },
    ],
  },
};

const base: WarmupInput = {
  workingLoad: { value: 100, unit: 'kg' },
  workingReps: 5,
  e1rmKg: 120,
  mechanics: 'compound',
  firstForPattern: true,
};

const ramp = (input: Partial<WarmupInput>, implement: Implement = barbell) => {
  const result = generateWarmup({ ...base, ...input }, { implement }, RULES);
  return {
    rule: result.why.rule,
    sets: result.value.map((set) => [set.load.value, set.reps, set.restSeconds]),
  };
};

describe('Rule 1: heavy work (≤ 5 reps or ≥ 80% e1RM)', () => {
  it('bar × 8, then 40/60/75/85%', () => {
    expect(ramp({})).toEqual({
      rule: 'warmup.heavy',
      sets: [
        [20, 8, 45],
        [40, 5, 45],
        [60, 3, 45],
        [75, 2, 90],
        [85, 1, 90],
      ],
    });
  });

  it('adds a 92% single when the work is ≥ 90% of e1RM', () => {
    expect(ramp({ e1rmKg: 105, workingReps: 3 }).sets.at(-1)).toEqual([92.5, 1, 90]);
  });

  it('applies to 8 reps at ≥ 80% e1RM too', () => {
    expect(ramp({ workingReps: 8, e1rmKg: 120 }).rule).toBe('warmup.heavy');
  });

  it('keeps warm-up reps below the working reps from 70% on', () => {
    // Working doubles: the 75% double becomes a single.
    expect(ramp({ workingReps: 2, e1rmKg: 110 }).sets).toContainEqual([75, 1, 90]);
  });
});

describe('Rule 2: compounds with 6–15 reps', () => {
  it('bar × 8, 50% × 6, 70% × 4', () => {
    expect(ramp({ workingReps: 10, e1rmKg: 140 })).toEqual({
      rule: 'warmup.compound',
      sets: [
        [20, 8, 45],
        [50, 6, 45],
        [70, 4, 45],
      ],
    });
  });

  it('adds the optional 85% × 2 on request', () => {
    expect(ramp({ workingReps: 10, e1rmKg: 140, includeOptional: true }).sets.at(-1)).toEqual([
      85, 2, 90,
    ]);
  });
});

describe('Rule 3: isolation and already-warm patterns', () => {
  const rack: Implement = { kind: 'list', unit: 'kg', weights: [4, 6, 8, 10, 12, 14, 16, 18, 20] };

  it('isolation: one set of 10 at about 50%, no bar set', () => {
    expect(
      ramp(
        {
          workingLoad: { value: 16, unit: 'kg' },
          workingReps: 12,
          e1rmKg: null,
          mechanics: 'isolation',
        },
        rack,
      ),
    ).toEqual({
      rule: 'warmup.isolation',
      sets: [[8, 10, 45]],
    });
  });

  it('later exercises on a warm pattern: one feeder set at about 70%', () => {
    expect(ramp({ workingReps: 10, e1rmKg: 140, firstForPattern: false })).toEqual({
      rule: 'warmup.feeder',
      sets: [[70, 4, 45]],
    });
  });
});

describe('rounding and pruning', () => {
  it('drops steps at or below the bar and steps within 5% of the previous one', () => {
    // 40 kg work: 40% = 16 kg is below the 20 kg bar, 60% = 24 kg rounds to 25 kg.
    expect(ramp({ workingLoad: { value: 40, unit: 'kg' }, e1rmKg: 45 }).sets).toEqual([
      [20, 8, 45],
      [25, 3, 45],
      [30, 2, 90],
      [35, 1, 90],
    ]);
  });

  it('never ramps to the working load and returns nothing for an empty bar', () => {
    const tiny = generateWarmup(
      { ...base, workingLoad: { value: 20, unit: 'kg' } },
      { implement: barbell },
      RULES,
    );
    expect(tiny.value).toEqual([]);
    expect(tiny.why.rule).toBe('warmup.none');
  });

  it('rounds every step to achievable loads', () => {
    const loads = ramp({ workingLoad: { value: 137.5, unit: 'kg' }, e1rmKg: 160 }).sets.map(
      ([load]) => load,
    );
    expect(loads).toEqual([20, 55, 82.5, 102.5, 117.5]);
  });

  it('lists the registry parameters it used', () => {
    const why = generateWarmup(base, { implement: barbell }, RULES).why;
    expect(why.params.map((p) => p.id)).toEqual([
      'session.warmup.heavyTrigger',
      'session.warmup.heavy',
      'session.warmup.pruning',
      'session.rest.warmupLight',
      'session.rest.warmupBeforeWork',
    ]);
  });
});
