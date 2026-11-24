/**
 * Readiness (RDY-01…03; EB §Monitoring › Readiness, › Sleep & stress; §Defaults › Monitoring).
 * Each check-in item becomes a z-score against the user's own rolling baseline (28 days, at least
 * 7 entries), sign-aligned so that higher is better; the composite is their mean. Composite
 * ≤ −1.0 is "low readiness"; ≤ −1.5, or PRS ≤ 3 on two days in a row, is "consider modifying".
 * No flag before the baseline has enough entries. Sleep rules are absolute: < 6 h before a PM
 * session trims volume, ≥ 2 short nights in a row ease multi-joint lifts. These are labelled,
 * adjustable heuristics (no validated cut-offs exist, EB §Gaps #10); the app never cancels a
 * session, every adjustment is a proposal (RDY-03). Return from a break per lift (PRG-13) is
 * proposed here too, when the planned session carries no break adjustment already.
 */
import { returnFromBreak } from '../deload';
import { explain, explained, type Explained } from '../explain';
import type { LocalDate } from '../ids';
import type { ReadinessEntry, SessionChange, SessionExercise } from '../model';
import type { RuleSlice } from '../rules';
import { addDays, daysBetween, localHourOf, toLocalDate } from '../time';
import { isPending, isWorking } from './slots';
import {
  READINESS_ITEMS,
  type ReadinessAssessment,
  type ReadinessItem,
  type SessionContext,
  type SessionProposal,
  type SessionState,
} from './types';

export type ReadinessRules = RuleSlice<
  'monitoring.readiness.baseline' | 'monitoring.readiness.thresholds' | 'monitoring.readiness.sleep'
>;

/** Items where a higher value is worse. */
const INVERTED: ReadonlySet<ReadinessItem> = new Set<ReadinessItem>(['soreness', 'stress']);

function valueOf(entry: ReadinessEntry, item: ReadinessItem): number | null {
  const value = entry.items[item];
  return value === undefined || value === null ? null : value;
}

/** The latest entry per day, by day. */
function byDay(entries: readonly ReadinessEntry[]): Map<LocalDate, ReadinessEntry> {
  const days = new Map<LocalDate, ReadinessEntry>();
  for (const entry of entries.toSorted((a, b) => a.recordedAt.epochMs - b.recordedAt.epochMs)) {
    days.set(entry.localDate, entry);
  }
  return days;
}

/** Days in a row, ending on `date`, on which `test` holds for that day's entry. */
function streak(
  days: Map<LocalDate, ReadinessEntry>,
  date: LocalDate,
  test: (entry: ReadinessEntry) => boolean,
): number {
  let count = 0;
  for (let day = date; ; day = addDays(day, -1)) {
    const entry = days.get(day);
    if (!entry || !test(entry)) return count;
    count++;
  }
}

/** RDY-02: the assessment of a check-in against the earlier ones. */
export function assessReadiness(
  entry: ReadinessEntry,
  history: readonly ReadinessEntry[],
  rules: ReadinessRules,
): Explained<ReadinessAssessment> {
  const baseline = rules['monitoring.readiness.baseline'];
  const thresholds = rules['monitoring.readiness.thresholds'];
  const sleep = rules['monitoring.readiness.sleep'];
  const window = history.filter((candidate) => {
    const age = daysBetween(candidate.localDate, entry.localDate);
    return candidate.id !== entry.id && age >= 1 && age <= baseline.value.windowDays;
  });
  const z: Partial<Record<ReadinessItem, number>> = {};
  for (const item of READINESS_ITEMS) {
    const value = valueOf(entry, item);
    const values = window.flatMap((candidate) => valueOf(candidate, item) ?? []);
    if (value === null || values.length < baseline.value.minEntries) continue;
    const mean = values.reduce((sum, x) => sum + x, 0) / values.length;
    const variance =
      values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / Math.max(1, values.length - 1);
    const sd = Math.sqrt(variance);
    const score = sd > 0 ? (value - mean) / sd : 0;
    z[item] = INVERTED.has(item) ? -score : score;
  }
  const scores = Object.values(z);
  const composite =
    scores.length > 0 ? scores.reduce((sum, x) => sum + x, 0) / scores.length : null;
  const days = byDay([...history.filter((candidate) => candidate.id !== entry.id), entry]);
  const prsLowDays = streak(days, entry.localDate, (day) => {
    const prs = valueOf(day, 'prs');
    return prs !== null && prs <= thresholds.value.prsLow;
  });
  const short = (day: ReadinessEntry) => {
    const hours = valueOf(day, 'sleepHours');
    return hours !== null && hours < sleep.value.shortHours;
  };
  const shortNights = streak(days, entry.localDate, short);
  const enough = window.length >= baseline.value.minEntries;
  const flag = !enough
    ? 'insufficientData'
    : (composite !== null && composite <= thresholds.value.modifyZ) ||
        prsLowDays >= thresholds.value.prsConsecutiveDays
      ? 'modify'
      : composite !== null && composite <= thresholds.value.lowZ
        ? 'low'
        : 'none';
  const value: ReadinessAssessment = {
    flag,
    composite,
    z,
    baselineEntries: window.length,
    prsLowDays,
    shortSleep: short(entry),
    shortNights,
  };
  return explained(value, 'readiness.assessment', {
    args: {
      flag,
      composite,
      entries: window.length,
      minEntries: baseline.value.minEntries,
      prsLowDays,
      shortNights,
    },
    params: [baseline, thresholds, sleep],
  });
}

/** PRG-12: days in a row (ending `date`) with low readiness or worse. */
export function lowReadinessDays(
  entries: readonly ReadinessEntry[],
  date: LocalDate,
  rules: ReadinessRules,
): number {
  const days = byDay(entries);
  return streak(days, date, (entry) => {
    const flag = assessReadiness(entry, entries, rules).value.flag;
    return flag === 'low' || flag === 'modify';
  });
}

function pendingWorking(state: SessionState, slot: SessionExercise) {
  return slot.sets.filter((set) => isWorking(set) && isPending(state, slot, set.key));
}

/**
 * RDY-03: the adjustments to offer for an assessment. Low readiness: cap the top sets by +1 RIR
 * and drop back-off sets (1, or 2 when "consider modifying"). A short night before a PM session:
 * trim one working set per exercise (intensity kept). Short nights in a row: +1 RIR on
 * multi-joint lifts. Swapping with a lighter day is a schedule change the application offers.
 */
export function readinessProposals(
  assessment: ReadinessAssessment,
  state: SessionState,
  ctx: SessionContext,
): SessionProposal[] {
  const rules = ctx.rules(null);
  const adjustments = rules['monitoring.readiness.adjustments'];
  const sleep = rules['monitoring.readiness.sleep'];
  const pmFrom = rules['monitoring.readiness.pmFromHour'];
  const slots = state.session.exercises.filter(
    (slot) => !slot.skipped && pendingWorking(state, slot).length > 0,
  );
  const proposals: SessionProposal[] = [];
  const propose = (change: SessionChange, action: string, params: readonly unknown[]) => {
    if (change.slotKeys.length === 0) return;
    proposals.push({
      change,
      why: explain('readiness.adjust', {
        args: {
          action,
          flag: assessment.flag,
          rirAdd: change.rirAdd ?? null,
          dropSets: change.dropSets ?? null,
          slots: change.slotKeys.length,
        },
        params: params as never,
      }),
    });
  };
  const compound = (slot: SessionExercise) =>
    ctx.exercise(slot.exerciseId)?.mechanics === 'compound';

  if (assessment.flag === 'low' || assessment.flag === 'modify') {
    const topSlots = slots.filter(
      (slot) =>
        pendingWorking(state, slot).some((set) => set.type === 'top') ||
        ((slot.progression === 'rpe' || slot.prescription?.mode === 'rpe') && compound(slot)),
    );
    propose(
      {
        kind: 'capTopSet',
        slotKeys: topSlots.map((slot) => slot.key),
        rirAdd: adjustments.value.topSetRirAdd,
      },
      'capTopSet',
      [adjustments],
    );
    const backoffSlots = slots.filter((slot) =>
      pendingWorking(state, slot).some((set) => set.type === 'backoff'),
    );
    propose(
      {
        kind: 'dropBackoff',
        slotKeys: backoffSlots.map((slot) => slot.key),
        dropSets:
          assessment.flag === 'modify'
            ? adjustments.value.dropBackoffSets.max
            : adjustments.value.dropBackoffSets.min,
      },
      'dropBackoff',
      [adjustments],
    );
  }
  if (assessment.shortSleep && localHourOf(ctx.now) >= pmFrom.value) {
    propose(
      {
        kind: 'trimVolume',
        slotKeys: slots
          .filter((slot) => pendingWorking(state, slot).length >= 2)
          .map((slot) => slot.key),
        dropSets: adjustments.value.dropBackoffSets.min,
      },
      'trimVolume',
      [sleep, pmFrom, adjustments],
    );
  }
  if (assessment.shortNights >= sleep.value.consecutiveShortNights) {
    propose(
      {
        kind: 'easeCompounds',
        slotKeys: slots.filter(compound).map((slot) => slot.key),
        rirAdd: adjustments.value.topSetRirAdd,
      },
      'easeCompounds',
      [sleep, adjustments],
    );
  }
  return proposals;
}

/**
 * PRG-13 per lift (WKT-01): for each exercise last trained more than a week ago, the first step
 * of its return-from-break row. Not offered when the planned session already carries a deload
 * or break adjustment (the plan applied it to every slot).
 */
export function returnProposals(
  state: SessionState,
  ctx: SessionContext,
  options: { readonly plannedAdjusted: boolean },
): SessionProposal[] {
  if (options.plannedAdjusted) return [];
  const today = toLocalDate(ctx.now);
  const applied = new Set(
    state.session.changes
      .filter((change) => change.kind === 'returnFromBreak')
      .flatMap((change) => change.slotKeys),
  );
  const proposals: SessionProposal[] = [];
  for (const slot of state.session.exercises) {
    if (slot.skipped || applied.has(slot.key) || pendingWorking(state, slot).length === 0) continue;
    const last = ctx.history(slot.exerciseId)?.lastDate;
    if (!last) continue;
    const daysOff = daysBetween(last, today);
    const plan = returnFromBreak(daysOff, ctx.rules(slot.exerciseId));
    const step = plan.value.steps[0];
    if (plan.value.action === 'resume' || !step) continue;
    proposals.push({
      change: {
        kind: 'returnFromBreak',
        slotKeys: [slot.key],
        daysOff,
        ...(step.loadPct ? { loadPct: step.loadPct } : {}),
        ...(step.setsPct ? { setsPct: step.setsPct } : {}),
        ...(step.rirAdd ? { rirAdd: step.rirAdd } : {}),
        ...(step.calibrationRir ? { calibrate: true } : {}),
      },
      why: plan.why,
    });
  }
  return proposals;
}
