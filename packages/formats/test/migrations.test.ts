import { describe, expect, it } from 'vitest';

import { MIGRATIONS, migrateRecord, migrateTables, type MigrationChain } from '../src';
import { settingsRecordSchema as v1Settings } from '../src/records/v1';
import { settingsRecordSchema as v2Settings } from '../src/records/v2';

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
  it('keeps every v1 settings record valid at v2, which the pass-through step relies on', () => {
    for (const settings of [
      { id: 'me', theme: 'dark' },
      { id: 'me', theme: 'system' },
    ]) {
      expect(v1Settings.safeParse(settings).success).toBe(true);
      expect(v2Settings.safeParse(migrateRecord('settings', settings, 1)).success).toBe(true);
    }
  });

  it('takes v1 records to v2 unchanged: v2 only adds tables and optional settings fields (TD-19)', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1']);
    const settings = { id: 'me', theme: 'dark' };
    expect(migrateRecord('settings', settings, 1)).toBe(settings);
    expect(migrateRecord('sets', { id: 'a' }, 1)).toEqual({ id: 'a' });
    expect(migrateRecord('sets', { id: 'a' }, 2)).toEqual({ id: 'a' });
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
