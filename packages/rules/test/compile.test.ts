import { describe, expect, it } from 'vitest';

import { compileRules } from '../src/compile';
import { buildSourceRegistry } from '../src/sources';

const { sources } = buildSourceRegistry([
  {
    file: 'test.yaml',
    data: [
      { id: 'src.grgic2018b', citation: 'Grgic 2018.', tag: 'SR', status: 'active' },
      {
        id: 'src.barbalho2019',
        citation: 'Barbalho 2019.',
        tag: 'RCT-T',
        status: 'excluded',
        reason: 'Retracted.',
      },
    ],
  },
]);

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'session.rest.strength',
  value: 180,
  unit: 'seconds',
  evidence: ['SR'],
  sources: ['src.grgic2018b'],
  ebRef: 'EB §Defaults › Session',
  verified: true,
  userOverridable: true,
  ...overrides,
});

/** Issues other than the parameters these small fixtures leave out. */
const issuesOf = (data: unknown[], file = 'session.yaml') =>
  compileRules([{ file, data }], sources).issues.filter(
    (issue) => !issue.startsWith('missing parameter'),
  );

describe('compileRules', () => {
  it('accepts a valid row and reports every MVP parameter that has no row', () => {
    const result = compileRules([{ file: 'session.yaml', data: [row()] }], sources);
    expect(issuesOf([row()])).toEqual([]);
    expect(result.issues).toContain(
      'missing parameter load.e1rm.equation (it has a schema in src/params.ts)',
    );
    expect(result.params.map((def) => def.id)).toEqual(['session.rest.strength']);
  });

  it('checks values, variant values and range bounds against the parameter schema', () => {
    expect(issuesOf([row({ value: -5 })])[0]).toMatch(/session\.rest\.strength\): value /);
    expect(
      issuesOf([row({ variants: [{ when: { level: ['novice'] }, value: 'long' }] })])[0],
    ).toMatch(/variant 1/);
    expect(issuesOf([row({ range: { min: 150, max: 99999 } })])[0]).toMatch(/range\.max/);
  });

  it('rejects unknown parameters, duplicates across files and non-list files', () => {
    expect(issuesOf([row({ id: 'session.rest.unknown' })])).toEqual([
      'session.yaml row 1 (session.rest.unknown): unknown parameter (add its value schema to src/params.ts)',
    ]);
    const duplicate = compileRules(
      [
        { file: 'a.yaml', data: [row()] },
        { file: 'b.yaml', data: [row()] },
        { file: 'c.yaml', data: { not: 'a list' } },
      ],
      sources,
    ).issues;
    expect(duplicate).toContain(
      'b.yaml row 1 (session.rest.strength): duplicate ID, already defined in a.yaml',
    );
    expect(duplicate).toContain('c.yaml: expected a list of parameters');
  });

  it('rejects unknown and excluded sources (Barbalho, EB §Gaps #23)', () => {
    expect(issuesOf([row({ sources: ['src.nobody2020'] })])).toEqual([
      'session.yaml session.rest.strength: unknown source src.nobody2020',
    ]);
    expect(issuesOf([row({ sources: ['src.barbalho2019'] })])).toEqual([
      'session.yaml session.rest.strength: cites excluded source src.barbalho2019 (Retracted.)',
    ]);
  });

  it('rejects an MVP parameter that is blocked until verified (E-5)', () => {
    expect(issuesOf([row({ verified: false, blockedUntilVerified: true })])).toEqual([
      'session.yaml row 1 (session.rest.strength): an MVP parameter cannot be blocked until verified (E-5)',
    ]);
  });

  it('sorts parameters by ID', () => {
    const result = compileRules(
      [{ file: 'x.yaml', data: [row({ id: 'session.rest.warmupLight', value: 45 }), row()] }],
      sources,
    );
    expect(result.params.map((def) => def.id)).toEqual([
      'session.rest.strength',
      'session.rest.warmupLight',
    ]);
  });
});
