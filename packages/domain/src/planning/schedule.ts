import {
  applyReturnStep,
  deloadSlots,
  returnFromBreak,
  type DeloadRules,
  type ReturnRules,
} from '../deload';
import { explained, type Explained } from '../explain';
import type { LocalDate } from '../ids';
import type {
  Mesocycle,
  PlanId,
  PlannedSession,
  PlannedSessionId,
  PlanSlot,
  TrainingBreak,
} from '../model';
import type { RuleSlice } from '../rules';
import { addDays, daysBetween, weekStartOf, type IsoWeekday } from '../time';
import { heavySets, setsOf, withSets, type HeavySetRules } from './analysis';
import { groupCredits, type ExerciseLookup } from './credits';
import { spacingConflicts, weekOffset, type SpacingConflict, type SpacingRules } from './spacing';

/*
 * Calendar placement and rescheduling (PLN-11, PLN-12, PRG-11…13). Pure: functions return the
 * planned sessions they change (with a bumped revision for calendar export, CAL-04) and the
 * caller writes them. Nothing is ever dropped silently: a missed session is moved, skipped or
 * merged by the user's choice, and sessions inside a break are paused, not missed.
 */

/**
 * The first week of a new plan: this week if none of its training days has passed yet, else
 * next week (weeks follow the user's week start, SET-11). A later start date may be chosen too.
 */
export function firstWeekStart(
  today: LocalDate,
  weekdays: readonly IsoWeekday[],
  weekStartsOn: IsoWeekday,
): LocalDate {
  const start = weekStartOf(today, weekStartsOn);
  const first = Math.min(...weekdays.map((weekday) => weekOffset(weekday, weekStartsOn)));
  return daysBetween(start, today) <= first ? start : addDays(start, 7);
}

/** Calendar day of a mesocycle day in a given week. */
export function sessionDate(
  mesocycle: Pick<Mesocycle, 'startDate'>,
  week: number,
  weekday: IsoWeekday,
  weekStartsOn: IsoWeekday,
): LocalDate {
  return addDays(mesocycle.startDate, (week - 1) * 7 + weekOffset(weekday, weekStartsOn));
}

/**
 * Planned sessions of a mesocycle (PLN-08, PLN-11): its days on their weekdays for every
 * accumulation week, then the deload week (PRG-11 content). Days before `from` are not
 * scheduled, so a plan accepted mid-week starts with the days still ahead.
 */
export function materializeMesocycle(
  input: {
    readonly planId: PlanId;
    readonly mesocycle: Mesocycle;
    readonly weekStartsOn: IsoWeekday;
    readonly from: LocalDate;
  },
  nextId: () => string,
  rules: DeloadRules,
): PlannedSession[] {
  const { mesocycle } = input;
  const sessions: PlannedSession[] = [];
  const weeks = mesocycle.accumulationWeeks + mesocycle.deloadWeeks;
  for (let week = 1; week <= weeks; week++) {
    const deload = week > mesocycle.accumulationWeeks;
    for (const day of mesocycle.days) {
      const date = sessionDate(mesocycle, week, day.weekday, input.weekStartsOn);
      if (date < input.from) continue;
      const deloaded = deload ? deloadSlots(day.slots, rules).value : null;
      sessions.push({
        id: nextId() as PlannedSessionId,
        planId: input.planId,
        mesocycleIndex: mesocycle.index,
        week,
        dayKey: day.key,
        name: day.name,
        kind: deload ? 'deload' : 'regular',
        localDate: date,
        scheduledDate: date,
        status: 'planned',
        slots: deloaded ? deloaded.slots : day.slots,
        adjustments: deloaded ? [deloaded.adjustment] : [],
        revision: 0,
      });
    }
  }
  return sessions.toSorted(byDate);
}

function byDate(a: PlannedSession, b: PlannedSession): number {
  return a.localDate < b.localDate
    ? -1
    : a.localDate > b.localDate
      ? 1
      : a.dayKey < b.dayKey
        ? -1
        : 1;
}

function bump(session: PlannedSession, change: Partial<PlannedSession>): PlannedSession {
  return { ...session, ...change, revision: session.revision + 1 };
}

/** Whether a day lies inside a break (an open break lasts until it is ended). */
export function inBreak(
  date: LocalDate,
  breaks: readonly Pick<TrainingBreak, 'startDate' | 'endDate'>[],
): boolean {
  return breaks.some(
    (entry) => date >= entry.startDate && (entry.endDate === null || date <= entry.endDate),
  );
}

/** PLN-11: planned sessions whose day has passed, outside breaks (PLN-12: not "missed"). */
export function missedSessions(
  sessions: readonly PlannedSession[],
  today: LocalDate,
  breaks: readonly Pick<TrainingBreak, 'startDate' | 'endDate'>[],
): PlannedSession[] {
  return sessions
    .filter(
      (session) =>
        session.status === 'planned' &&
        session.localDate < today &&
        !inBreak(session.localDate, breaks),
    )
    .toSorted(byDate);
}

/**
 * PLN-11 "do it today": the missed session moves to today and the later sessions of its plan
 * week shift so that each stays at least a day after the one before, within the week. Sessions
 * that would leave the week stay on its last day (the spacing check then warns).
 */
export function doMissedToday(
  missed: PlannedSession,
  sessions: readonly PlannedSession[],
  today: LocalDate,
  weekStartsOn: IsoWeekday,
): Explained<PlannedSession[]> {
  const weekEnd = addDays(weekStartOf(today, weekStartsOn), 6);
  const later = sessions
    .filter(
      (session) =>
        session.id !== missed.id &&
        session.planId === missed.planId &&
        session.status === 'planned' &&
        session.localDate >= today &&
        session.localDate <= weekEnd,
    )
    .toSorted(byDate);
  const changed = [bump(missed, { localDate: today })];
  let previous = today;
  for (const session of later) {
    const earliest = addDays(previous, 1);
    const date =
      session.localDate >= earliest ? session.localDate : earliest <= weekEnd ? earliest : weekEnd;
    if (date !== session.localDate) changed.push(bump(session, { localDate: date }));
    previous = date;
  }
  return explained(changed, 'schedule.missed.doToday', {
    args: { session: missed.id, from: missed.localDate, to: today, shifted: changed.length - 1 },
  });
}

/** PLN-11 "skip it": marked skipped, never silently dropped. */
export function skipSession(missed: PlannedSession): Explained<PlannedSession> {
  return explained(bump(missed, { status: 'skipped' }), 'schedule.missed.skip', {
    args: { session: missed.id, date: missed.localDate },
  });
}

export type MergeRules = HeavySetRules &
  RuleSlice<
    | 'planning.missed.mergePriorities'
    | 'volume.hypertrophy.perSessionSoftCap'
    | 'volume.strength.perSessionHeavySets'
  >;

/**
 * PLN-11 "merge key work into the next session": the missed session's key slots (the primary
 * ones) are added to the next planned session, as far as its per-session caps allow (~11
 * fractional / ~8 direct sets per muscle, 2–3 heavy sets per lift); what does not fit is listed
 * in the explanation. Null when no later session exists.
 */
export function mergeMissed(
  missed: PlannedSession,
  sessions: readonly PlannedSession[],
  lookup: ExerciseLookup,
  rules: MergeRules,
): Explained<PlannedSession[] | null> {
  const target = sessions
    .filter(
      (session) =>
        session.planId === missed.planId &&
        session.status === 'planned' &&
        session.localDate > missed.localDate,
    )
    .toSorted(byDate)[0];
  const priorities = rules['planning.missed.mergePriorities'];
  if (!target) {
    return explained(null, 'schedule.missed.merge', {
      args: { session: missed.id, target: null },
      params: [priorities],
    });
  }
  const cap = rules['volume.hypertrophy.perSessionSoftCap'].value;
  const heavyCap = rules['volume.strength.perSessionHeavySets'].value.max;
  const slots = target.slots.map((slot) => ({ ...slot }));
  const merged: string[] = [];
  const dropped: string[] = [];
  for (const slot of missed.slots.filter((candidate) =>
    priorities.value.includes(candidate.priority),
  )) {
    const exercise = lookup(slot.exerciseId);
    if (!exercise) continue;
    let fits = 0;
    for (let sets = 1; sets <= setsOf(slot.prescription); sets++) {
      if (!withinCaps([...slots, { ...slot, prescription: withSets(slot.prescription, sets) }]))
        break;
      fits = sets;
    }
    if (fits === 0) {
      dropped.push(slot.key);
      continue;
    }
    const existing = slots.findIndex((other) => other.exerciseId === slot.exerciseId);
    if (existing >= 0) {
      const own = slots[existing]!;
      slots[existing] = {
        ...own,
        prescription: withSets(own.prescription, setsOf(own.prescription) + fits),
      };
    } else {
      slots.push({
        ...slot,
        prescription: withSets(slot.prescription, fits),
        key: `${slot.key}~merged`,
      });
    }
    merged.push(`${slot.key}:${fits}`);
    if (fits < setsOf(slot.prescription))
      dropped.push(`${slot.key}:${setsOf(slot.prescription) - fits}`);
  }
  const changed = [
    bump(missed, { status: 'merged', mergedInto: target.id }),
    bump(target, {
      slots,
      adjustments: [...target.adjustments, { kind: 'mergedWork', notes: [] }],
    }),
  ];
  return explained(changed, 'schedule.missed.merge', {
    args: {
      session: missed.id,
      target: target.id,
      merged: merged.join(','),
      dropped: dropped.join(','),
    },
    params: [
      priorities,
      rules['volume.hypertrophy.perSessionSoftCap'],
      rules['volume.strength.perSessionHeavySets'],
    ],
  });

  function withinCaps(candidate: readonly PlanSlot[]): boolean {
    const muscles = new Map<string, { fractional: number; direct: number }>();
    const lifts = new Map<string, number>();
    for (const slot of candidate) {
      const exercise = lookup(slot.exerciseId);
      if (!exercise) continue;
      const sets = setsOf(slot.prescription);
      for (const [muscle, credit] of groupCredits(exercise)) {
        const total = muscles.get(muscle) ?? { fractional: 0, direct: 0 };
        total.fractional += sets * credit;
        if (credit === 1) total.direct += sets;
        muscles.set(muscle, total);
      }
      const heavy = heavySets(slot, exercise, lookup, rules);
      if (heavy) lifts.set(heavy.lift, (lifts.get(heavy.lift) ?? 0) + heavy.sets);
    }
    return (
      [...muscles.values()].every(
        (total) => total.fractional <= cap.fractionalSets + 1e-9 && total.direct <= cap.directSets,
      ) && [...lifts.values()].every((sets) => sets <= heavyCap)
    );
  }
}

/** PLN-11: moves a session to another day (also "train early"). */
export function moveSession(session: PlannedSession, date: LocalDate): Explained<PlannedSession> {
  return explained(bump(session, { localDate: date }), 'schedule.moved', {
    args: { session: session.id, from: session.localDate, to: date },
  });
}

/** PLN-11: swaps the days of two sessions. */
export function swapSessions(
  a: PlannedSession,
  b: PlannedSession,
): Explained<readonly [PlannedSession, PlannedSession]> {
  return explained(
    [bump(a, { localDate: b.localDate }), bump(b, { localDate: a.localDate })] as const,
    'schedule.moved',
    {
      args: { session: a.id, from: a.localDate, to: b.localDate, swappedWith: b.id },
    },
  );
}

/** PLN-04/PLN-11: spacing conflicts between hard sessions on their actual calendar days. */
export function sessionSpacing(
  sessions: readonly PlannedSession[],
  lookup: ExerciseLookup,
  rules: SpacingRules,
): readonly SpacingConflict[] {
  const active = sessions
    .filter((session) => session.status === 'planned' || session.status === 'done')
    .toSorted(byDate);
  const first = active[0];
  if (!first) return [];
  const days = active.map((session) => ({
    key: session.id,
    name: session.name,
    weekday: 1 as IsoWeekday,
    slots: session.slots,
  }));
  const offsets = active.map((session) => daysBetween(first.localDate, session.localDate));
  return spacingConflicts(days, offsets, lookup, rules, false);
}

/** PLN-12: planned sessions inside the break are paused (`onBreak`), not missed. */
export function pauseForBreak(
  sessions: readonly PlannedSession[],
  entry: Pick<TrainingBreak, 'startDate' | 'endDate'>,
): PlannedSession[] {
  return sessions
    .filter((session) => session.status === 'planned' && inBreak(session.localDate, [entry]))
    .map((session) => bump(session, { status: 'onBreak' }));
}

/**
 * PLN-12/PRG-13: ending a break. Paused sessions from the return day on are planned again, and
 * the return-from-break ramp for the days off adjusts the sessions of the first weeks back.
 */
export function resumeAfterBreak(
  sessions: readonly PlannedSession[],
  returnDate: LocalDate,
  daysOff: number,
  rules: ReturnRules,
): Explained<PlannedSession[]> {
  const ramp = returnFromBreak(daysOff, rules);
  const changed: PlannedSession[] = [];
  for (const session of sessions.toSorted(byDate)) {
    if (session.localDate < returnDate) continue;
    if (session.status !== 'planned' && session.status !== 'onBreak') continue;
    const week = Math.floor(daysBetween(returnDate, session.localDate) / 7) + 1;
    const step = ramp.value.steps.find((candidate) => candidate.week === week);
    if (!step && session.status === 'planned') continue;
    const adjusted = step ? applyReturnStep(session.slots, step, daysOff) : null;
    changed.push(
      bump(session, {
        status: 'planned',
        ...(adjusted
          ? { slots: adjusted.slots, adjustments: [...session.adjustments, adjusted.adjustment] }
          : {}),
      }),
    );
  }
  return explained(changed, ramp.why.rule, {
    args: ramp.why.args,
    params: [],
    children: [ramp.why],
  });
}

export type DeloadControlRules = DeloadRules & RuleSlice<'deload.planned.postpone'>;

/**
 * PRG-11: postpones the deload by one week, once per mesocycle. The deload sessions move a week
 * later and the week before them repeats the mesocycle's regular days.
 */
export function postponeDeload(
  mesocycle: Mesocycle,
  sessions: readonly PlannedSession[],
  planId: PlanId,
  weekStartsOn: IsoWeekday,
  nextId: () => string,
  rules: DeloadControlRules,
): Explained<{
  readonly mesocycle: Mesocycle;
  readonly changed: PlannedSession[];
  readonly added: PlannedSession[];
} | null> {
  const postpone = rules['deload.planned.postpone'];
  if (
    mesocycle.deload.postponed ||
    mesocycle.deload.skipped ||
    postpone.value.maxPerMesocycle < 1
  ) {
    return explained(null, 'deload.postponed', { args: { allowed: false }, params: [postpone] });
  }
  const weeks = postpone.value.weeks;
  const deloadWeek = mesocycle.accumulationWeeks + 1;
  const changed = sessions
    .filter(
      (session) =>
        session.mesocycleIndex === mesocycle.index &&
        session.kind === 'deload' &&
        session.status === 'planned',
    )
    .map((session) =>
      bump(session, {
        week: session.week + weeks,
        localDate: addDays(session.localDate, 7 * weeks),
      }),
    );
  const next: Mesocycle = {
    ...mesocycle,
    accumulationWeeks: mesocycle.accumulationWeeks + weeks,
    deload: { ...mesocycle.deload, postponed: true },
  };
  const added: PlannedSession[] = [];
  for (let week = deloadWeek; week < deloadWeek + weeks; week++) {
    for (const day of mesocycle.days) {
      const date = sessionDate(mesocycle, week, day.weekday, weekStartsOn);
      added.push({
        id: nextId() as PlannedSessionId,
        planId,
        mesocycleIndex: mesocycle.index,
        week,
        dayKey: day.key,
        name: day.name,
        kind: 'regular',
        localDate: date,
        scheduledDate: date,
        status: 'planned',
        slots: day.slots,
        adjustments: [],
        revision: 0,
      });
    }
  }
  return explained({ mesocycle: next, changed, added }, 'deload.postponed', {
    args: { allowed: true, weeks },
    params: [postpone],
  });
}

/** PRG-11: skips the deload with a note; its sessions become regular sessions. */
export function skipDeload(
  mesocycle: Mesocycle,
  sessions: readonly PlannedSession[],
): Explained<{ readonly mesocycle: Mesocycle; readonly changed: PlannedSession[] }> {
  const byDay = new Map(mesocycle.days.map((day) => [day.key, day]));
  const changed = sessions
    .filter(
      (session) =>
        session.mesocycleIndex === mesocycle.index &&
        session.kind === 'deload' &&
        session.status === 'planned',
    )
    .map((session) =>
      bump(session, {
        kind: 'regular',
        slots: byDay.get(session.dayKey)?.slots ?? session.slots,
        adjustments: session.adjustments.filter((adjustment) => adjustment.kind !== 'deload'),
      }),
    );
  return explained(
    { mesocycle: { ...mesocycle, deload: { ...mesocycle.deload, skipped: true } }, changed },
    'deload.skipped',
    {
      args: { sessions: changed.length },
    },
  );
}

/**
 * PRG-12: brings the deload forward to `week` (accepted from a reactive proposal). That week's
 * sessions become deload sessions; the remaining accumulation weeks and the old deload week are
 * removed (`removed`), so no extra deload is ever added on top of the scheduled one.
 */
export function bringDeloadForward(
  mesocycle: Mesocycle,
  sessions: readonly PlannedSession[],
  week: number,
  rules: DeloadRules,
): Explained<{
  readonly mesocycle: Mesocycle;
  readonly changed: PlannedSession[];
  readonly removed: PlannedSession[];
}> {
  const own = sessions.filter(
    (session) => session.mesocycleIndex === mesocycle.index && session.status === 'planned',
  );
  const changed: PlannedSession[] = [];
  const removed: PlannedSession[] = [];
  for (const session of own) {
    if (session.week < week) continue;
    if (session.week === week && session.kind === 'regular') {
      const deloaded = deloadSlots(session.slots, rules).value;
      changed.push(
        bump(session, {
          kind: 'deload',
          slots: deloaded.slots,
          adjustments: [...session.adjustments, deloaded.adjustment],
        }),
      );
    } else if (session.week > week || session.kind === 'deload') {
      removed.push(session);
    }
  }
  return explained(
    {
      mesocycle: {
        ...mesocycle,
        accumulationWeeks: Math.max(1, week - 1),
        deload: { ...mesocycle.deload, broughtForward: true },
      },
      changed,
      removed,
    },
    'deload.reactive.propose',
    { args: { week, removed: removed.length }, params: [rules['deload.content']] },
  );
}
