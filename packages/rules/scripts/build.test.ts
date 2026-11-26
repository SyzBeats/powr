import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { RULES_VERSION, rulesStamp, type ParamDef } from '../src';
import { BUILT_IN_RULES } from '../src/built-in';
import type { CompiledRules } from '../src/compile';
import { parseCompiledRules, resolveRules } from '../src/resolve';
import {
  GENERATED_FILE,
  buildRules,
  canonicalJson,
  diffRules,
  generatedText,
  hashRules,
  loadRuleFiles,
  parsePreviousRules,
  unverifiedReport,
} from './build';
import { loadSourceRegistry } from './sources';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const { compiled, issues } = buildRules();

function shipped(): CompiledRules {
  expect(issues).toEqual([]);
  if (!compiled) throw new Error('the shipped registry does not compile');
  return compiled;
}

function verifiedOf(id: string): boolean | undefined {
  return shipped().params.find((def) => def.id === id)?.verified;
}

describe('shipped rules registry (data/*.yaml)', () => {
  it('compiles: every row matches its schema, every MVP parameter is present', () => {
    expect(issues).toEqual([]);
    expect(shipped().version).toBe(RULES_VERSION);
    expect(shipped().params.length).toBeGreaterThan(100);
  });

  it('ships a current generated/rules.json (run pnpm --filter @powr/rules build)', () => {
    const current = readFileSync(GENERATED_FILE, 'utf8') === generatedText(shipped());
    expect(current ? 'current' : 'generated/rules.json is stale').toBe('current');
    expect(BUILT_IN_RULES).toEqual(shipped());
  });

  it('cites only existing, non-excluded sources, and never the Barbalho papers (EB §Gaps #23)', () => {
    const { sources } = loadSourceRegistry();
    for (const def of shipped().params) {
      expect(def.sources.length).toBeGreaterThan(0);
      for (const id of def.sources) {
        expect({ id: def.id, source: id, status: sources.get(id)?.status }).toEqual({
          id: def.id,
          source: id,
          status: 'active',
        });
        expect(id).not.toMatch(/^src\.barbalho/);
      }
    }
  });

  it('ships every preprint-derived value as verified: false (E-2)', () => {
    const { sources } = loadSourceRegistry();
    const preprint = (def: ParamDef) =>
      def.evidence.includes('PREPRINT') ||
      def.sources.some((id) => sources.get(id)?.tag === 'PREPRINT');
    const offenders = shipped().params.filter((def) => preprint(def) && def.verified);
    expect(offenders.map((def) => def.id)).toEqual([]);
    // Rules 1.8.0 (T-01): weeklyBands and hypertrophySlopePerRir left this list, verified against
    // the published Pelland 2026 data and the Robinson 2024 accepted manuscript.
    for (const id of [
      'volume.hypertrophy.tiers',
      'volume.hypertrophy.perSessionSoftCap',
      'volume.puos',
    ]) {
      expect(shipped().params.find((def) => def.id === id)).toMatchObject({ id, verified: false });
      expect(preprint(shipped().params.find((def) => def.id === id)!)).toBe(true);
    }
  });

  it('applies the T-01 evidence verification (rules 1.8.0, product owner 2026-11-25)', () => {
    // The 14 research-backed and 4 PRD rows of the report, less the two Pelland tier rows kept
    // until the full text is read, plus the corrected APRE table.
    for (const id of [
      'load.rirBias',
      'volume.hypertrophy.weeklyBands',
      'volume.counting.default',
      'volume.frequency.strengthPerLift',
      'volume.strength.perSessionHeavySets',
      'volume.effort.hypertrophySlopePerRir',
      'planning.slot.sets',
      'scoring.wilks.coefficients',
      'scoring.wilks2020.coefficients',
      'scoring.dots.coefficients',
      'scoring.ipfGl.coefficients',
      'monitoring.readiness.pmFromHour',
      'planning.timeBudget.fallback',
      'progression.calibration',
      'bodyweight.rate.maintain',
      'motivation.streak.defaultWeeklyTarget',
      'progression.apre.sixRm',
    ]) {
      expect({ id, verified: verifiedOf(id) }).toEqual({ id, verified: true });
    }
    // Kept preliminary until the published Pelland 2026 Tables 2A/2B are read, and the corrected
    // strength guard whose band stays a design value.
    for (const id of [
      'volume.hypertrophy.tiers',
      'volume.strength.tiers',
      'volume.puos',
      'volume.strength.weeklyHeavySetsPerLift',
    ]) {
      expect({ id, verified: verifiedOf(id) }).toEqual({ id, verified: false });
    }
  });

  it('keeps parameter IDs stable (ids.lock.json)', () => {
    const lock = JSON.parse(readFileSync(new URL('../ids.lock.json', import.meta.url), 'utf8')) as {
      ids: string[];
    };
    const ids = shipped().params.map((def) => def.id);
    // Removed or renamed IDs, then new IDs (add those to ids.lock.json).
    expect(lock.ids.filter((id) => !ids.includes(id))).toEqual([]);
    expect(ids.filter((id) => !lock.ids.includes(id))).toEqual([]);
  });

  it('resolves for any context without issues', () => {
    const resolved = resolveRules(shipped(), {
      level: 'novice',
      exercise: { id: 'ex.barbell-back-squat' as never, competitionLift: 'squat' },
    });
    expect(resolved.issues).toEqual([]);
    expect(resolved.version).toBe(rulesStamp(shipped()));
    expect(resolved.rules['session.rest.strength'].value).toBe(240);
    expect(resolved.rules['session.rest.hypertrophyCompound'].value).toBe(90);
    expect(resolved.rules['load.e1rm.equation'].meta).toMatchObject({
      origin: 'default',
      verified: true,
    });
  });

  it('prints the preliminary (verified: false) rows', () => {
    const report = unverifiedReport(shipped());
    const count = shipped().params.filter((def) => !def.verified).length;
    expect(report.split('\n')).toHaveLength(count + 1);
    expect(report).toContain('- volume.puos [MA, PREPRINT]');
  });
});

describe('versioned, hashed rules.json', () => {
  it('has a stable hash: the same data always hashes the same', () => {
    const again = buildRules().compiled;
    expect(again?.hash).toBe(shipped().hash);
    expect(shipped().hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRules(RULES_VERSION, shipped().params)).toBe(shipped().hash);
  });

  it('ignores key order and file layout, but not values or the version', () => {
    const params = shipped().params;
    const reordered = params.map(
      (def) => Object.fromEntries(Object.entries(def).toReversed()) as unknown as ParamDef,
    );
    expect(hashRules(RULES_VERSION, reordered)).toBe(shipped().hash);
    const changed = params.map((def) =>
      def.id === 'session.rest.strength' ? { ...def, value: 181 } : def,
    );
    expect(hashRules(RULES_VERSION, changed)).not.toBe(shipped().hash);
    expect(hashRules('9.9.9', params)).not.toBe(shipped().hash);
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}');
  });

  it('round-trips through JSON and validates on load', () => {
    const json: unknown = JSON.parse(JSON.stringify(shipped()));
    expect(parseCompiledRules(json)).toEqual(shipped());
    const broken = {
      ...shipped(),
      params: shipped().params.filter((def) => def.id !== 'load.rirBias'),
    };
    expect(() => parseCompiledRules(JSON.parse(JSON.stringify(broken)))).toThrow(/load\.rirBias/);
    const badValue = {
      ...shipped(),
      params: shipped().params.map((def) =>
        def.id === 'session.rest.strength' ? { ...def, value: -1 } : def,
      ),
    };
    expect(() => parseCompiledRules(JSON.parse(JSON.stringify(badValue)))).toThrow(
      /expected number/i,
    );
  });

  it('reports added, removed and changed parameters', () => {
    const before = shipped();
    const after: CompiledRules = {
      ...before,
      hash: 'f'.repeat(64),
      params: before.params
        .filter((def) => def.id !== 'volume.puos')
        .map((def) => (def.id === 'session.rest.strength' ? { ...def, value: 170 } : def)),
    };
    const diff = diffRules(before, after);
    expect(diff).toContain('- Changed session.rest.strength: `180` [SR] → `170` [SR]');
    expect(diff).toContain('- Removed volume.puos');
    expect(diffRules(before, before)).toContain('No parameter changed.');
  });

  it('diffs against an older rules.json that lacks a newer parameter (M2b open item)', () => {
    const now = shipped();
    // An older file: one parameter missing, one value in an older shape, one row since removed.
    const older = JSON.parse(
      JSON.stringify({
        ...now,
        version: '1.0.0',
        params: [
          ...now.params
            .filter((def) => def.id !== 'volume.hypertrophy.minimumDose')
            .map((def) =>
              def.id === 'load.curve.classMap' ? { ...def, value: { benchLike: 'old' } } : def,
            ),
          { ...now.params[0]!, id: 'volume.retired' },
        ],
      }),
    );
    // The app's strict check rejects it; the diff report reads it.
    expect(() => parseCompiledRules(older)).toThrow(/volume\.hypertrophy\.minimumDose/);
    const diff = diffRules(parsePreviousRules(older), now);
    expect(diff).toContain('- Added volume.hypertrophy.minimumDose: `{"setsPerWeek":4}`');
    expect(diff).toContain('- Changed load.curve.classMap: `{"benchLike":"old"}`');
    expect(diff).toContain('- Removed volume.retired');
  });

  it('refuses a file that is not a compiled rules.json', () => {
    expect(() => parsePreviousRules(null)).toThrow(/format 1/);
    expect(() => parsePreviousRules({ format: 2, version: '1', hash: 'x', params: [] })).toThrow(
      /format 1/,
    );
    expect(() =>
      parsePreviousRules({ format: 1, version: '1', hash: 'x', params: [{ id: 'a.b' }] }),
    ).toThrow(/params\[0\]/);
  });
});

describe('loadRuleFiles', () => {
  it('reports YAML errors and stray files; skips the sources directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'powr-rules-'));
    tempDirs.push(dir);
    writeFileSync(join(dir, 'broken.yaml'), '- id: x\n  value: [unclosed\n');
    writeFileSync(join(dir, 'notes.txt'), 'stray');
    const { files, issues: loadIssues } = loadRuleFiles(dir);
    expect(files).toEqual([]);
    expect(loadIssues).toHaveLength(2);
    expect(loadIssues[0]).toMatch(/^broken\.yaml: /);
    expect(loadIssues[1]).toBe('notes.txt: only *.yaml parameter tables belong in data/');
  });
});
