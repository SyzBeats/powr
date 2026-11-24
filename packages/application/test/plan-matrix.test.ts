import { describe, expect, it } from 'vitest';

import { builtInContent } from '@powr/content/built-in';
import type { ExerciseDef, IsoWeekday, TemplateDef, TrainingStyle } from '@powr/domain';
import { isAvailable, itemsOf, profileFromPreset } from '@powr/domain/equipment';
import { generatePlan, setsOf, type PlanProposal, type RestRules } from '@powr/domain/planning';
import { TRAINEE_LEVELS, type RuleSet, type TraineeLevel } from '@powr/domain/rules';
import { BUILT_IN_RULES } from '@powr/rules/built-in';
import { resolveRules } from '@powr/rules/resolve';

/**
 * The PLN-01 template matrix (§8.7.6, EQP-04): every MVP template × every equipment preset ×
 * every trainee level × six time budgets. Each combination either generates a plan whose PLN-01
 * report has no avoidable violation and only available exercises, or fails with the expected
 * explanation. Goals: each template carries its style's goals (bodybuilding hypertrophy,
 * powerlifting strength, powerbuilding both), and the validator applies the hypertrophy rules to
 * hypertrophy slots and the strength rules to strength slots, so both goals are covered.
 */

const content = builtInContent();
const templates = content.templates();
const presets = content.equipment().presets;
const BUDGETS = [30, 45, 60, 75, 90, null] as const;
const WEEKDAYS: Readonly<Record<number, readonly IsoWeekday[]>> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};
/** Presets with a barbell, plates and a rack: the only ones that allow the competition lifts. */
const BARBELL_PRESETS = new Set(['preset.commercial-gym', 'preset.home-barbell-gym']);

const ruleCache = new Map<string, RuleSet>();
function rulesFor(level: TraineeLevel, style: TrainingStyle, exercise?: ExerciseDef): RuleSet {
  const context = exercise
    ? {
        ...(exercise.competitionLift ? { competitionLift: exercise.competitionLift } : {}),
        restClass: exercise.defaults.restClass,
        pattern: exercise.pattern,
        mechanics: exercise.mechanics,
        curveClass: exercise.load.curveClass,
      }
    : undefined;
  const key = `${level}/${style}/${JSON.stringify(context ?? null)}`;
  let rules = ruleCache.get(key);
  if (!rules) {
    rules = resolveRules(BUILT_IN_RULES, {
      level,
      style,
      ...(context ? { exercise: context } : {}),
    }).rules;
    ruleCache.set(key, rules);
  }
  return rules;
}

function generate(
  template: TemplateDef,
  presetId: string,
  level: TraineeLevel,
  budget: number | null,
) {
  const preset = presets.find((entry) => entry.id === presetId)!;
  const profile = profileFromPreset(preset, content.equipment().items, {
    id: 'p',
    name: 'Gym',
    unit: 'kg',
  });
  const restRules = (exercise: ExerciseDef): RestRules => rulesFor(level, template.style, exercise);
  return generatePlan(
    {
      style: template.style,
      level,
      weekdays: WEEKDAYS[template.daysPerWeek]!,
      weekStartsOn: 1,
      sessionMinutes: budget,
      equipment: itemsOf(profile),
      priorities: [],
      avoid: { exercises: [], patterns: [] },
      preferred: [],
      recentVolume: [],
      templateId: template.id,
      variety: false,
      seed: 1,
    },
    { exercises: content.exercises(), templates, restRules },
    rulesFor(level, template.style),
  );
}

function expectedFailure(
  template: TemplateDef,
  presetId: string,
  level: TraineeLevel,
): string | null {
  if (!template.levels.includes(level)) return 'plan.template.levelMismatch';
  if (template.style !== 'bodybuilding' && !BARBELL_PRESETS.has(presetId))
    return 'plan.lift.unavailable';
  return null;
}

/** What the matrix asserts about one combination, as one comparable object. */
function check(
  proposal: PlanProposal | null,
  rule: string,
  items: ReadonlySet<string>,
  budget: number | null,
) {
  const slots = proposal?.days.flatMap((day) => day.slots) ?? [];
  const limit = budget === null ? Infinity : budget * 1.1 + 1e-6;
  return {
    rule,
    generated: proposal !== null,
    avoidable: (proposal?.report.issues ?? [])
      .filter((issue) => issue.severity === 'violation' && issue.cause === null)
      .map((issue) => issue.key),
    unavailable: slots
      .filter((slot) => !isAvailable(content.exercise(slot.exerciseId)!, items))
      .map((slot) => slot.exerciseId),
    unflaggedOverBudget: (proposal?.report.analysis.days ?? [])
      .filter(
        (day) =>
          day.minutes > limit &&
          !proposal!.report.issues.some((issue) =>
            issue.key.startsWith(`time.overBudget:${day.dayKey}`),
          ),
      )
      .map((day) => day.dayKey),
  };
}

function summary(proposal: PlanProposal): string {
  const violations = proposal.report.issues
    .filter((issue) => issue.severity === 'violation')
    .map((issue) => `${issue.key.split(':').slice(0, 2).join(':')}[${issue.cause}]`);
  const sets = proposal.days.reduce(
    (sum, day) => sum + day.slots.reduce((daySum, slot) => daySum + setsOf(slot.prescription), 0),
    0,
  );
  const exercises = proposal.days.reduce((sum, day) => sum + day.slots.length, 0);
  return `${exercises} ex, ${sets} sets${violations.length > 0 ? `; ${violations.join(' ')}` : ''}`;
}

describe('template matrix (PLN-01, EQP-04)', () => {
  it('ships the PLN-02 minimum set: one default template per style × days cell', () => {
    const cells = templates
      .filter((template) => template.default)
      .map((template) => `${template.style}×${template.daysPerWeek}`);
    expect(cells.toSorted()).toEqual(
      ['bodybuilding', 'powerbuilding', 'powerlifting']
        .flatMap((style) => [2, 3, 4, 5, 6].map((days) => `${style}×${days}`))
        .toSorted(),
    );
  });

  const lines: string[] = [];
  let slowest = 0;

  describe.each(templates.map((template) => [template.id, template] as const))(
    '%s',
    (_id, template) => {
      it.each(presets.map((preset) => preset.id))('with %s', (presetId) => {
        const items = itemsOf(
          profileFromPreset(
            presets.find((p) => p.id === presetId)!,
            content.equipment().items,
            { id: 'p', name: 'Gym', unit: 'kg' },
          ),
        );
        for (const level of TRAINEE_LEVELS) {
          for (const budget of BUDGETS) {
            const started = performance.now();
            const result = generate(template, presetId, level, budget);
            slowest = Math.max(slowest, performance.now() - started);
            const failure = expectedFailure(template, presetId, level);
            const label = `${template.id} ${presetId} ${level} ${budget ?? '90+'}`;
            expect({ label, ...check(result.value, result.why.rule, items, budget) }).toEqual({
              label,
              rule: failure ?? 'plan.template.chosen',
              generated: failure === null,
              avoidable: [],
              unavailable: [],
              unflaggedOverBudget: [],
            });
            if (budget !== 60) continue;
            lines.push(
              `${template.id} | ${presetId} | ${level}: ${result.value ? summary(result.value) : `✗ ${result.why.rule}`}`,
            );
            // Determinism (PLN-01): the same request gives the same plan.
            expect(generate(template, presetId, level, budget)).toEqual(result);
          }
        }
      });
    },
  );

  it('matches the reviewed summary (§8.6.5 check 5: a changed default that changes plans shows here)', () => {
    expect(lines.toSorted().join('\n')).toMatchSnapshot();
  });

  it('generates any plan of the matrix within 1 s (NFR-PERF-09)', () => {
    expect(slowest).toBeLessThan(1000);
  });
});
