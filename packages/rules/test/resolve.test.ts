import { describe, expect, it } from 'vitest';

import { paramDefSchema, resolveParam, type ParamDef } from '../src';

const restDefault: ParamDef = paramDefSchema.parse({
  id: 'rest.strength.default',
  value: { seconds: 180 },
  evidence: ['SR'],
  sources: ['src.grgic2018'],
  ebRef: 'EB §Defaults › Session',
  verified: true,
  userOverridable: true,
  label: 'params.rest.strength',
  since: 'mvp',
});

describe('rules registry', () => {
  it('rejects rows without evidence, with unknown keys or with malformed source IDs', () => {
    expect(paramDefSchema.safeParse({ ...restDefault, evidence: [] }).success).toBe(false);
    expect(paramDefSchema.safeParse({ ...restDefault, extra: 1 }).success).toBe(false);
    expect(paramDefSchema.safeParse({ ...restDefault, sources: ['grgic-2018-rest'] }).success).toBe(
      false,
    );
  });

  it('resolves the default and records its origin', () => {
    expect(resolveParam(restDefault, [])).toEqual({
      id: 'rest.strength.default',
      value: { seconds: 180 },
      origin: 'default',
    });
  });

  it('applies a user override when the parameter allows it', () => {
    const overrides = [{ paramId: 'rest.strength.default', value: { seconds: 120 } }];
    expect(resolveParam(restDefault, overrides)).toMatchObject({
      value: { seconds: 120 },
      origin: 'user',
    });
    expect(resolveParam({ ...restDefault, userOverridable: false }, overrides).origin).toBe(
      'default',
    );
  });

  it('refuses parameters blocked until verified', () => {
    expect(() =>
      resolveParam({ ...restDefault, verified: false, blockedUntilVerified: true }, []),
    ).toThrow(/blocked/);
  });
});
