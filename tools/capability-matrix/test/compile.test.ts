import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadRecords, MATRIX_FILE, RECORDS_DIR } from '../src/cli.ts';
import { compileMatrix, levelOf, parseRecord, type RecordRun } from '../src/compile.ts';

const FIXTURES = new URL('./fixtures/', import.meta.url);

const run = (overrides: Partial<RecordRun> = {}): RecordRun => ({
  variant: 'C',
  restMs: 60_000,
  condition: 'locked',
  batterySaver: false,
  status: 'done',
  outcome: 'on-time',
  ...overrides,
});

const record = (runs: RecordRun[], overrides: { placeholder?: boolean; major?: number } = {}) => ({
  file: 'test.txt',
  device: 'Galaxy S22',
  placeholder: overrides.placeholder ?? false,
  browser: {
    family: 'chrome' as const,
    major: overrides.major ?? 142,
    platform: 'android' as const,
    displayMode: 'standalone' as const,
  },
  runs,
});

describe('the S-1 status rule (technical concept §8.8.5)', () => {
  it('needs at least 3 runs with ≥ 95% on time for "supported"', () => {
    expect(levelOf({ onTime: 3, late: 0, missed: 0 })).toBe('supported');
    expect(levelOf({ onTime: 2, late: 0, missed: 0 })).toBe('limited');
    expect(levelOf({ onTime: 19, late: 1, missed: 0 })).toBe('supported');
    expect(levelOf({ onTime: 18, late: 1, missed: 1 })).toBe('limited');
  });

  it('is "not supported" when no run alerted and "limited" when some did or were late', () => {
    expect(levelOf({ onTime: 0, late: 0, missed: 3 })).toBe('not-supported');
    expect(levelOf({ onTime: 0, late: 3, missed: 0 })).toBe('limited');
    expect(levelOf({ onTime: 1, late: 0, missed: 2 })).toBe('limited');
  });
});

describe('compileMatrix', () => {
  it('groups runs into cells and keeps only measurements of a hidden page with rests ≤ 5 min', () => {
    const matrix = compileMatrix([
      record([
        run(),
        run(),
        run(),
        run({ batterySaver: true, outcome: 'missed' }),
        run({ batterySaver: true, outcome: 'late' }),
        run({ condition: 'switched', variant: 'E' }),
        run({ outcome: 'visible' }),
        run({ condition: 'visible' }),
        run({ status: 'stopped', outcome: null }),
        run({ restMs: 480_000, outcome: 'missed' }),
        run({ status: 'interrupted', outcome: null, variant: 'B' }),
      ]),
    ]);
    expect(matrix.entries).toEqual([
      expect.objectContaining({
        condition: 'locked',
        batterySaver: false,
        variant: 'B',
        runs: 1,
        missed: 1,
        status: 'not-supported',
      }),
      expect.objectContaining({
        condition: 'locked',
        batterySaver: false,
        variant: 'C',
        runs: 3,
        onTime: 3,
        status: 'supported',
        minMajor: 142,
        maxMajor: 144,
        device: 'Galaxy S22',
      }),
      expect.objectContaining({
        condition: 'locked',
        batterySaver: true,
        variant: 'C',
        runs: 2,
        late: 1,
        missed: 1,
        status: 'limited',
      }),
      expect.objectContaining({ condition: 'switched', variant: 'E', runs: 1, status: 'limited' }),
    ]);
  });

  it('marks placeholder records so the app can ignore them', () => {
    const matrix = compileMatrix([record([run(), run(), run()], { placeholder: true })]);
    expect(matrix.entries).toEqual([expect.objectContaining({ placeholder: true })]);
  });

  it('is deterministic regardless of record order', () => {
    const a = record([run()], { major: 142 });
    const b = { ...record([run({ variant: 'D' })], { major: 141 }), file: 'a.txt' };
    expect(compileMatrix([a, b])).toEqual(compileMatrix([b, a]));
  });
});

describe('parseRecord', () => {
  it('reads a harness export (harnessVersion 2)', () => {
    const text = readFileSync(new URL('placeholder-record.txt', FIXTURES), 'utf8');
    const parsed = parseRecord('placeholder-record.txt', text);
    expect(parsed).toMatchObject({
      device: 'PLACEHOLDER (not a device test)',
      placeholder: true,
      browser: { family: 'chrome', major: 142, platform: 'android', displayMode: 'standalone' },
    });
    expect(parsed.runs).toHaveLength(2);
  });

  it('rejects version 1 exports and incomplete records with the file name', () => {
    expect(() => parseRecord('old.txt', '{"harnessVersion":1}')).toThrow(
      /old\.txt: harnessVersion 1/,
    );
    expect(() => parseRecord('x.txt', 'not json')).toThrow(/x\.txt: not JSON/);
    const noMajor = JSON.stringify({
      harnessVersion: 2,
      device: 'S22',
      browser: { family: 'other', major: null, platform: 'other', displayMode: 'browser' },
      runs: [],
    });
    expect(() => parseRecord('y.txt', noMajor)).toThrow(/major version missing/);
  });
});

describe('the shipped matrix', () => {
  it('matches the committed records (run pnpm capability-matrix after adding one)', () => {
    const committed: unknown = JSON.parse(readFileSync(MATRIX_FILE, 'utf8'));
    expect(committed).toEqual(compileMatrix(loadRecords(RECORDS_DIR)));
  });
});
