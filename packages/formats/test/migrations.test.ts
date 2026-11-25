import { describe, expect, it } from 'vitest';

import { SESSION_DEFAULTS } from '@powr/domain';

import {
  MIGRATIONS,
  migrateRecord,
  migrateTables,
  withSessionDefaults,
  type MigrationChain,
} from '../src';
import {
  sessionRecordSchema as v1SessionSchema,
  settingsRecordSchema as v1Settings,
} from '../src/records/v1';
import {
  sessionRecordSchema as v2SessionSchema,
  settingsRecordSchema as v2Settings,
} from '../src/records/v2';

const parseAlertsV2 = (alerts: object) => v2Settings.safeParse({ id: 'me', theme: 'dark', alerts });

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

  it('accepts the optional alert settings at v2 and rejects incomplete or out-of-range ones (M3t, M3b)', () => {
    const alerts = {
      sound: true,
      volume: 0.8,
      vibration: true,
      preAlert: true,
      preAlertSeconds: 10,
      countdown: false,
      restingNotice: true,
      keepScreenOn: true,
    };
    expect(v2Settings.safeParse({ id: 'me', theme: 'dark', alerts }).success).toBe(true);
    expect(
      v2Settings.safeParse({ id: 'me', theme: 'dark', alerts: { ...alerts, volume: 1.5 } }).success,
    ).toBe(false);
    const { keepScreenOn: _, ...incomplete } = alerts;
    expect(v2Settings.safeParse({ id: 'me', theme: 'dark', alerts: incomplete }).success).toBe(
      false,
    );
    // The pre-alert timing is 5, 10 or 15 s (SET-03, product-owner decision 2026-11-24).
    for (const preAlertSeconds of [5, 15]) {
      expect(
        v2Settings.safeParse({ id: 'me', theme: 'dark', alerts: { ...alerts, preAlertSeconds } })
          .success,
      ).toBe(true);
    }
    for (const preAlertSeconds of [0, 7, 20, '10']) {
      expect(
        v2Settings.safeParse({ id: 'me', theme: 'dark', alerts: { ...alerts, preAlertSeconds } })
          .success,
      ).toBe(false);
    }
    const { preAlertSeconds: _timing, ...withoutTiming } = alerts;
    expect(v2Settings.safeParse({ id: 'me', theme: 'dark', alerts: withoutTiming }).success).toBe(
      false,
    );
    expect(
      v2Settings.safeParse({ id: 'me', theme: 'dark', alerts: { ...alerts, voice: true } }).success,
    ).toBe(false);
    // v1 has no alerts: the field is v2-only (an unreleased version, amended in place).
    expect(v1Settings.safeParse({ id: 'me', theme: 'dark', alerts }).success).toBe(false);
  });

  it('accepts the optional timed-set and tempo switches at v2 (M4v: TMR-09, TMR-10)', () => {
    const parse = parseAlertsV2;
    const alerts = {
      sound: true,
      volume: 0.8,
      vibration: true,
      preAlert: true,
      preAlertSeconds: 10,
      countdown: false,
      restingNotice: true,
      keepScreenOn: true,
    };
    const extras = { setTimerLeadIn: true, setTimerAutoStop: false, tempoCues: true };
    // Absent (records written before M4v) and present are both valid.
    expect(parse(alerts).success).toBe(true);
    expect(parse({ ...alerts, ...extras }).success).toBe(true);
    for (const key of Object.keys(extras)) {
      expect({ key, ok: parse({ ...alerts, [key]: 'yes' }).success }).toEqual({ key, ok: false });
      expect({ key, ok: parse({ ...alerts, [key]: null }).success }).toEqual({ key, ok: false });
      expect({ key, ok: parse({ ...alerts, [key]: undefined }).success }).toEqual({
        key,
        ok: false,
      });
    }
    // Still strict: an unknown switch is rejected.
    expect(parse({ ...alerts, ...extras, metronomeHaptics: true }).success).toBe(false);
    expect(
      v1Settings.safeParse({ id: 'me', theme: 'dark', alerts: { ...alerts, ...extras } }).success,
    ).toBe(false);
  });

  it('takes v1 records to v2 unchanged, except sessions, which gain an empty session core (TD-19, M3a)', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1']);
    const settings = { id: 'me', theme: 'dark' };
    expect(migrateRecord('settings', settings, 1)).toBe(settings);
    expect(migrateRecord('sets', { id: 'a' }, 1)).toEqual({ id: 'a' });
    expect(migrateRecord('sets', { id: 'a' }, 2)).toEqual({ id: 'a' });
    const v1Session = {
      id: 's1',
      localDate: '2026-11-23',
      startedAt: { epochMs: 1_795_456_000_000, offsetMin: 60, zone: 'Europe/Zurich' },
      status: 'active',
      versions: { engine: '0.0.0', rules: '1.0.0', content: '0.1.0' },
    };
    expect(v1SessionSchema.safeParse(v1Session).success).toBe(true);
    const migrated = migrateRecord('sessions', v1Session, 1);
    expect(migrated).toEqual({ ...SESSION_DEFAULTS, ...v1Session });
    expect(v2SessionSchema.safeParse(migrated).success).toBe(true);
    // Idempotent, so the Dexie reader can apply it to M2-era version-2 records too.
    expect(withSessionDefaults(migrated as object)).toBe(migrated);
    expect(withSessionDefaults({ ...v1Session, revision: 4 })).toMatchObject({
      revision: 4,
      undo: null,
    });
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
