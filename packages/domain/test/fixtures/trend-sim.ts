/**
 * Seeded simulation of the e1RM trend's change labels (PRD PRG-02; the process-noise calibration
 * of rules 1.6.0). Synthetic exposures with a known true change and e1RM jitter run through the
 * real observation, filter and label functions (`trendObservation`, `trendStep`, `labelChange`),
 * so the numbers describe the shipped engine and registry, not a model of them.
 */
import { addDays, type LocalDate } from '../../src';
import type { SetE1rm } from '../../src/e1rm';
import type { RuleSet, TraineeLevel } from '../../src/rules';
import { labelChange, trendObservation, trendStep, type TrendPoint } from '../../src/trend';

/** The trend functions under test (injectable, so a previous engine can be compared). */
export interface TrendApi {
  readonly trendObservation: typeof trendObservation;
  readonly trendStep: typeof trendStep;
  readonly labelChange: typeof labelChange;
}

const ENGINE: TrendApi = { trendObservation, trendStep, labelChange };

/**
 * `typical`: 5 reps at RIR 2 (r_eff 7, RPE 8), filter noise 9%; `heavy`: 3 reps at RIR 1 (r_eff 4,
 * RPE 9), filter noise 4% (registry `load.trend.noiseTypicalSd`, `noiseHeavySd`).
 */
export type SetKind = 'typical' | 'heavy';

export interface Scenario {
  readonly level: TraineeLevel;
  readonly kind: SetKind;
  /** True change of ln(e1RM) per week (0.01 ≈ +1% a week). */
  readonly gainPerWeek: number;
  /**
   * SD of the session e1RM around the truth (log scale): `te`, the level's typical error (the
   * day-to-day variation of a tested 1RM); `filter`, the noise the filter assumes for the set
   * (9% or 4%, wider for novices in their first weeks); or a number.
   */
  readonly jitter: 'te' | 'filter' | number;
  readonly sessionsPerWeek: number;
  readonly weeks: number;
}

export interface SessionLabel {
  readonly day: number;
  readonly label: 'insufficientData' | 'none' | 'likely' | 'veryLikely';
  readonly direction: 'up' | 'down' | null;
}

const START = '2026-01-05' as LocalDate;

/** Mulberry32: a small, fast, seeded 32-bit generator (deterministic across runs). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw (Box–Muller). */
function normal(random: () => number): number {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Session days: evenly spaced, rounded to whole days (two a week: every 3 or 4 days). */
function sessionDays(sessionsPerWeek: number, weeks: number): number[] {
  const days: number[] = [];
  const spacing = 7 / sessionsPerWeek;
  for (let i = 0; i * spacing <= weeks * 7 + 1e-9; i++) days.push(Math.round(i * spacing));
  return days;
}

const estimate = (kind: SetKind, e1rmKg: number): SetE1rm => ({
  e1rmKg,
  loadKg: e1rmKg * 0.85,
  reps: kind === 'heavy' ? 3 : 5,
  rir: kind === 'heavy' ? 1 : 2,
  reff: kind === 'heavy' ? 4 : 7,
  pct: 0.85,
  weight: 1,
  effortKnown: true,
  effortLogSd: 0,
  prEligible: true,
});

/** One simulated exercise history: the label after every session. */
function simulate(
  scenario: Scenario,
  rules: RuleSet,
  seed: number,
  api: TrendApi = ENGINE,
): SessionLabel[] {
  const random = mulberry32(seed);
  const points: TrendPoint[] = [];
  const labels: SessionLabel[] = [];
  let previous: TrendPoint | null = null;
  for (const day of sessionDays(scenario.sessionsPerWeek, scenario.weeks)) {
    const localDate = addDays(START, day);
    const weeksOfData = day / 7;
    // The filter's noise for this set: computed first, so `filter` jitter can match it.
    const assumed = api.trendObservation(
      estimate(scenario.kind, 100),
      localDate,
      { level: scenario.level, weeksOfData },
      rules,
    );
    const jitter =
      scenario.jitter === 'te'
        ? rules['load.trend.typicalErrorCv'].value[scenario.level]
        : scenario.jitter === 'filter'
          ? assumed.logSd
          : scenario.jitter;
    const logE1rm = Math.log(100) + scenario.gainPerWeek * weeksOfData + jitter * normal(random);
    const observation = { ...assumed, e1rmKg: Math.exp(logE1rm) };
    previous = api.trendStep(previous, observation, scenario.level, rules);
    points.push(previous);
    const { label, direction } = api.labelChange(points, scenario.level, rules).value;
    labels.push({ day, label, direction });
  }
  return labels;
}

const claims = (label: SessionLabel) => label.label === 'likely' || label.label === 'veryLikely';

/** Weeks to the first upward claim; Infinity when there is none. */
function firstUpWeek(labels: readonly SessionLabel[]): number {
  const hit = labels.find((label) => claims(label) && label.direction === 'up');
  return hit ? hit.day / 7 : Infinity;
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export interface Detection {
  /** Median weeks to the first upward claim over the runs (Infinity: not in most runs). */
  readonly medianWeeks: number;
  /** The same series without jitter. */
  readonly noiseFreeWeeks: number;
  /** Share of runs with an upward claim within 12 and 26 weeks. */
  readonly by12: number;
  readonly by26: number;
}

/** How soon a sustained true change is labelled "likely real" or "very likely real". */
export function detection(
  scenario: Omit<Scenario, 'weeks'>,
  rules: RuleSet,
  runs: number,
  api: TrendApi = ENGINE,
): Detection {
  const full = { ...scenario, weeks: 26 };
  const weeks = Array.from({ length: runs }, (_, run) =>
    firstUpWeek(simulate(full, rules, 1 + run * 7919, api)),
  );
  return {
    medianWeeks: median(weeks),
    noiseFreeWeeks: firstUpWeek(simulate({ ...full, jitter: 0 }, rules, 1, api)),
    by12: weeks.filter((week) => week <= 12).length / runs,
    by26: weeks.filter((week) => week <= 26).length / runs,
  };
}

export interface FalsePositives {
  /** Share of runs with any claim (either direction) within 12 and within 26 weeks. */
  readonly within12: number;
  readonly within26: number;
}

/** No true change, only jitter: how often is a change claimed anyway? */
export function falsePositives(
  scenario: Omit<Scenario, 'weeks' | 'gainPerWeek'>,
  rules: RuleSet,
  runs: number,
  api: TrendApi = ENGINE,
): FalsePositives {
  let within12 = 0;
  let within26 = 0;
  for (let run = 0; run < runs; run++) {
    const labels = simulate(
      { ...scenario, gainPerWeek: 0, weeks: 26 },
      rules,
      100_003 + run * 104_729,
      api,
    );
    if (labels.some((label) => label.day <= 84 && claims(label))) within12++;
    if (labels.some(claims)) within26++;
  }
  return { within12: within12 / runs, within26: within26 / runs };
}
