import { describe, expect, it } from 'vitest';

import { MIGRATIONS, migrateRecord, migrateTables, type MigrationChain } from '../src';

// A hypothetical chain v1 -> v2 -> v3, to exercise the mechanism before the first real migration.
const chain: MigrationChain = {
  1: (table, record) => {
    const r = record as Record<string, unknown>;
    return table === 'sets' ? { ...r, note: r['comment'] ?? null, comment: undefined } : r;
  },
  2: (table, record) => {
    const r = record as Record<string, unknown>;
    return table === 'sets' && r['state'] === 'deleted' ? null : r;
  },
};

describe('record migration chain', () => {
  it('has no steps at dataVersion 1', () => {
    expect(MIGRATIONS).toEqual({});
    expect(migrateRecord('sets', { id: 'a' }, 1)).toEqual({ id: 'a' });
  });

  it('applies every step in order and drops records that a step removes', () => {
    const tables = {
      sets: [
        { id: 'a', comment: 'felt easy', state: 'done' },
        { id: 'b', state: 'deleted' },
      ],
      sessions: [{ id: 's' }],
    };
    expect(migrateTables(tables, 1, chain, 3)).toEqual({
      sets: [{ id: 'a', note: 'felt easy', comment: undefined, state: 'done' }],
      sessions: [{ id: 's' }],
    });
    expect(migrateRecord('sets', { id: 'a', state: 'done' }, 2, chain, 3)).toEqual({
      id: 'a',
      state: 'done',
    });
  });

  it('fails loudly when a step is missing', () => {
    expect(() => migrateRecord('sets', {}, 1, {}, 2)).toThrow(/No record migration/);
  });
});
