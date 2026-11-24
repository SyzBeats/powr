import { describe, expect, it } from 'vitest';

import { RULE_IDS, explain, paramsUsed } from '../src/explain';
import { restSeconds } from '../src/rest';
import { rules } from './fixtures/rules';

const RULES = rules();

describe('explanations (PRG-09)', () => {
  it('has unique rule IDs, each with its own message ID', () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    for (const rule of RULE_IDS) expect(explain(rule).message).toBe(`why.${rule}`);
  });

  it('records the parameters used with provenance, once per explanation tree', () => {
    const child = explain('loading.round', { params: [RULES['load.rirBias']] });
    const parent = explain('e1rm.loadForTarget', {
      params: [RULES['load.e1rm.equation'], RULES['load.rirBias']],
      children: [child],
    });
    expect(parent.params[0]).toEqual({
      id: 'load.e1rm.equation',
      value: 'wathan',
      origin: 'default',
      evidence: ['INF'],
      sources: ['src.powr-eb-load'],
      verified: true,
    });
    expect(paramsUsed(parent).map((ref) => ref.id)).toEqual(['load.e1rm.equation', 'load.rirBias']);
  });
});

describe('rest defaults (TMR-02)', () => {
  it('takes the rest class default and the time-saver value for hypertrophy work only', () => {
    expect(restSeconds({ restClass: 'strength' }, RULES).value).toBe(180);
    expect(restSeconds({ restClass: 'hypertrophyCompound' }, RULES).value).toBe(150);
    expect(restSeconds({ restClass: 'hypertrophyIsolation' }, RULES).value).toBe(90);
    expect(restSeconds({ restClass: 'hypertrophyIsolation', timeSaver: true }, RULES).value).toBe(
      60,
    );
    // Never shorten strength rest (competition lifts stay ≥ 2:00).
    expect(restSeconds({ restClass: 'strength', timeSaver: true }, RULES).value).toBe(180);
    expect(restSeconds({ restClass: 'strength' }, RULES).why.params[0]?.id).toBe(
      'session.rest.strength',
    );
  });
});
