import {
  MAX_DISMISSED_ISSUES,
  daysBetween,
  type EquipmentProfile,
  type IsoWeekday,
  type LocalDate,
  type Mesocycle,
  type Plan,
  type PlanDay,
  type PlanId,
  type PlannedSession,
  type PlannedSessionId,
  type PlanSchedule,
  type TemplateDef,
  type VersionStamp,
} from '@powr/domain';
import { applyReturnStep, returnFromBreak } from '@powr/domain/deload';
import type { Explanation } from '@powr/domain/explain';
import {
  applyPlanEdits,
  defaultAccumulationWeeks,
  firstWeekStart,
  generatePlan,
  materializeMesocycle,
  selectTemplate,
  sessionDate,
  validatePlan,
  type EditableWeek,
  type PlanEdit,
  type PlanProposal,
  type PlanRequest,
  type ValidationReport,
} from '@powr/domain/planning';
import type { RuleSet, TraineeLevel } from '@powr/domain/rules';

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
  versionStamp,
  weekStart,
  type PlanOptions,
  type PlanningAnswers,
} from './context';

/** ONB-10 plan preview: the proposal with its explanations, and what accepting needs. */
export interface PlanPreview {
  readonly proposal: PlanProposal;
  /** Why this plan: the template choice, with every key choice as a child (ONB-10). */
  readonly why: Explanation;
  readonly level: TraineeLevel;
  readonly levelWhy: Explanation;
  readonly request: PlanRequest;
  readonly schedule: PlanSchedule;
  /** The first week the plan would start (a week start, SET-11). */
  readonly startDate: LocalDate;
  /** Week 1 on the calendar: each training day with its date (ONB-10 "weekly calendar"). */
  readonly calendar: readonly {
    readonly dayKey: string;
    readonly weekday: IsoWeekday;
    readonly date: LocalDate;
  }[];
  /**
   * PLN-08: the block lengths the user can choose (accumulation weeks before the deload, the
   * registry's range) and the default without a choice (the template's, or the user's own
   * deload interval). The `plan.mesocycle` note among `proposal.notes` explains it.
   */
  readonly blockLength: {
    readonly min: number;
    readonly max: number;
    readonly defaultWeeks: number;
  };
  readonly versions: VersionStamp;
}

export type PlanPreviewError =
  | { readonly kind: 'invalidSchedule'; readonly why: Explanation | null }
  | { readonly kind: 'noPlan'; readonly why: Explanation };

/**
 * ONB-10/PLN-01: generates a plan for the answers (onboarding, or the stored profile when
 * re-planning) and returns the preview with its explanations and PLN-01 report. Writes nothing;
 * changing days, budget, style or template and calling again regenerates (§6.1 step 6). The
 * same answers, options and versions give the same plan.
 */
export async function generatePlanPreview(
  deps: Deps,
  input: {
    readonly answers: PlanningAnswers;
    readonly options?: PlanOptions;
    readonly startTimes?: PlanSchedule['startTimes'];
  },
): Promise<Result<PlanPreview, PlanPreviewError>> {
  const { answers } = input;
  const options = input.options ?? {};
  const weekdays = [...new Set(answers.schedule.weekdays)];
  if (
    weekdays.length < 2 ||
    weekdays.length > 6 ||
    weekdays.length !== answers.schedule.weekdays.length
  ) {
    return err({ kind: 'invalidSchedule', why: null });
  }
  const weekStartsOn = options.weekStartsOn ?? (await weekStart(deps));
  const sex = answers.referenceSet ? { sex: answers.referenceSet } : {};
  const base = await deps.rules.resolve({ style: answers.style, ...sex });
  const level = traineeLevel(answers, base.rules);
  const { rules, restRules } = await planningRules(deps, {
    style: answers.style,
    level: level.value,
    ...sex,
  });
  const request = planRequest(answers, level.value, options, weekStartsOn);
  const generated = generatePlan(request, planningCatalog(deps, restRules), rules);
  if (!generated.value) return err({ kind: 'noPlan', why: generated.why });

  const startDate = firstWeekStart(today(deps), weekdays, weekStartsOn);
  const proposal = generated.value;
  return ok({
    proposal,
    why: generated.why,
    level: level.value,
    levelWhy: level.why,
    request,
    schedule: {
      weekdays: proposal.days.map((day) => day.weekday),
      weekStartsOn,
      sessionMinutes: answers.schedule.sessionMinutes,
      startTimes: input.startTimes ?? [],
    },
    startDate,
    calendar: proposal.days.map((day) => ({
      dayKey: day.key,
      weekday: day.weekday,
      date: sessionDate({ startDate }, 1, day.weekday, weekStartsOn),
    })),
    blockLength: {
      ...rules['planning.mesocycle.accumulationWeeks'].value,
      defaultWeeks: defaultAccumulationWeeks(proposal.template, rules),
    },
    versions: versionStamp(deps),
  });
}

/** PLN-02: one template the user can choose instead of the default, and whether it fits. */
export interface TemplateChoice {
  readonly template: TemplateDef;
  /** The generator's default for these answers (style, days per week, level). */
  readonly recommended: boolean;
  /** The generator's own check of this choice (`selectTemplate`): days, style and level. */
  readonly fits: boolean;
  /** Why it fits (`plan.template.chosen`) or not (`plan.template.none`, `…levelMismatch`). */
  readonly why: Explanation;
}

/**
 * PLN-02 override: the templates of the user's style, the recommended one first, then those
 * that fit the training days and level, then the rest by days per week. Each carries the
 * generator's verdict, so the list can say "needs 4 days" or "for other levels" before the
 * choice; equipment and the time budget show in the generated preview's checks.
 */
export async function templateChoices(
  deps: Deps,
  answers: PlanningAnswers,
): Promise<{ readonly level: TraineeLevel; readonly choices: readonly TemplateChoice[] }> {
  const sex = answers.referenceSet ? { sex: answers.referenceSet } : {};
  const { rules } = await deps.rules.resolve({ style: answers.style, ...sex });
  const level = traineeLevel(answers, rules).value;
  const templates = deps.content.templates();
  const request = { style: answers.style, level, weekdays: answers.schedule.weekdays };
  const recommended = selectTemplate(templates, request).value?.id;
  const choices = templates
    .filter((template) => template.style === answers.style)
    .map((template) => {
      const checked = selectTemplate(templates, { ...request, templateId: template.id });
      return {
        template,
        recommended: template.id === recommended,
        fits: checked.value !== null,
        why: checked.why,
      };
    })
    .toSorted(
      (a, b) =>
        Number(b.recommended) - Number(a.recommended) ||
        Number(b.fits) - Number(a.fits) ||
        a.template.daysPerWeek - b.template.daysPerWeek ||
        (a.template.id < b.template.id ? -1 : a.template.id > b.template.id ? 1 : 0),
    );
  return { level, choices };
}

/** The plan record and its first mesocycle's planned sessions, ready to write. */
export function planRecords(
  deps: Deps,
  preview: PlanPreview,
  input: {
    readonly equipmentProfileId: string;
    readonly startDate?: LocalDate;
    readonly rules: RuleSet;
    /** ONB-04 time off: the first weeks ramp back in (PRG-13). */
    readonly daysOff?: number;
  },
): { readonly plan: Plan; readonly sessions: readonly PlannedSession[] } {
  const startDate = input.startDate ?? preview.startDate;
  const { proposal } = preview;
  const mesocycle: Mesocycle = {
    index: 0,
    startDate,
    accumulationWeeks: proposal.accumulationWeeks,
    deloadWeeks: proposal.deloadWeeks,
    status: 'active',
    level: preview.level,
    days: proposal.days,
    targets: proposal.targets,
    liftTargets: proposal.liftTargets,
    deload: { postponed: false, skipped: false, broughtForward: false },
  };
  const plan: Plan = {
    id: deps.ids.next() as PlanId,
    status: 'active',
    name: proposal.template.name,
    templateId: proposal.template.id,
    style: proposal.template.style,
    split: proposal.template.split,
    periodization: proposal.template.periodization,
    equipmentProfileId: input.equipmentProfileId,
    schedule: preview.schedule,
    variety: preview.request.variety,
    seed: preview.request.seed,
    mesocycles: [mesocycle],
    createdAt: deps.clock.now(),
    versions: preview.versions,
    revision: 0,
    dismissedIssues: [],
  };
  const from = today(deps) > startDate ? today(deps) : startDate;
  const sessions = materializeMesocycle(
    { planId: plan.id, mesocycle, weekStartsOn: preview.schedule.weekStartsOn, from },
    () => deps.ids.next(),
    input.rules,
  );
  return {
    plan,
    sessions: input.daysOff ? rampIn(sessions, from, input.daysOff, input.rules) : sessions,
  };
}

/** PRG-13 for a new plan after time off (ONB-04): the return ramp on the first weeks. */
function rampIn(
  sessions: readonly PlannedSession[],
  from: LocalDate,
  daysOff: number,
  rules: RuleSet,
): PlannedSession[] {
  const ramp = returnFromBreak(daysOff, rules).value;
  // Still training (≤ 7 days off): the plan starts as it is (PRG-13 "resume").
  if (ramp.action === 'resume') return [...sessions];
  const { steps } = ramp;
  return sessions.map((session) => {
    const step = steps.find(
      (candidate) => candidate.week === Math.floor(daysBetween(from, session.localDate) / 7) + 1,
    );
    if (!step || session.kind === 'deload') return session;
    const adjusted = applyReturnStep(session.slots, step, daysOff);
    return {
      ...session,
      slots: adjusted.slots,
      adjustments: [...session.adjustments, adjusted.adjustment],
    };
  });
}

export type AcceptPlanError =
  | { readonly kind: 'noProfile' }
  | { readonly kind: 'unknownEquipmentProfile' };

/**
 * ONB-10 "accept" outside onboarding (re-planning): writes the plan and its first mesocycle's
 * planned sessions in one transaction. A previous active plan ends; its planned sessions from
 * today on are removed (the user chose the new plan), past ones stay as history.
 */
export async function acceptPlan(
  deps: Deps,
  input: {
    readonly preview: PlanPreview;
    readonly equipmentProfileId: string;
    readonly startDate?: LocalDate;
  },
): Promise<Result<{ readonly plan: Plan; readonly sessions: number }, AcceptPlanError>> {
  const { rules } = await deps.rules.resolve({
    style: input.preview.proposal.template.style,
    level: input.preview.level,
  });
  const records = planRecords(deps, input.preview, { ...input, rules });
  const from = today(deps);
  return deps.uow.write(
    ['profile', 'equipmentProfiles', 'plans', 'plannedSessions'],
    async (repos) => {
      if (!(await repos.profile.get())) return err({ kind: 'noProfile' });
      if (!(await repos.equipment.get(input.equipmentProfileId)))
        return err({ kind: 'unknownEquipmentProfile' });
      await endActivePlan(repos, from);
      await repos.plans.put(records.plan);
      await repos.plannedSessions.putMany(records.sessions);
      return ok({ plan: records.plan, sessions: records.sessions.length });
    },
  );
}

/** Ends the active plan: status `ended`, its planned sessions from `from` on removed. */
export async function endActivePlan(
  repos: Parameters<Parameters<Deps['uow']['write']>[1]>[0],
  from: LocalDate,
): Promise<void> {
  const active = await repos.plans.getActive();
  if (!active) return;
  await repos.plans.put({ ...active, status: 'ended', revision: active.revision + 1 });
  const future = (await repos.plannedSessions.byPlan(active.id)).filter(
    (session) => session.status === 'planned' && session.localDate >= from,
  );
  await repos.plannedSessions.deleteMany(future.map((session) => session.id));
}

/** The editable week and the validation context of the active plan's current mesocycle. */
async function editingContext(deps: Deps, planId: PlanId) {
  const loaded = await deps.uow.read(['plans', 'profile', 'equipmentProfiles'], async (repos) => ({
    plan: await repos.plans.get(planId),
    profile: await repos.profile.get(),
    equipment: await repos.equipment.list(),
  }));
  const { plan, profile } = loaded;
  if (!plan || !profile) return null;
  const mesocycle = currentMesocycle(plan);
  const equipment =
    loaded.equipment.find((entry) => entry.id === plan.equipmentProfileId) ?? loaded.equipment[0];
  if (!mesocycle || !equipment) return null;
  const { rules, restRules } = await planningRules(deps, {
    style: plan.style,
    level: mesocycle.level,
  });
  const answers = answersFromProfile(profile, equipment, plan.schedule);
  return { plan, profile, mesocycle, equipment, rules, restRules, answers };
}

/** The mesocycle that is active, else the latest one. */
export function currentMesocycle(plan: Plan): Mesocycle | undefined {
  return (
    plan.mesocycles.find((mesocycle) => mesocycle.status === 'active') ?? plan.mesocycles.at(-1)
  );
}

/** Validates a week of a plan against the user's situation (PLN-01, PLN-09). */
function validateWeek(
  deps: Deps,
  week: EditableWeek,
  context: NonNullable<Awaited<ReturnType<typeof editingContext>>>,
): ValidationReport {
  return validatePlan(
    week.days,
    {
      style: context.plan.style,
      level: context.mesocycle.level,
      sessionMinutes: context.plan.schedule.sessionMinutes,
      equipment: planRequest(
        context.answers,
        context.mesocycle.level,
        {},
        context.plan.schedule.weekStartsOn,
      ).equipment,
      avoid: context.profile.avoid,
      targets: week.targets,
      liftTargets: context.mesocycle.liftTargets,
      accumulationWeeks: context.mesocycle.accumulationWeeks,
      deloadWeeks: context.mesocycle.deloadWeeks,
      exercise: exerciseLookup(deps),
      exercises: deps.content.exercises(),
      restRules: context.restRules,
    },
    context.rules,
  );
}

export interface PlanEditPreview {
  readonly days: readonly PlanDay[];
  readonly targets: EditableWeek['targets'];
  readonly report: ValidationReport;
}

export type PlanEditError = { readonly kind: 'notFound' };

/**
 * PLN-09 live validation: applies the editor's changes to the current mesocycle's week (or the
 * week saved for the next mesocycle) and validates the result. Writes nothing; call it on every
 * change. Validation never blocks saving.
 */
export async function previewPlanEdit(
  deps: Deps,
  input: {
    readonly planId: PlanId;
    readonly edits: readonly PlanEdit[];
    readonly scope?: EditScope;
  },
): Promise<Result<PlanEditPreview, PlanEditError>> {
  const context = await editingContext(deps, input.planId);
  if (!context) return err({ kind: 'notFound' });
  const base =
    input.scope === 'nextMesocycle'
      ? (context.mesocycle.next ?? context.mesocycle)
      : context.mesocycle;
  const week = applyPlanEdits(
    { days: base.days, targets: base.targets },
    input.edits,
    exerciseLookup(deps),
    context.rules,
  );
  return ok({ ...week, report: validateWeek(deps, week, context) });
}

/** PLN-09: edits apply from the next session, or only from the next mesocycle. */
export type EditScope = 'nextSession' | 'nextMesocycle';

/**
 * PLN-09 save. `nextSession`: the current mesocycle's week changes, and its planned sessions from
 * today on are rebuilt from it (same IDs where a day stays, revision bumped for calendar
 * export). `nextMesocycle`: the edited week is kept for the next mesocycle (PLN-13 starts from
 * it). Returns the validation report of the saved week.
 */
export async function savePlanEdit(
  deps: Deps,
  input: {
    readonly planId: PlanId;
    readonly edits: readonly PlanEdit[];
    readonly scope: EditScope;
  },
): Promise<Result<{ readonly plan: Plan; readonly report: ValidationReport }, PlanEditError>> {
  const context = await editingContext(deps, input.planId);
  if (!context) return err({ kind: 'notFound' });
  const { plan, mesocycle } = context;
  const base = input.scope === 'nextMesocycle' ? (mesocycle.next ?? mesocycle) : mesocycle;
  const week = applyPlanEdits(
    { days: base.days, targets: base.targets },
    input.edits,
    exerciseLookup(deps),
    context.rules,
  );
  const report = validateWeek(deps, week, context);
  const updated: Mesocycle =
    input.scope === 'nextMesocycle'
      ? { ...mesocycle, next: { days: week.days, targets: week.targets } }
      : { ...mesocycle, days: week.days, targets: week.targets };
  const next: Plan = {
    ...plan,
    mesocycles: plan.mesocycles.map((entry) => (entry.index === mesocycle.index ? updated : entry)),
    revision: plan.revision + 1,
  };
  const from = today(deps);
  await deps.uow.write(['plans', 'plannedSessions'], async (repos) => {
    await repos.plans.put(next);
    if (input.scope === 'nextMesocycle') return;
    const existing = (await repos.plannedSessions.byPlan(plan.id)).filter(
      (session) =>
        session.mesocycleIndex === mesocycle.index &&
        session.status === 'planned' &&
        session.localDate >= from,
    );
    const rebuilt = rematerialize(deps, next, updated, existing, from, context.rules);
    await repos.plannedSessions.deleteMany(rebuilt.removed);
    await repos.plannedSessions.putMany(rebuilt.sessions);
  });
  return ok({ plan: next, report });
}

/**
 * Rebuilds a mesocycle's planned sessions from `from` on after its week changed, keeping the ID
 * (and bumping the revision) of a session whose week and day still exist.
 */
function rematerialize(
  deps: Deps,
  plan: Plan,
  mesocycle: Mesocycle,
  existing: readonly PlannedSession[],
  from: LocalDate,
  rules: RuleSet,
): { readonly sessions: readonly PlannedSession[]; readonly removed: readonly PlannedSessionId[] } {
  const fresh = materializeMesocycle(
    { planId: plan.id, mesocycle, weekStartsOn: plan.schedule.weekStartsOn, from },
    () => deps.ids.next(),
    rules,
  );
  const byKey = new Map(existing.map((session) => [`${session.week}/${session.dayKey}`, session]));
  const sessions = fresh.map((session) => {
    const old = byKey.get(`${session.week}/${session.dayKey}`);
    if (!old) return session;
    // Work merged in from a missed session stays as it was merged (PLN-11).
    if (old.adjustments.some((adjustment) => adjustment.kind === 'mergedWork')) return old;
    // A return-from-break step applies again to the rebuilt slots (PRG-13).
    let rebuilt: PlannedSession = { ...session, id: old.id, revision: old.revision + 1 };
    for (const adjustment of old.adjustments) {
      if (adjustment.kind !== 'returnFromBreak' && adjustment.kind !== 'recalibrate') continue;
      const step = {
        week: 1,
        loadPct: adjustment.loadPct ?? null,
        setsPct: adjustment.setsPct ?? null,
        rirAdd: adjustment.rirAdd ?? 0,
        calibrationRir:
          adjustment.kind === 'recalibrate'
            ? ([
                rules['progression.calibration'].value.targetRir.min,
                rules['progression.calibration'].value.targetRir.max,
              ] as const)
            : null,
        notes: adjustment.notes,
      };
      const applied = applyReturnStep(rebuilt.slots, step, adjustment.daysOff ?? 0);
      rebuilt = {
        ...rebuilt,
        slots: applied.slots,
        adjustments: [...rebuilt.adjustments, applied.adjustment],
      };
    }
    return rebuilt;
  });
  const kept = new Set(sessions.map((session) => session.id));
  return {
    sessions,
    removed: existing.filter((session) => !kept.has(session.id)).map((session) => session.id),
  };
}

export type DismissIssueError = { readonly kind: 'notFound' };

/**
 * PLN-09 "warnings are dismissible and are not shown again for the same plan state": stores the
 * issue's `key` (it encodes the numbers, so a changed plan shows the warning again) on the plan.
 * Idempotent; not a plan edit, so the revision stays. The oldest keys go beyond
 * `MAX_DISMISSED_ISSUES`.
 */
export async function dismissPlanIssue(
  deps: Deps,
  input: { readonly planId: PlanId; readonly key: string },
): Promise<Result<void, DismissIssueError>> {
  return deps.uow.write(['plans'], async (repos) => {
    const plan = await repos.plans.get(input.planId);
    if (!plan) return err({ kind: 'notFound' });
    if (plan.dismissedIssues.includes(input.key)) return ok(undefined);
    const dismissedIssues = [...plan.dismissedIssues, input.key].slice(-MAX_DISMISSED_ISSUES);
    await repos.plans.put({ ...plan, dismissedIssues });
    return ok(undefined);
  });
}

/** Shows every dismissed warning of the plan again (PLN-09). */
export async function restorePlanIssues(
  deps: Deps,
  input: { readonly planId: PlanId },
): Promise<Result<void, DismissIssueError>> {
  return deps.uow.write(['plans'], async (repos) => {
    const plan = await repos.plans.get(input.planId);
    if (!plan) return err({ kind: 'notFound' });
    if (plan.dismissedIssues.length > 0) await repos.plans.put({ ...plan, dismissedIssues: [] });
    return ok(undefined);
  });
}

/** The equipment profile a plan uses (or the default one). */
export function planEquipment(
  plan: Plan,
  profiles: readonly EquipmentProfile[],
): EquipmentProfile | undefined {
  return (
    profiles.find((entry) => entry.id === plan.equipmentProfileId) ??
    profiles.find((entry) => entry.isDefault)
  );
}
