import { describe, expect, it } from 'vitest';

import type { ExerciseId } from '@powr/domain';

import { matchesCondition, paramDefSchema, resolveParam, type ParamDef } from '../src';

const restStrength: ParamDef = paramDefSchema.parse({
  id: 'session.rest.strength',
  value: 180,
  unit: 'seconds',
  variants: [{ when: { competitionLift: ['squat', 'deadlift'] }, value: 240 }],
  range: { min: 150, max: 300 },
  evidence: ['SR'],
  sources: ['src.grgic2018b'],
  ebRef: 'EB §Defaults › Session',
  verified: true,
  userOverridable: true,
});

const squat = {
  exercise: { id: 'ex.barbell-back-squat' as ExerciseId, competitionLift: 'squat' as const },
};

describe('parameter rows', () => {
  it('rejects rows without evidence or sources, with unknown keys or malformed source IDs', () => {
    expect(paramDefSchema.safeParse({ ...restStrength, evidence: [] }).success).toBe(false);
    expect(paramDefSchema.safeParse({ ...restStrength, sources: [] }).success).toBe(false);
    expect(paramDefSchema.safeParse({ ...restStrength, extra: 1 }).success).toBe(false);
    expect(
      paramDefSchema.safeParse({ ...restStrength, sources: ['grgic-2018-rest'] }).success,
    ).toBe(false);
    expect(paramDefSchema.safeParse({ ...restStrength, unit: 'minutes' }).success).toBe(false);
  });

  it('defaults `since` to mvp and rejects empty conditions', () => {
    expect(restStrength.since).toBe('mvp');
    expect(
      paramDefSchema.safeParse({ ...restStrength, variants: [{ when: {}, value: 1 }] }).success,
    ).toBe(false);
  });
});

describe('resolveParam (default → variant → user → exercise)', () => {
  it('resolves the default with its provenance', () => {
    const { param, issues } = resolveParam(restStrength);
    expect(issues).toEqual([]);
    expect(param).toEqual({
      id: 'session.rest.strength',
      value: 180,
      meta: {
        unit: 'seconds',
        evidence: ['SR'],
        sources: ['src.grgic2018b'],
        ebRef: 'EB §Defaults › Session',
        verified: true,
        label: 'params.session.rest.strength',
        origin: 'default',
        defaultValue: 180,
        outOfRange: false,
      },
    });
  });

  it('applies the first matching context variant', () => {
    expect(resolveParam(restStrength, [], squat).param).toMatchObject({
      value: 240,
      meta: { origin: 'variant', defaultValue: 240 },
    });
    const bench = { exercise: { competitionLift: 'bench' as const } };
    expect(resolveParam(restStrength, [], bench).param.value).toBe(180);
  });

  it('applies a global override, then a per-exercise override', () => {
    const overrides = [
      { paramId: 'session.rest.strength', value: 200, exerciseId: 'ex.barbell-back-squat' },
      { paramId: 'session.rest.strength', value: 150 },
    ];
    expect(resolveParam(restStrength, overrides).param).toMatchObject({
      value: 150,
      meta: { origin: 'user', defaultValue: 180 },
    });
    expect(resolveParam(restStrength, overrides, squat).param).toMatchObject({
      value: 200,
      meta: { origin: 'exercise', defaultValue: 240 },
    });
  });

  it('accepts out-of-range user values with a flag, and ignores invalid ones', () => {
    const shortRest = resolveParam(restStrength, [{ paramId: 'session.rest.strength', value: 90 }]);
    expect(shortRest.param.meta).toMatchObject({ origin: 'user', outOfRange: true });
    const invalid = resolveParam(restStrength, [
      { paramId: 'session.rest.strength', value: 'long' },
    ]);
    expect(invalid.param.value).toBe(180);
    expect(invalid.issues[0]).toMatch(/invalid override ignored/);
  });

  it('ignores overrides of parameters that are not user-overridable', () => {
    const { param, issues } = resolveParam({ ...restStrength, userOverridable: false }, [
      { paramId: 'session.rest.strength', value: 120 },
    ]);
    expect(param.meta.origin).toBe('default');
    expect(issues).toEqual(['session.rest.strength: not user-overridable, override ignored']);
  });

  it('refuses parameters blocked until verified (E-5)', () => {
    expect(() =>
      resolveParam({ ...restStrength, verified: false, blockedUntilVerified: true }),
    ).toThrow(/blocked/);
  });
});

describe('matchesCondition', () => {
  it('needs every named key to match; a missing context value never matches', () => {
    expect(matchesCondition({ level: ['novice'] }, { level: 'novice' })).toBe(true);
    expect(matchesCondition({ level: ['novice'] }, {})).toBe(false);
    expect(matchesCondition({ level: ['novice'], timeSaver: true }, { level: 'novice' })).toBe(
      false,
    );
    expect(matchesCondition({ timeSaver: true }, { timeSaver: true })).toBe(true);
    expect(
      matchesCondition(
        { pattern: ['squat'], mechanics: ['compound'] },
        {
          exercise: { pattern: 'squat', mechanics: 'compound' },
        },
      ),
    ).toBe(true);
  });
});
