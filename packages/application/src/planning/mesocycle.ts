import {
  addDays,
  daysBetween,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type Mesocycle,
  type MuscleId,
  type Plan,
  type PlanId,
  type PlannedSession,
} from '@powr/domain';
import { reactiveDeload as evaluateReactive, type ReactiveSignal } from '@powr/domain/deload';
import { estimateSetE1rm, sessionE1rm } from '@powr/domain/e1rm';
import type { Explanation } from '@powr/domain/explain';
import {
  bringDeloadForward as bringForward,
  materializeMesocycle,
  postponeDeload as postponeOne,
  proposeNextMesocycle as proposeNext,
  skipDeload as skipOne,
  type NextMesocycleProposal,
} from '@powr/domain/planning';
import { weeklyMuscleVolume } from '@powr/domain/volume';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import {
  answersFromProfile,
  exerciseLookup,
  planRequest,
  planningCatalog,
  planningRules,
  today,
  traineeLevel,
} from './context';
import { currentMesocycle, planEquipment } from './plan';

export type MesocycleError =
  | { readonly kind: 'notFound' }
  | { readonly kind: 'notAllowed'; readonly why: Explanation };

/** PRG-11: postpones the current mesocycle's deload by a week, once per mesocycle. */
export async function postponeDeload(
  deps: Deps,
  planId: PlanId,
): Promise<Result<{ readonly why: Explanation }, MesocycleError>> {
  const loaded = await loadPlan(deps, planId);
  if (!loaded) return err({ kind: 'notFound' });
  const { plan, mesocycle, sessions } = loaded;
  const { rules } = await planningRules(deps, { style: plan.style, level: mesocycle.level });
  const result = postponeOne(
    mesocycle,
    sessions,
    plan.id,
    plan.schedule.weekStartsOn,
    () => deps.ids.next(),
    rules,
  );
  if (!result.value) return err({ kind: 'notAllowed', why: result.why });
  const { changed, added } = result.value;
  await savePlanSessions(deps, replaceMesocycle(plan, result.value.mesocycle), [
    ...changed,
    ...added,
  ]);
  return ok({ why: result.why });
}

/** PRG-11: skips the deload with a note; its sessions become regular sessions. */
export async function skipDeload(
  deps: Deps,
  planId: PlanId,
): Promise<Result<{ readonly why: Explanation }, MesocycleError>> {
  const loaded = await loadPlan(deps, planId);
  if (!loaded) return err({ kind: 'notFound' });
  const result = skipOne(loaded.mesocycle, loaded.sessions);
  await savePlanSessions(
    deps,
    replaceMesocycle(loaded.plan, result.value.mesocycle),
    result.value.changed,
  );
  return ok({ why: result.why });
}

export interface ReactiveDeloadCheck {
  readonly propose: boolean;
  readonly signals: readonly ReactiveSignal[];
  /** The week the deload would move to (the next one), when proposed. */
  readonly week: number | null;
  readonly why: Explanation;
}

/**
 * PRG-12: checks the reactive deload signals for the active plan: session e1RMs of the main
 * lifts (the primary lift slots) declining in a row, plus readiness and pain signals, which
 * arrive with M3 (RDY-02) and v1.3 (RDY-04) and are passed in until then. Proposes only while
 * the scheduled deload is more than a week away, so no extra deload is ever added.
 */
export async function checkReactiveDeload(
  deps: Deps,
  input: {
    readonly planId: PlanId;
    readonly lowReadinessDays?: number;
    readonly painFlags?: number;
  },
): Promise<Result<ReactiveDeloadCheck, MesocycleError>> {
  const loaded = await loadPlan(deps, input.planId);
  if (!loaded) return err({ kind: 'notFound' });
  const { plan, mesocycle } = loaded;
  const { rules } = await planningRules(deps, { style: plan.style, level: mesocycle.level });
  const now = today(deps);
  const sets = await deps.uow.read(['sets'], (repos) =>
    repos.sets.inRange(mesocycle.startDate, now),
  );
  const mainLifts = [
    ...new Set(
      mesocycle.days.flatMap((day) =>
        day.slots
          .filter((slot) => slot.lift && slot.priority === 'primary')
          .map((slot) => slot.exerciseId),
      ),
    ),
  ];
  const lookup = exerciseLookup(deps);
  const trends = mainLifts.map((exerciseId) => ({
    exerciseId,
    values: sessionE1rms(sets, exerciseId, lookup, rules),
  }));
  const evaluated = evaluateReactive(
    {
      mainLifts: trends,
      lowReadinessDays: input.lowReadinessDays ?? 0,
      painFlags: input.painFlags ?? 0,
    },
    rules,
  );
  const currentWeek = Math.floor(daysBetween(mesocycle.startDate, now) / 7) + 1;
  const room = mesocycle.accumulationWeeks - currentWeek > 1;
  const propose = evaluated.value.propose && room && !mesocycle.deload.broughtForward;
  return ok({
    propose,
    signals: evaluated.value.signals,
    week: propose ? currentWeek + 1 : null,
    why: evaluated.why,
  });
}

/** Session e1RMs of one exercise, in date order (PRG-01: the weighted top-set estimate). */
function sessionE1rms(
  sets: readonly LoggedSet[],
  exerciseId: ExerciseId,
  lookup: ReturnType<typeof exerciseLookup>,
  rules: Parameters<typeof estimateSetE1rm>[3],
): number[] {
  const exercise = lookup(exerciseId);
  if (!exercise) return [];
  const bySession = new Map<string, LoggedSet[]>();
  for (const set of sets.filter((candidate) => candidate.exerciseId === exerciseId)) {
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set]);
  }
  return [...bySession.values()]
    .map((sessionSets) => {
      const ordered = sessionSets.toSorted((a, b) => a.index - b.index);
      const estimates = ordered.flatMap(
        (set, order) => estimateSetE1rm(set, exercise.load, { setOrder: order }, rules).value ?? [],
      );
      return { date: ordered[0]!.performedAt.epochMs, e1rm: sessionE1rm(estimates).value?.e1rmKg };
    })
    .filter((point): point is { date: number; e1rm: number } => point.e1rm !== undefined)
    .toSorted((a, b) => a.date - b.date)
    .map((point) => point.e1rm);
}

/** PRG-12: accepts a reactive proposal: the deload moves to `week`; no extra deload is added. */
export async function bringDeloadForward(
  deps: Deps,
  input: { readonly planId: PlanId; readonly week: number },
): Promise<Result<{ readonly why: Explanation }, MesocycleError>> {
  const loaded = await loadPlan(deps, input.planId);
  if (!loaded) return err({ kind: 'notFound' });
  const { rules } = await planningRules(deps, {
    style: loaded.plan.style,
    level: loaded.mesocycle.level,
  });
  const result = bringForward(loaded.mesocycle, loaded.sessions, input.week, rules);
  await deps.uow.write(['plans', 'plannedSessions'], async (repos) => {
    await repos.plans.put(replaceMesocycle(loaded.plan, result.value.mesocycle));
    await repos.plannedSessions.putMany(result.value.changed);
    await repos.plannedSessions.deleteMany(result.value.removed.map((session) => session.id));
  });
  return ok({ why: result.why });
}

/** PLN-13 preview: the proposal (rotations, targets, report) and why. */
export interface NextMesocyclePreview {
  readonly planId: PlanId;
  readonly proposal: NextMesocycleProposal;
  readonly why: Explanation;
  readonly levelWhy: Explanation;
}

/**
 * PLN-13: proposes the next mesocycle of the active plan: the level re-evaluated (PRG-10), 1–2
 * exercises per muscle rotated (competition lifts and locked slots kept), targets adjusted to
 * the volume logged in the accumulation weeks (at most ×1.2), sets re-allocated with the plan
 * template's time-budget step (PLN-14, TD-36), PLN-01 report. It starts the week after the
 * current deload. Writes nothing; the user reviews and accepts.
 */
export async function proposeNextMesocycle(
  deps: Deps,
  planId: PlanId,
): Promise<Result<NextMesocyclePreview, MesocycleError>> {
  const loaded = await loadPlan(deps, planId);
  if (!loaded) return err({ kind: 'notFound' });
  const { plan, mesocycle } = loaded;
  const context = await deps.uow.read(['profile', 'equipmentProfiles'], async (repos) => ({
    profile: await repos.profile.get(),
    equipment: await repos.equipment.list(),
  }));
  const equipment = planEquipment(plan, context.equipment);
  const template = deps.content.templates().find((entry) => entry.id === plan.templateId);
  if (!context.profile || !equipment || !template) return err({ kind: 'notFound' });
  const answers = answersFromProfile(context.profile, equipment, plan.schedule);
  const base = await deps.rules.resolve({ style: plan.style });
  const level = traineeLevel(answers, base.rules);
  const { rules, restRules } = await planningRules(deps, { style: plan.style, level: level.value });
  const startDate = addDays(
    mesocycle.startDate,
    7 * (mesocycle.accumulationWeeks + mesocycle.deloadWeeks),
  );
  const accumulationEnd = addDays(mesocycle.startDate, 7 * mesocycle.accumulationWeeks - 1);
  const logged = await loggedWeeklyVolume(
    deps,
    mesocycle.startDate,
    accumulationEnd,
    mesocycle.accumulationWeeks,
    rules,
  );
  const request = planRequest(
    answers,
    level.value,
    { variety: plan.variety, seed: plan.seed + mesocycle.index + 1 },
    plan.schedule.weekStartsOn,
  );
  const proposed = proposeNext(
    { current: mesocycle, template, request, logged, startDate },
    planningCatalog(deps, restRules),
    rules,
  );
  return ok({ planId, proposal: proposed.value, why: proposed.why, levelWhy: level.why });
}

/** Mean weekly fractional sets per display group over the logged weeks, or null without logs. */
async function loggedWeeklyVolume(
  deps: Deps,
  from: LocalDate,
  to: LocalDate,
  weeks: number,
  rules: Parameters<typeof weeklyMuscleVolume>[3],
): Promise<ReadonlyMap<MuscleId, number> | null> {
  const sets = await deps.uow.read(['sets'], (repos) => repos.sets.inRange(from, to));
  if (sets.length === 0) return null;
  const weekly = weeklyMuscleVolume(sets, (id) => deps.content.exercise(id)?.muscles, 1, rules);
  const totals = new Map<MuscleId, number>();
  for (const week of weekly.values()) {
    for (const [muscle, volume] of week.value) {
      if (muscle.split('.').length === 2)
        totals.set(muscle, (totals.get(muscle) ?? 0) + volume.fractional);
    }
  }
  return new Map([...totals].map(([muscle, total]) => [muscle, total / Math.max(1, weeks)]));
}

/** PLN-13: accepts a proposal: the current mesocycle completes, the new one is scheduled. */
export async function acceptNextMesocycle(
  deps: Deps,
  preview: NextMesocyclePreview,
): Promise<Result<{ readonly sessions: number }, MesocycleError>> {
  const loaded = await loadPlan(deps, preview.planId);
  if (!loaded) return err({ kind: 'notFound' });
  const { plan } = loaded;
  const next: Mesocycle = { ...preview.proposal.mesocycle, status: 'active' };
  const updated: Plan = {
    ...plan,
    mesocycles: [
      ...plan.mesocycles.map((entry) =>
        entry.status === 'active' ? { ...entry, status: 'completed' as const } : entry,
      ),
      next,
    ],
    revision: plan.revision + 1,
  };
  const { rules } = await planningRules(deps, { style: plan.style, level: next.level });
  const from = today(deps) > next.startDate ? today(deps) : next.startDate;
  const sessions = materializeMesocycle(
    { planId: plan.id, mesocycle: next, weekStartsOn: plan.schedule.weekStartsOn, from },
    () => deps.ids.next(),
    rules,
  );
  await savePlanSessions(deps, updated, sessions);
  return ok({ sessions: sessions.length });
}

async function loadPlan(deps: Deps, planId: PlanId) {
  const { plan, sessions } = await deps.uow.read(['plans', 'plannedSessions'], async (repos) => {
    const found = await repos.plans.get(planId);
    return { plan: found, sessions: found ? await repos.plannedSessions.byPlan(found.id) : [] };
  });
  const mesocycle = plan ? currentMesocycle(plan) : undefined;
  return plan && mesocycle ? { plan, mesocycle, sessions } : null;
}

function replaceMesocycle(plan: Plan, mesocycle: Mesocycle): Plan {
  return {
    ...plan,
    mesocycles: plan.mesocycles.map((entry) =>
      entry.index === mesocycle.index ? mesocycle : entry,
    ),
    revision: plan.revision + 1,
  };
}

async function savePlanSessions(deps: Deps, plan: Plan, sessions: readonly PlannedSession[]) {
  await deps.uow.write(['plans', 'plannedSessions'], async (repos) => {
    await repos.plans.put(plan);
    await repos.plannedSessions.putMany(sessions);
  });
}
