import { isAvailable, missingEquipment } from '../equipment';
import { explain, type ExplanationParts } from '../explain';
import type { RuleId } from '../explain';
import type { MuscleId } from '../ids';
import type { CompetitionLift, ExerciseDef, MovementPattern, PlanDay, PlanSlot } from '../model';
import { SetLedger, type SetBlocker, type WorkDay } from './allocate';
import { analyzeWeek, dayMinutes, meanReps, repRangesOf, rirRangesOf, setsOf } from './analysis';
import { compareIds, creditFor, groupCredits, liftOf } from './credits';
import { rankCandidates, isEligible } from './select';
import { bestArrangement, spacingConflicts, weekOffset } from './spacing';
import {
  PLAN_CONSTRAINTS,
  type IssueCause,
  type IssueSubject,
  type PlanConstraint,
  type PlanFix,
  type PlanningRules,
  type ValidationContext,
  type ValidationIssue,
  type ValidationReport,
} from './types';

/**
 * PLN-01 constraint report for a week template, generated or edited (PLN-09 live validation):
 * equipment and avoid list, weekly volume against the targets, frequency, per-session caps,
 * strength dose per lift, time budget, recovery spacing, coverage and order, prescriptions and
 * the deload week. Every issue carries the rule and registry parameters it rests on and, where a
 * change of the plan resolves it, concrete fixes; issues the inputs make unavoidable name their
 * cause (time budget, equipment, template, …) instead. Validation never blocks saving.
 */
export function validatePlan(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  rules: PlanningRules,
): ValidationReport {
  const issues: ValidationIssue[] = [];
  const lookup = ctx.exercise;
  const analysis = analyzeWeek(days, lookup, ctx.targets, ctx.liftTargets, rules);
  const add = (
    constraint: PlanConstraint,
    severity: ValidationIssue['severity'],
    subject: IssueSubject,
    rule: RuleId,
    parts: ExplanationParts & {
      readonly key: string;
      readonly cause?: IssueCause | null;
      readonly fixes?: readonly PlanFix[];
    },
  ) =>
    issues.push({
      key: `${rule.replace('validate.', '')}:${subjectKey(subject)}:${parts.key}`,
      constraint,
      severity,
      subject,
      cause: parts.cause ?? null,
      why: explain(rule, parts),
      fixes: parts.fixes ?? [],
    });

  checkEquipment(days, ctx, rules, add);
  checkVolume(days, ctx, analysis, rules, add);
  checkFrequency(days, ctx, analysis, rules, add);
  checkSessionCaps(analysis, rules, add);
  checkStrengthDose(days, ctx, analysis, rules, add);
  checkTime(days, ctx, analysis, rules, add);
  checkSpacing(days, ctx, rules, add);
  checkCoverage(days, ctx, rules, add);
  checkPrescriptions(days, ctx, rules, add);
  checkMesocycle(ctx, rules, add);

  const sorted = issues.toSorted(
    (a, b) =>
      PLAN_CONSTRAINTS.indexOf(a.constraint) - PLAN_CONSTRAINTS.indexOf(b.constraint) ||
      compareIds(a.key, b.key),
  );
  return {
    ok: sorted.every((issue) => issue.severity !== 'violation' || issue.cause !== null),
    constraints: PLAN_CONSTRAINTS.map((constraint) => {
      const own = sorted.filter((issue) => issue.constraint === constraint);
      return {
        constraint,
        status: own.some((issue) => issue.severity === 'violation')
          ? 'violated'
          : own.length > 0
            ? 'warning'
            : 'satisfied',
      };
    }),
    issues: sorted,
    analysis,
  };
}

type Add = (
  constraint: PlanConstraint,
  severity: ValidationIssue['severity'],
  subject: IssueSubject,
  rule: RuleId,
  parts: ExplanationParts & {
    readonly key: string;
    readonly cause?: IssueCause | null;
    readonly fixes?: readonly PlanFix[];
  },
) => void;

function subjectKey(subject: IssueSubject): string {
  if (subject.kind === 'muscle') return subject.muscle;
  if (subject.kind === 'lift') return subject.lift;
  if (subject.kind === 'day') return subject.dayKey;
  if (subject.kind === 'slot') return `${subject.dayKey}/${subject.slotKey}`;
  return 'plan';
}

/** EQP-04, EXL-08: every exercise available and none avoided. */
function checkEquipment(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  rules: PlanningRules,
  add: Add,
) {
  for (const day of days)
    for (const slot of day.slots) {
      const exercise = ctx.exercise(slot.exerciseId);
      const subject: IssueSubject = { kind: 'slot', dayKey: day.key, slotKey: slot.key };
      const swap = () => {
        const best = rankCandidates(
          slot,
          ctx.exercises,
          { ...ctx, preferred: [] },
          ctx.exercise,
          rules,
        )[0];
        return best
          ? [
              {
                kind: 'swapExercise' as const,
                dayKey: day.key,
                slotKey: slot.key,
                exerciseId: best.exerciseId,
              },
            ]
          : [];
      };
      if (!exercise || !isAvailable(exercise, ctx.equipment)) {
        add('equipment', 'violation', subject, 'validate.equipment.unavailable', {
          key: slot.exerciseId,
          args: { exercise: slot.exerciseId },
          children: exercise ? [missingEquipment(exercise, ctx.equipment).why] : [],
          fixes: swap(),
        });
      }
      if (
        ctx.avoid.exercises.includes(slot.exerciseId) ||
        (exercise && ctx.avoid.patterns.includes(exercise.pattern))
      ) {
        add('equipment', 'violation', subject, 'validate.avoided', {
          key: slot.exerciseId,
          args: { exercise: slot.exerciseId },
          fixes: swap(),
        });
      }
    }
}

/** Work days for the shared "can one more set fit?" check. */
function workDays(days: readonly PlanDay[], ctx: ValidationContext): WorkDay[] {
  return days.map((day) => ({
    key: day.key,
    slots: day.slots.flatMap((plan) => {
      const exercise = ctx.exercise(plan.exerciseId);
      return exercise ? [{ exercise, plan }] : [];
    }),
  }));
}

/** PLN-03: each target muscle within its band; targets themselves within the evidence bands. */
function checkVolume(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  analysis: ValidationReport['analysis'],
  rules: PlanningRules,
  add: Add,
) {
  const bandsParam = rules['volume.hypertrophy.weeklyBands'];
  const bands = bandsParam.value;
  const targets = new Map(ctx.targets.map((target) => [target.muscle, target.sets]));
  const work = workDays(days, ctx);
  const ledger = new SetLedger(work, targets, ctx.sessionMinutes, rules);
  for (const target of ctx.targets) {
    const week = analysis.muscles.find((muscle) => muscle.muscle === target.muscle);
    const fractional = week?.fractional ?? 0;
    const subject: IssueSubject = { kind: 'muscle', muscle: target.muscle };
    const args = { muscle: target.muscle, sets: round1(fractional), target: target.sets };
    if (target.sets < bands.floor || target.sets > bands.highHigh) {
      add('volume', 'warning', subject, 'validate.volume.targetOutsideBand', {
        key: String(target.sets),
        args,
        params: [bandsParam],
      });
    }
    const low = Math.min(target.sets, bands.defaultLow);
    const high = Math.max(target.sets, bands.defaultHigh);
    if (fractional + 1e-9 < low) {
      const room = headroom(target.muscle, work, ledger);
      add(
        'volume',
        'violation',
        subject,
        fractional < bands.floor ? 'validate.volume.belowFloor' : 'validate.volume.low',
        {
          key: String(round1(fractional)),
          args,
          params: [
            bandsParam,
            rules['volume.hypertrophy.perSessionSoftCap'],
            rules['planning.slot.sets'],
          ],
          cause: room.fix ? null : room.cause,
          fixes: room.fix ? [room.fix] : [],
        },
      );
    } else if (fractional > bands.hardWarnAbove) {
      add('volume', 'violation', subject, 'validate.volume.veryHigh', {
        key: String(round1(fractional)),
        args,
        params: [bandsParam],
      });
    } else if (fractional > high) {
      add(
        'volume',
        'warning',
        subject,
        fractional > bands.highHigh ? 'validate.volume.veryHigh' : 'validate.volume.high',
        {
          key: String(round1(fractional)),
          args,
          params: [bandsParam],
        },
      );
    }
  }
}

/**
 * Whether a muscle could get another set somewhere, and if not, what stops it: the first limit
 * of time budget, per-session cap, set limit or band (in that order of interest), or `template`
 * when no slot of the plan trains it.
 */
function headroom(
  muscle: MuscleId,
  work: readonly WorkDay[],
  ledger: SetLedger,
): { readonly fix: PlanFix | null; readonly cause: IssueCause } {
  const order: readonly SetBlocker[] = ['timeBudget', 'sessionCap', 'slotLimit', 'band'];
  let worst: SetBlocker | null = null;
  for (const [dayIndex, day] of work.entries()) {
    for (const slot of day.slots) {
      if (creditFor(slot.exercise, muscle) <= 0 || slot.plan.goal !== 'hypertrophy') continue;
      const blocker = ledger.blocker(dayIndex, slot);
      if (blocker === null) {
        return {
          fix: { kind: 'addSets', dayKey: day.key, slotKey: slot.plan.key, sets: 1 },
          cause: 'template',
        };
      }
      if (worst === null || order.indexOf(blocker) < order.indexOf(worst)) worst = blocker;
    }
  }
  const cause: IssueCause = worst === null ? 'template' : worst === 'band' ? 'sessionCap' : worst;
  return { fix: null, cause };
}

/** PLN-04: ≥ 2 sessions per target muscle (hypertrophy) and 2–3 per lift (strength), days ≥ 3. */
function checkFrequency(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  analysis: ValidationReport['analysis'],
  rules: PlanningRules,
  add: Add,
) {
  if (days.length < 3) return;
  const perMuscle = rules['volume.frequency.hypertrophyPerMuscle'];
  const maintenance = rules['volume.maintenance'];
  for (const target of ctx.targets) {
    const sessions =
      analysis.muscles.find((muscle) => muscle.muscle === target.muscle)?.sessions ?? 0;
    // A maintained (de-prioritized) muscle needs one session a week (EB §Volume › Maintenance).
    const param = target.source === 'maintenance' ? maintenance : perMuscle;
    const required =
      target.source === 'maintenance' ? maintenance.value.minSessionsPerWeek : perMuscle.value;
    if (sessions < required) {
      add(
        'frequency',
        'violation',
        { kind: 'muscle', muscle: target.muscle },
        'validate.frequency.muscle',
        {
          key: String(sessions),
          args: { muscle: target.muscle, sessions, required },
          params: [param],
          cause: 'template',
        },
      );
    }
  }
  if (ctx.style === 'bodybuilding') return;
  const perLift = rules['volume.frequency.strengthPerLift'];
  for (const lift of ['squat', 'bench', 'deadlift'] as const) {
    const sessions = analysis.lifts.find((week) => week.lift === lift)?.sessions ?? 0;
    const subject: IssueSubject = { kind: 'lift', lift };
    if (sessions === 0) {
      add('frequency', 'violation', subject, 'validate.lift.missing', {
        key: lift,
        args: { lift },
        params: [perLift],
      });
    } else if (sessions < perLift.value.min) {
      add('frequency', 'violation', subject, 'validate.frequency.lift', {
        key: String(sessions),
        args: { lift, sessions, min: perLift.value.min, max: perLift.value.max },
        params: [perLift],
        cause: 'template',
      });
    } else if (sessions > perLift.value.max) {
      add('frequency', 'warning', subject, 'validate.frequency.lift', {
        key: String(sessions),
        args: { lift, sessions, min: perLift.value.min, max: perLift.value.max },
        params: [perLift],
      });
    }
  }
}

/** PLN-04 soft caps: ~11 fractional / ~8 direct sets per muscle, 2–3 heavy sets per lift. */
function checkSessionCaps(analysis: ValidationReport['analysis'], rules: PlanningRules, add: Add) {
  const capParam = rules['volume.hypertrophy.perSessionSoftCap'];
  const cap = capParam.value;
  const heavyParam = rules['volume.strength.perSessionHeavySets'];
  for (const day of analysis.days) {
    for (const muscle of day.muscles) {
      if (muscle.fractional > cap.fractionalSets + 1e-9 || muscle.direct > cap.directSets) {
        add(
          'sessionCap',
          'warning',
          { kind: 'day', dayKey: day.dayKey },
          'validate.sessionCap.muscle',
          {
            key: `${muscle.muscle}:${round1(muscle.fractional)}`,
            args: {
              muscle: muscle.muscle,
              fractional: round1(muscle.fractional),
              direct: muscle.direct,
            },
            params: [capParam],
          },
        );
      }
    }
    for (const lift of day.heavySets) {
      if (lift.sets > heavyParam.value.max) {
        add(
          'sessionCap',
          'warning',
          { kind: 'day', dayKey: day.dayKey },
          'validate.sessionCap.lift',
          {
            key: `${lift.lift}:${lift.sets}`,
            args: { lift: lift.lift, sets: lift.sets, max: heavyParam.value.max },
            params: [heavyParam],
          },
        );
      }
    }
  }
}

/** PLN-03 strength: weekly direct heavy sets per lift in 4–10, never below the 3–6 minimum dose. */
function checkStrengthDose(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  analysis: ValidationReport['analysis'],
  rules: PlanningRules,
  add: Add,
) {
  if (ctx.style === 'bodybuilding') return;
  const band = rules['volume.strength.weeklyHeavySetsPerLift'];
  const minimum = rules['volume.strength.minimumDosePerLift'];
  const cap = rules['volume.strength.perSessionHeavySets'];
  for (const lift of analysis.lifts) {
    const subject: IssueSubject = { kind: 'lift', lift: lift.lift };
    const args = {
      lift: lift.lift,
      heavySets: lift.heavySets,
      min: band.value.min,
      max: band.value.max,
    };
    if (lift.heavySets < minimum.value.min) {
      const fixes = heavyFixes(days, ctx, lift.lift, analysis, rules);
      const atCap = analysis.days.every((day) =>
        day.heavySets.every((entry) => entry.lift !== lift.lift || entry.sets >= cap.value.max),
      );
      add('volume', 'violation', subject, 'validate.strength.belowMinimum', {
        key: String(lift.heavySets),
        args,
        params: [minimum, band, cap, rules['planning.sessionBudget.tolerancePct']],
        cause: fixes.length > 0 ? null : atCap ? 'sessionCap' : 'timeBudget',
        fixes,
      });
    } else if (lift.heavySets < band.value.min) {
      add('volume', 'warning', subject, 'validate.strength.weeklyLow', {
        key: String(lift.heavySets),
        args,
        params: [band, minimum],
      });
    } else if (lift.heavySets > band.value.max) {
      add('volume', 'warning', subject, 'validate.strength.weeklyHigh', {
        key: String(lift.heavySets),
        args,
        params: [band],
      });
    }
  }
}

/**
 * A heavy exposure of the lift that can take another set within the per-session cap and the
 * time budget plus tolerance (the generator cuts heavy sets only to fit the budget, PLN-14).
 */
function heavyFixes(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  lift: CompetitionLift,
  analysis: ValidationReport['analysis'],
  rules: PlanningRules,
): PlanFix[] {
  const max = rules['volume.strength.perSessionHeavySets'].value.max;
  const limit =
    ctx.sessionMinutes === null
      ? Infinity
      : ctx.sessionMinutes * (1 + rules['planning.sessionBudget.tolerancePct'].value / 100);
  for (const [index, day] of days.entries()) {
    for (const slot of day.slots) {
      const exercise = ctx.exercise(slot.exerciseId);
      if (!exercise || liftOf(exercise, ctx.exercise) !== lift || slot.intensity === 'light')
        continue;
      const sets = setsOf(slot.prescription);
      const perSet =
        (meanReps(slot.prescription) * rules['session.duration.repSeconds'].value +
          slot.restSeconds) /
        60;
      if (sets < max && (analysis.days[index]?.minutes ?? 0) + perSet <= limit + 1e-9) {
        return [{ kind: 'addSets', dayKey: day.key, slotKey: slot.key, sets: 1 }];
      }
    }
  }
  return [];
}

/** PLN-14: each day within the budget + 10%; otherwise concrete fixes (WKT-17 order). */
function checkTime(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  analysis: ValidationReport['analysis'],
  rules: PlanningRules,
  add: Add,
) {
  if (ctx.sessionMinutes === null) return;
  const tolerance = rules['planning.sessionBudget.tolerancePct'];
  const limit = ctx.sessionMinutes * (1 + tolerance.value / 100);
  const minSets = rules['planning.slot.sets'].value.min;
  for (const [index, day] of days.entries()) {
    const minutes = analysis.days[index]?.minutes ?? dayMinutes(day, ctx.exercise, rules).value;
    if (minutes <= limit + 1e-9) continue;
    const fixes = timeFixes(day, ctx, minutes - ctx.sessionMinutes, rules);
    const reducible = day.slots.some(
      (slot) =>
        slot.priority !== 'primary' ||
        (slot.goal === 'hypertrophy' && setsOf(slot.prescription) > minSets),
    );
    add('time', 'violation', { kind: 'day', dayKey: day.key }, 'validate.time.overBudget', {
      key: String(Math.round(minutes)),
      args: { minutes: Math.round(minutes), budget: ctx.sessionMinutes, limit: Math.round(limit) },
      params: [
        tolerance,
        rules['session.duration.repSeconds'],
        rules['session.duration.transitionSeconds'],
      ],
      cause: reducible ? null : 'timeBudget',
      fixes,
    });
  }
}

/** Fewer sets on the lowest-priority slots, then a superset, then a technique set, then short rests. */
function timeFixes(
  day: PlanDay,
  ctx: ValidationContext,
  overMinutes: number,
  rules: PlanningRules,
): PlanFix[] {
  const fixes: PlanFix[] = [];
  const minSets = rules['planning.slot.sets'].value.min;
  const rank = { optional: 0, secondary: 1, primary: 2 } as const;
  let saved = 0;
  const bySlack = day.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.lift === undefined)
    .toSorted((a, b) => rank[a.slot.priority] - rank[b.slot.priority] || b.index - a.index);
  for (const { slot } of bySlack) {
    if (saved >= overMinutes) break;
    const sets = setsOf(slot.prescription);
    const perSet =
      (meanReps(slot.prescription) * rules['session.duration.repSeconds'].value +
        slot.restSeconds) /
      60;
    const removable = slot.priority === 'primary' ? Math.max(0, sets - minSets) : sets;
    if (removable <= 0) continue;
    const needed = Math.min(removable, Math.ceil((overMinutes - saved) / perSet));
    fixes.push(
      needed >= sets
        ? { kind: 'removeSlot', dayKey: day.key, slotKey: slot.key }
        : { kind: 'removeSets', dayKey: day.key, slotKey: slot.key, sets: needed },
    );
    saved += needed * perSet;
  }
  const accessories = day.slots.filter(
    (slot) => slot.lift === undefined && slot.goal === 'hypertrophy',
  );
  const pair = pairForSuperset(accessories, ctx);
  if (pair) fixes.push({ kind: 'superset', dayKey: day.key, slotKeys: pair });
  const isolation = accessories.findLast(
    (slot) => ctx.exercise(slot.exerciseId)?.mechanics === 'isolation',
  );
  if (isolation) fixes.push({ kind: 'techniqueSet', dayKey: day.key, slotKey: isolation.key });
  if (accessories.length > 0) fixes.push({ kind: 'timeSaverRest', dayKey: day.key });
  return fixes;
}

/** Two non-competing hypertrophy slots (no shared muscle credited 1.0): a superset candidate. */
function pairForSuperset(
  slots: readonly PlanSlot[],
  ctx: ValidationContext,
): readonly [string, string] | null {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = ctx.exercise(slots[i]!.exerciseId);
      const b = ctx.exercise(slots[j]!.exerciseId);
      if (!a || !b) continue;
      const shared = [...groupCredits(a)].some(
        ([muscle, credit]) => credit === 1 && (groupCredits(b).get(muscle) ?? 0) > 0,
      );
      if (!shared) return [slots[i]!.key, slots[j]!.key];
    }
  }
  return null;
}

/** PLN-04 spacing between hard sessions for the same muscle or lift (soft). */
function checkSpacing(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  rules: PlanningRules,
  add: Add,
) {
  if (days.length < 2) return;
  const weekStart = days[0]!.weekday;
  const offsets = days.map((day) => weekOffset(day.weekday, weekStart));
  const conflicts = spacingConflicts(days, offsets, ctx.exercise, rules, true);
  if (conflicts.length === 0) return;
  const best = bestArrangement(days, offsets, ctx.exercise, rules);
  const unavoidable = best.conflicts >= conflicts.length;
  for (const conflict of conflicts) {
    add('spacing', 'warning', { kind: 'day', dayKey: conflict.toDay }, 'validate.spacing', {
      key: `${conflict.subject}:${conflict.fromDay}`,
      args: { ...conflict },
      params: [rules['monitoring.spacing']],
      cause: unavoidable ? 'days' : null,
    });
  }
}

interface CoverageRule {
  readonly muscle: MuscleId;
  readonly rule: string;
  readonly needs: readonly ((exercise: ExerciseDef) => boolean)[];
}

const credits = (muscle: string, min: number) => (exercise: ExerciseDef) =>
  creditFor(exercise, muscle as MuscleId) >= min;
const pattern =
  (...patterns: MovementPattern[]) =>
  (exercise: ExerciseDef) =>
    patterns.includes(exercise.pattern);
const both =
  (...tests: ((exercise: ExerciseDef) => boolean)[]) =>
  (exercise: ExerciseDef) =>
    tests.every((test) => test(exercise));
const either =
  (...tests: ((exercise: ExerciseDef) => boolean)[]) =>
  (exercise: ExerciseDef) =>
    tests.some((test) => test(exercise));

/**
 * PLN-05 coverage pairings (EB §Session › Exercise selection, [INF]): quadriceps a squat or
 * press plus a knee extension; hamstrings a hinge plus a knee-flexion curl; triceps an overhead
 * (long-head, stretched) extension plus a pressdown or a press; elbow flexors at least one curl;
 * glutes a deep squat or a hip thrust. Applied where the equipment allows.
 */
const COVERAGE: readonly CoverageRule[] = [
  {
    muscle: 'mu.quads' as MuscleId,
    rule: 'squatPlusExtension',
    needs: [both(pattern('squat', 'lunge'), credits('mu.quads', 1)), pattern('kneeExtension')],
  },
  {
    muscle: 'mu.hamstrings' as MuscleId,
    rule: 'hingePlusCurl',
    needs: [pattern('hinge'), pattern('kneeFlexion')],
  },
  {
    muscle: 'mu.triceps' as MuscleId,
    rule: 'overheadPlusPressdown',
    needs: [
      both(
        pattern('elbowExtension'),
        credits('mu.triceps.long-head', 1),
        (exercise) => exercise.defaults.stretchEmphasis,
      ),
      either(
        pattern('elbowExtension'),
        both(pattern('horizontalPush', 'verticalPush'), credits('mu.triceps', 0.5)),
      ),
    ],
  },
  { muscle: 'mu.elbow-flexors' as MuscleId, rule: 'curl', needs: [pattern('elbowFlexion')] },
  {
    muscle: 'mu.glutes' as MuscleId,
    rule: 'deepSquatOrHipThrust',
    needs: [
      either(
        both(pattern('squat'), (exercise) => exercise.defaults.stretchEmphasis),
        pattern('hipExtension'),
      ),
    ],
  },
];

/** PLN-05 coverage and PLN-06 order (strength lifts before other work for their muscles). */
function checkCoverage(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  rules: PlanningRules,
  add: Add,
) {
  const planned = days.flatMap((day) =>
    day.slots.flatMap((slot) => ctx.exercise(slot.exerciseId) ?? []),
  );
  const targets = new Set(ctx.targets.map((target) => target.muscle));
  for (const rule of COVERAGE) {
    if (!targets.has(rule.muscle)) continue;
    rule.needs.forEach((need, index) => {
      if (planned.some(need)) return;
      const possible = ctx.exercises.some(
        (exercise) => need(exercise) && isEligible(exercise, ctx.equipment, ctx.avoid),
      );
      add('coverage', 'warning', { kind: 'muscle', muscle: rule.muscle }, 'validate.coverage', {
        key: `${rule.rule}:${index}`,
        args: { muscle: rule.muscle, rule: rule.rule, part: index },
        cause: possible ? null : 'equipment',
      });
    });
  }
  const limit = rules['planning.novice.maxWorkingExercises'];
  for (const day of days) {
    if (ctx.level === 'novice' && day.slots.length > limit.value) {
      add('coverage', 'warning', { kind: 'day', dayKey: day.key }, 'validate.novice.exercises', {
        key: String(day.slots.length),
        args: { exercises: day.slots.length, max: limit.value },
        params: [limit],
      });
    }
    day.slots.forEach((slot, index) => {
      if (slot.goal !== 'strength' || slot.lift === undefined || slot.intensity === 'light') return;
      const lift = ctx.exercise(slot.exerciseId);
      if (!lift) return;
      const primary = [...groupCredits(lift)]
        .filter(([, credit]) => credit === 1)
        .map(([muscle]) => muscle);
      const before = day.slots.slice(0, index).find((other) => {
        const exercise = ctx.exercise(other.exerciseId);
        return (
          exercise !== undefined && primary.some((muscle) => creditFor(exercise, muscle) >= 0.5)
        );
      });
      if (before) {
        add(
          'coverage',
          'warning',
          { kind: 'slot', dayKey: day.key, slotKey: slot.key },
          'validate.order.lift',
          {
            key: before.key,
            args: { lift: slot.lift, before: before.exerciseId },
          },
        );
      }
    });
  }
}

/** PLN-07 bands: hypertrophy 5–30 reps at RIR ≤ 4 (0 only on isolation); no failure on lifts. */
function checkPrescriptions(
  days: readonly PlanDay[],
  ctx: ValidationContext,
  rules: PlanningRules,
  add: Add,
) {
  const hyp = rules['volume.repRange.hypertrophy'];
  const strength = rules['volume.repRange.strength'];
  const maxRir = rules['volume.hardSet.maxRir'];
  const rpe = rules['volume.effort.strengthRpe'];
  for (const day of days) {
    for (const slot of day.slots) {
      const exercise = ctx.exercise(slot.exerciseId);
      const subject: IssueSubject = { kind: 'slot', dayKey: day.key, slotKey: slot.key };
      const reps = repRangesOf(slot.prescription);
      const rirs = rirRangesOf(slot.prescription);
      const allowed = hyp.value.allowed;
      const strengthMax =
        slot.lift !== undefined ? strength.value.main.max : strength.value.accessory.max;
      const repsOut = reps.some((range) =>
        slot.goal === 'hypertrophy'
          ? range[0] < allowed.min || range[1] > allowed.max
          : range[1] > strengthMax,
      );
      if (repsOut) {
        add('prescription', 'warning', subject, 'validate.prescription.reps', {
          key: reps.map((range) => range.join('-')).join('/'),
          args: { exercise: slot.exerciseId, goal: slot.goal },
          params: [slot.goal === 'hypertrophy' ? hyp : strength],
        });
      }
      const tooEasy = slot.goal === 'hypertrophy' && rirs.some((range) => range[1] > maxRir.value);
      const failureOnCompound =
        slot.goal === 'hypertrophy' &&
        exercise?.mechanics === 'compound' &&
        rirs.some((range) => range[0] === 0);
      const liftFailure =
        slot.lift !== undefined && rirs.some((range) => range[0] < 10 - rpe.value.heavySingle.max);
      if (tooEasy || failureOnCompound || liftFailure) {
        add('prescription', 'warning', subject, 'validate.prescription.effort', {
          key: rirs.map((range) => range.join('-')).join('/'),
          args: { exercise: slot.exerciseId, tooEasy, failureOnCompound, liftFailure },
          params: [
            slot.goal === 'hypertrophy' ? rules['volume.effort.hypertrophyRir'] : rpe,
            maxRir,
          ],
        });
      }
    }
  }
}

/** PLN-08: N accumulation weeks (3–8) and a deload week. */
function checkMesocycle(ctx: ValidationContext, rules: PlanningRules, add: Add) {
  const weeks = rules['planning.mesocycle.accumulationWeeks'];
  if (ctx.deloadWeeks < 1) {
    add('deload', 'violation', { kind: 'plan' }, 'validate.deload.missing', {
      key: 'none',
      params: [rules['deload.planned.everyWeeks'], rules['deload.content']],
    });
  }
  if (ctx.accumulationWeeks < weeks.value.min || ctx.accumulationWeeks > weeks.value.max) {
    add('deload', 'warning', { kind: 'plan' }, 'validate.deload.missing', {
      key: `weeks:${ctx.accumulationWeeks}`,
      args: {
        accumulationWeeks: ctx.accumulationWeeks,
        min: weeks.value.min,
        max: weeks.value.max,
      },
      params: [weeks],
    });
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
