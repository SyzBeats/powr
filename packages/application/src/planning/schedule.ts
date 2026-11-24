import {
  addDays,
  daysBetween,
  type BreakId,
  type BreakReason,
  type LocalDate,
  type PlannedSession,
  type PlannedSessionId,
  type TrainingBreak,
} from '@powr/domain';
import type { Explanation } from '@powr/domain/explain';
import {
  doMissedToday,
  mergeMissed,
  missedSessions,
  moveSession as moveOne,
  pauseForBreak,
  resumeAfterBreak,
  sessionSpacing,
  skipSession,
  swapSessions as swapTwo,
  type SpacingConflict,
} from '@powr/domain/planning';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { exerciseLookup, planningRules, today } from './context';
import { currentMesocycle } from './plan';

/** A schedule change and the spacing warnings of the affected days afterwards (PLN-11). */
export interface ScheduleChange {
  readonly changed: readonly PlannedSession[];
  readonly why: Explanation;
  /** PLN-04 spacing conflicts in the plan weeks the change touched. */
  readonly spacing: readonly SpacingConflict[];
}

export type ScheduleError =
  | { readonly kind: 'notFound' }
  | { readonly kind: 'notPlanned' }
  | { readonly kind: 'noTarget' }
  | { readonly kind: 'invalidDates' };

/** PLN-11: moves a planned session to another day (also "train early"). */
export async function moveSession(
  deps: Deps,
  input: { readonly sessionId: PlannedSessionId; readonly date: LocalDate },
): Promise<Result<ScheduleChange, ScheduleError>> {
  const session = await loadSession(deps, input.sessionId);
  if (!session) return err({ kind: 'notFound' });
  if (session.status !== 'planned') return err({ kind: 'notPlanned' });
  const moved = moveOne(session, input.date);
  return ok(await commit(deps, [moved.value], moved.why));
}

/** PLN-11: swaps the days of two planned sessions. */
export async function swapSessions(
  deps: Deps,
  input: { readonly a: PlannedSessionId; readonly b: PlannedSessionId },
): Promise<Result<ScheduleChange, ScheduleError>> {
  const [a, b] = await Promise.all([loadSession(deps, input.a), loadSession(deps, input.b)]);
  if (!a || !b) return err({ kind: 'notFound' });
  if (a.status !== 'planned' || b.status !== 'planned') return err({ kind: 'notPlanned' });
  const swapped = swapTwo(a, b);
  return ok(await commit(deps, [...swapped.value], swapped.why));
}

/** PLN-11/PLN-12: planned sessions of the active plan whose day passed, outside breaks. */
export async function listMissedSessions(deps: Deps): Promise<readonly PlannedSession[]> {
  const { sessions, breaks } = await deps.uow.read(
    ['plans', 'plannedSessions', 'breaks'],
    async (repos) => {
      const plan = await repos.plans.getActive();
      return {
        sessions: plan ? await repos.plannedSessions.byPlan(plan.id) : [],
        breaks: await repos.breaks.list(),
      };
    },
  );
  return missedSessions(sessions, today(deps), breaks);
}

export type MissedChoice = 'doToday' | 'skip' | 'merge';

/**
 * PLN-11: resolves a missed session the user's way: do it today (the rest of the week shifts),
 * skip it, or merge its key work into the next session. Planned work is never dropped silently.
 */
export async function resolveMissedSession(
  deps: Deps,
  input: { readonly sessionId: PlannedSessionId; readonly choice: MissedChoice },
): Promise<Result<ScheduleChange, ScheduleError>> {
  const missed = await loadSession(deps, input.sessionId);
  if (!missed) return err({ kind: 'notFound' });
  if (missed.status !== 'planned') return err({ kind: 'notPlanned' });
  if (input.choice === 'skip') {
    const skipped = skipSession(missed);
    return ok(await commit(deps, [skipped.value], skipped.why));
  }
  const { plan, sessions } = await deps.uow.read(['plans', 'plannedSessions'], async (repos) => {
    const owner = await repos.plans.get(missed.planId);
    return { plan: owner, sessions: owner ? await repos.plannedSessions.byPlan(owner.id) : [] };
  });
  if (!plan) return err({ kind: 'notFound' });
  if (input.choice === 'doToday') {
    const moved = doMissedToday(missed, sessions, today(deps), plan.schedule.weekStartsOn);
    return ok(await commit(deps, moved.value, moved.why));
  }
  const mesocycle = currentMesocycle(plan);
  const { rules } = await planningRules(deps, {
    style: plan.style,
    level: mesocycle?.level ?? 'intermediate',
  });
  const merged = mergeMissed(missed, sessions, exerciseLookup(deps), rules);
  if (!merged.value) return err({ kind: 'noTarget' });
  return ok(await commit(deps, merged.value, merged.why));
}

/**
 * PLN-12: declares a break (vacation, illness, life event) from `startDate`, open-ended or until
 * `endDate`. Planned sessions inside are paused, so they never count as missed.
 */
export async function startBreak(
  deps: Deps,
  input: {
    readonly startDate: LocalDate;
    readonly endDate?: LocalDate;
    readonly reason: BreakReason;
    readonly note?: string;
  },
): Promise<Result<{ readonly entry: TrainingBreak; readonly paused: number }, ScheduleError>> {
  if (input.endDate !== undefined && input.endDate < input.startDate)
    return err({ kind: 'invalidDates' });
  const entry: TrainingBreak = {
    id: deps.ids.next() as BreakId,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    reason: input.reason,
    ...(input.note ? { note: input.note.slice(0, 2000) } : {}),
    createdAt: deps.clock.now(),
  };
  const paused = await deps.uow.write(['breaks', 'plans', 'plannedSessions'], async (repos) => {
    await repos.breaks.put(entry);
    const plan = await repos.plans.getActive();
    if (!plan) return 0;
    const changed = pauseForBreak(await repos.plannedSessions.byPlan(plan.id), entry);
    await repos.plannedSessions.putMany(changed);
    return changed.length;
  });
  return ok({ entry, paused });
}

/**
 * PLN-12/PRG-13: ends a break (today, or on `endDate`). Days off count from the last trained
 * session before the break (or the break's start) to the return day; the return-from-break ramp
 * for them adjusts the next weeks' planned sessions, and paused sessions from the return day on
 * are planned again.
 */
export async function endBreak(
  deps: Deps,
  input: { readonly breakId: BreakId; readonly endDate?: LocalDate },
): Promise<
  Result<
    { readonly entry: TrainingBreak; readonly daysOff: number; readonly adjusted: ScheduleChange },
    ScheduleError
  >
> {
  const loaded = await deps.uow.read(
    ['breaks', 'plans', 'plannedSessions', 'sessions'],
    async (repos) => {
      const entry = await repos.breaks.get(input.breakId);
      const plan = await repos.plans.getActive();
      const logged = entry ? await repos.sessions.latestBefore(entry.startDate) : undefined;
      return {
        entry,
        plan,
        logged,
        sessions: plan ? await repos.plannedSessions.byPlan(plan.id) : [],
      };
    },
  );
  const { entry, plan } = loaded;
  if (!entry) return err({ kind: 'notFound' });
  const endDate = input.endDate ?? addDays(today(deps), -1);
  if (endDate < entry.startDate) return err({ kind: 'invalidDates' });
  const returnDate = addDays(endDate, 1);
  // Days since the last logged session before the break (PRG-13), else since the break began.
  const lastTrained = loaded.logged?.localDate;
  const daysOff = daysBetween(lastTrained ?? addDays(entry.startDate, -1), returnDate);
  const mesocycle = plan ? currentMesocycle(plan) : undefined;
  const { rules } = await planningRules(deps, {
    style: plan?.style ?? 'bodybuilding',
    level: mesocycle?.level ?? 'intermediate',
  });
  const resumed = resumeAfterBreak(loaded.sessions, returnDate, daysOff, rules);
  const ended: TrainingBreak = { ...entry, endDate };
  await deps.uow.write(['breaks', 'plannedSessions'], async (repos) => {
    await repos.breaks.put(ended);
    await repos.plannedSessions.putMany(resumed.value);
  });
  return ok({
    entry: ended,
    daysOff,
    adjusted: { changed: resumed.value, why: resumed.why, spacing: [] },
  });
}

async function loadSession(deps: Deps, id: PlannedSessionId): Promise<PlannedSession | undefined> {
  return deps.uow.read(['plannedSessions'], (repos) => repos.plannedSessions.get(id));
}

/** Writes the changed sessions and returns the spacing warnings of their plan weeks. */
async function commit(
  deps: Deps,
  changed: readonly PlannedSession[],
  why: Explanation,
): Promise<ScheduleChange> {
  const sessions = await deps.uow.write(['plannedSessions'], async (repos) => {
    await repos.plannedSessions.putMany(changed);
    const first = changed[0];
    return first ? repos.plannedSessions.byPlan(first.planId) : [];
  });
  const weeks = new Set(changed.map((session) => `${session.mesocycleIndex}/${session.week}`));
  const touched = sessions.filter((session) =>
    weeks.has(`${session.mesocycleIndex}/${session.week}`),
  );
  const plan = changed[0]
    ? await deps.uow.read(['plans'], (repos) => repos.plans.get(changed[0]!.planId))
    : undefined;
  const level = plan ? (currentMesocycle(plan)?.level ?? 'intermediate') : 'intermediate';
  const { rules } = await planningRules(deps, { style: plan?.style ?? 'bodybuilding', level });
  return { changed, why, spacing: sessionSpacing(touched, exerciseLookup(deps), rules) };
}
