import { explained, type Explained } from '../explain';
import type { PlanDay } from '../model';
import type { RuleSlice } from '../rules';
import type { IsoWeekday } from '../time';
import { heavySets, rirRangesOf, setsOf, type HeavySetRules } from './analysis';
import { compareIds, groupCredits, type ExerciseLookup } from './credits';

export type SpacingRules = HeavySetRules &
  RuleSlice<
    | 'monitoring.spacing'
    | 'volume.hypertrophy.perSessionSoftCap'
    | 'volume.strength.perSessionHeavySets'
  >;

/**
 * What one day trains hard (PLN-04, EB §Monitoring › Recovery): a muscle with direct work
 * (credit 1.0), a competition lift with heavy sets. `demanding` marks failure or high-volume work
 * (RIR 0 targets, fractional sets at the per-session nudge, more heavy sets than the cap), which
 * needs 48–72 h instead of 24–48 h before the next hard session.
 */
function hardExposures(
  day: PlanDay,
  lookup: ExerciseLookup,
  rules: SpacingRules,
): ReadonlyMap<string, { readonly demanding: boolean }> {
  const nudge = rules['volume.hypertrophy.perSessionSoftCap'].value.nudge.min;
  const heavyCap = rules['volume.strength.perSessionHeavySets'].value.max;
  const fractional = new Map<string, number>();
  const direct = new Set<string>();
  const failure = new Set<string>();
  const heavy = new Map<string, number>();
  for (const slot of day.slots) {
    const exercise = lookup(slot.exerciseId);
    if (!exercise) continue;
    const sets = setsOf(slot.prescription);
    const toFailure = rirRangesOf(slot.prescription).some((range) => range[0] === 0);
    for (const [muscle, credit] of groupCredits(exercise)) {
      fractional.set(muscle, (fractional.get(muscle) ?? 0) + sets * credit);
      if (credit === 1) {
        direct.add(muscle);
        if (toFailure) failure.add(muscle);
      }
    }
    const part = heavySets(slot, exercise, lookup, rules);
    if (part && part.sets > 0)
      heavy.set(`lift.${part.lift}`, (heavy.get(`lift.${part.lift}`) ?? 0) + part.sets);
  }
  const exposures = new Map<string, { demanding: boolean }>();
  for (const muscle of direct) {
    exposures.set(muscle, {
      demanding: failure.has(muscle) || (fractional.get(muscle) ?? 0) >= nudge,
    });
  }
  for (const [lift, sets] of heavy) exposures.set(lift, { demanding: sets > heavyCap });
  return exposures;
}

export interface SpacingConflict {
  /** A display group (`mu.chest`) or a competition lift (`lift.squat`). */
  readonly subject: string;
  readonly fromDay: string;
  readonly toDay: string;
  readonly gapHours: number;
  readonly requiredHours: number;
}

/**
 * Hard sessions for the same muscle or lift that are closer than the spacing minimum (24 h,
 * or 48 h after demanding work). `offsets` gives each day's position in days (week offsets for
 * a weekly pattern, which wraps around; calendar days otherwise). Sessions on the same day are
 * 0 h apart.
 */
export function spacingConflicts(
  days: readonly PlanDay[],
  offsets: readonly number[],
  lookup: ExerciseLookup,
  rules: SpacingRules,
  weekly: boolean,
): readonly SpacingConflict[] {
  const spacing = rules['monitoring.spacing'].value;
  const bySubject = new Map<string, { offset: number; dayKey: string; demanding: boolean }[]>();
  days.forEach((day, index) => {
    for (const [subject, { demanding }] of hardExposures(day, lookup, rules)) {
      const list = bySubject.get(subject) ?? [];
      list.push({ offset: offsets[index] ?? 0, dayKey: day.key, demanding });
      bySubject.set(subject, list);
    }
  });
  const conflicts: SpacingConflict[] = [];
  for (const [subject, list] of [...bySubject].toSorted(([a], [b]) => compareIds(a, b))) {
    const sorted = list.toSorted((a, b) => a.offset - b.offset);
    const pairs = sorted.map((entry, i) => [entry, sorted[i + 1]] as const).slice(0, -1);
    if (weekly && sorted.length > 1)
      pairs.push([sorted.at(-1)!, { ...sorted[0]!, offset: sorted[0]!.offset + 7 }]);
    for (const [from, to] of pairs) {
      if (!to) continue;
      const gapHours = (to.offset - from.offset) * 24;
      const requiredHours = from.demanding ? spacing.failureHours.min : spacing.nonFailureHours.min;
      if (gapHours < requiredHours) {
        conflicts.push({
          subject,
          fromDay: from.dayKey,
          toDay: to.dayKey,
          gapHours,
          requiredHours,
        });
      }
    }
  }
  return conflicts;
}

/** Week offsets (0–6) of weekdays for the user's week start (SET-11). */
export function weekOffset(weekday: IsoWeekday, weekStartsOn: IsoWeekday): number {
  return (weekday - weekStartsOn + 7) % 7;
}

/** Weekdays in week order for the user's week start. */
export function sortWeekdays(
  weekdays: readonly IsoWeekday[],
  weekStartsOn: IsoWeekday,
): IsoWeekday[] {
  return [...new Set(weekdays)].toSorted(
    (a, b) => weekOffset(a, weekStartsOn) - weekOffset(b, weekStartsOn),
  );
}

/**
 * §8.7.6 step 5: maps the template's days onto the chosen weekdays. Every order of the days is
 * tried (at most 6! = 720); the one with the fewest spacing conflicts wins, ties going to the
 * order closest to the template's own (lexicographically first), so the result is deterministic.
 */
export function assignWeekdays(
  days: readonly PlanDay[],
  weekdays: readonly IsoWeekday[],
  weekStartsOn: IsoWeekday,
  lookup: ExerciseLookup,
  rules: SpacingRules,
): Explained<readonly PlanDay[]> {
  const ordered = sortWeekdays(weekdays, weekStartsOn);
  const offsets = ordered.map((weekday) => weekOffset(weekday, weekStartsOn));
  const best = bestArrangement(days, offsets, lookup, rules);
  const placed = best.order.map((index, position) => ({
    ...days[index]!,
    weekday: ordered[position]!,
  }));
  return explained(placed, 'plan.schedule.weekdays', {
    args: {
      weekdays: ordered.join(','),
      order: placed.map((day) => day.key).join(','),
      conflicts: best.conflicts,
    },
    params: [rules['monitoring.spacing']],
  });
}

/** The order of `days` on the given week offsets with the fewest spacing conflicts. */
export function bestArrangement(
  days: readonly PlanDay[],
  offsets: readonly number[],
  lookup: ExerciseLookup,
  rules: SpacingRules,
): { readonly order: readonly number[]; readonly conflicts: number } {
  let best: { order: number[]; conflicts: number } | null = null;
  for (const order of permutations(days.length)) {
    const arranged = order.map((index) => days[index]!);
    const conflicts = spacingConflicts(arranged, offsets, lookup, rules, true).length;
    if (best === null || conflicts < best.conflicts) best = { order, conflicts };
    if (conflicts === 0) break;
  }
  return best ?? { order: days.map((_, index) => index), conflicts: 0 };
}

/** Permutations of 0…n−1 in lexicographic order (identity first). */
function* permutations(n: number): Generator<number[]> {
  const items = Array.from({ length: n }, (_, index) => index);
  yield [...items];
  while (true) {
    let i = n - 2;
    while (i >= 0 && items[i]! >= items[i + 1]!) i--;
    if (i < 0) return;
    let j = n - 1;
    while (items[j]! <= items[i]!) j--;
    [items[i], items[j]] = [items[j]!, items[i]!];
    items.splice(i + 1, n - i - 1, ...items.slice(i + 1).toReversed());
    yield [...items];
  }
}
