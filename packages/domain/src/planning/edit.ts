import type { ExerciseId, MuscleId } from '../ids';
import type {
  ExerciseDef,
  Goal,
  LocalizedText,
  MuscleTarget,
  PlanDay,
  PlanSlot,
  Prescription,
} from '../model';
import { restSeconds, type RestRules } from '../rest';
import type { IsoWeekday } from '../time';
import { setsOf, withSets } from './analysis';
import type { PlanFix } from './types';

/**
 * One change in the plan editor (PLN-09). The editor keeps a draft week and sends edits; the
 * application applies them with `applyPlanEdits` and validates the result live.
 */
export type PlanEdit =
  | {
      readonly kind: 'setSets';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly sets: number;
    }
  | {
      readonly kind: 'setPrescription';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly prescription: Prescription;
    }
  | {
      readonly kind: 'setRest';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly seconds: number;
    }
  | {
      readonly kind: 'swapExercise';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly exerciseId: ExerciseId;
    }
  | {
      readonly kind: 'lockSlot';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly locked: boolean;
    }
  | {
      readonly kind: 'moveSlot';
      readonly dayKey: string;
      readonly slotKey: string;
      readonly toIndex: number;
    }
  | { readonly kind: 'removeSlot'; readonly dayKey: string; readonly slotKey: string }
  | { readonly kind: 'addSlot'; readonly dayKey: string; readonly slot: PlanSlot }
  | {
      readonly kind: 'addDay';
      readonly dayKey: string;
      readonly name: LocalizedText;
      readonly weekday: IsoWeekday;
    }
  | { readonly kind: 'removeDay'; readonly dayKey: string }
  | { readonly kind: 'renameDay'; readonly dayKey: string; readonly name: LocalizedText }
  | { readonly kind: 'setWeekday'; readonly dayKey: string; readonly weekday: IsoWeekday }
  | { readonly kind: 'setTarget'; readonly muscle: MuscleId; readonly sets: number };

export interface EditableWeek {
  readonly days: readonly PlanDay[];
  readonly targets: readonly MuscleTarget[];
}

/**
 * Applies editor changes to a week (pure). Edits that name a missing day or slot are ignored,
 * so a stale edit cannot corrupt the plan; swapping keeps the slot's sets, reps and effort and
 * takes the new exercise's rest class (TMR-02). Validation is the caller's next step.
 */
export function applyPlanEdits(
  week: EditableWeek,
  edits: readonly PlanEdit[],
  lookup: (id: ExerciseId) => ExerciseDef | undefined,
  rules: RestRules,
): EditableWeek {
  let days = [...week.days];
  let targets = [...week.targets];
  const updateDay = (dayKey: string, change: (day: PlanDay) => PlanDay) => {
    days = days.map((day) => (day.key === dayKey ? change(day) : day));
  };
  const updateSlot = (dayKey: string, slotKey: string, change: (slot: PlanSlot) => PlanSlot) =>
    updateDay(dayKey, (day) => ({
      ...day,
      slots: day.slots.map((slot) => (slot.key === slotKey ? change(slot) : slot)),
    }));

  for (const edit of edits) {
    switch (edit.kind) {
      case 'setSets':
        updateSlot(edit.dayKey, edit.slotKey, (slot) => ({
          ...slot,
          prescription: withSets(slot.prescription, edit.sets),
        }));
        break;
      case 'setPrescription':
        updateSlot(edit.dayKey, edit.slotKey, (slot) => ({
          ...slot,
          prescription: edit.prescription,
        }));
        break;
      case 'setRest':
        updateSlot(edit.dayKey, edit.slotKey, (slot) => ({
          ...slot,
          restSeconds: Math.max(0, Math.round(edit.seconds)),
        }));
        break;
      case 'swapExercise': {
        const exercise = lookup(edit.exerciseId);
        if (!exercise) break;
        updateSlot(edit.dayKey, edit.slotKey, (slot) => ({
          ...slot,
          exerciseId: exercise.id,
          restSeconds: restSeconds({ restClass: exercise.defaults.restClass }, rules).value,
        }));
        break;
      }
      case 'lockSlot':
        updateSlot(edit.dayKey, edit.slotKey, (slot) => ({ ...slot, locked: edit.locked }));
        break;
      case 'moveSlot':
        updateDay(edit.dayKey, (day) => {
          const from = day.slots.findIndex((slot) => slot.key === edit.slotKey);
          if (from < 0) return day;
          const slots = day.slots.filter((_, index) => index !== from);
          slots.splice(Math.max(0, Math.min(slots.length, edit.toIndex)), 0, day.slots[from]!);
          return { ...day, slots };
        });
        break;
      case 'removeSlot':
        updateDay(edit.dayKey, (day) => ({
          ...day,
          slots: day.slots.filter((slot) => slot.key !== edit.slotKey),
        }));
        break;
      case 'addSlot':
        updateDay(edit.dayKey, (day) =>
          day.slots.some((slot) => slot.key === edit.slot.key)
            ? day
            : { ...day, slots: [...day.slots, edit.slot] },
        );
        break;
      case 'addDay':
        if (!days.some((day) => day.key === edit.dayKey)) {
          days = [...days, { key: edit.dayKey, name: edit.name, weekday: edit.weekday, slots: [] }];
        }
        break;
      case 'removeDay':
        days = days.filter((day) => day.key !== edit.dayKey);
        break;
      case 'renameDay':
        updateDay(edit.dayKey, (day) => ({ ...day, name: edit.name }));
        break;
      case 'setWeekday':
        updateDay(edit.dayKey, (day) => ({ ...day, weekday: edit.weekday }));
        break;
      case 'setTarget':
        targets = targets.some((target) => target.muscle === edit.muscle)
          ? targets.map((target) =>
              target.muscle === edit.muscle
                ? { muscle: edit.muscle, sets: edit.sets, source: 'user' }
                : target,
            )
          : [...targets, { muscle: edit.muscle, sets: edit.sets, source: 'user' }];
        break;
    }
  }
  return { days, targets };
}

/**
 * A new slot for an exercise the user adds (PLN-09): its default rep range for the goal, the
 * given effort, its rest class, double progression. Keys `custom.<n>` stay unique in the week.
 */
export function slotForExercise(
  exercise: ExerciseDef,
  input: {
    readonly goal: Goal;
    readonly sets: number;
    readonly rir: readonly [number, number];
    readonly existingKeys: readonly string[];
  },
  rules: RestRules,
): PlanSlot {
  let n = 1;
  while (input.existingKeys.includes(`custom.${n}`)) n++;
  return {
    key: `custom.${n}`,
    exerciseId: exercise.id,
    pattern: exercise.pattern,
    targets: exercise.muscles
      .filter((credit) => credit.credit === 1)
      .map((credit) => credit.muscle),
    priority: 'secondary',
    goal: input.goal,
    prescription: {
      mode: 'doubleProgression',
      sets: input.sets,
      repRange: exercise.defaults.repRange[input.goal],
      rir: input.rir,
    },
    progression: 'doubleProgression',
    restSeconds: restSeconds({ restClass: exercise.defaults.restClass }, rules).value,
  };
}

/** The editor changes behind a validation fix, where the fix is a plan change (WKT-17 ones are not). */
export function editsForFix(fix: PlanFix, days: readonly PlanDay[]): readonly PlanEdit[] {
  const slot = (dayKey: string, slotKey: string) =>
    days.find((day) => day.key === dayKey)?.slots.find((candidate) => candidate.key === slotKey);
  switch (fix.kind) {
    case 'removeSets':
    case 'addSets': {
      const current = slot(fix.dayKey, fix.slotKey);
      if (!current) return [];
      const sets = setsOf(current.prescription);
      return [
        {
          kind: 'setSets',
          dayKey: fix.dayKey,
          slotKey: fix.slotKey,
          sets: fix.kind === 'addSets' ? sets + fix.sets : Math.max(1, sets - fix.sets),
        },
      ];
    }
    case 'removeSlot':
      return [{ kind: 'removeSlot', dayKey: fix.dayKey, slotKey: fix.slotKey }];
    case 'swapExercise':
      return [
        {
          kind: 'swapExercise',
          dayKey: fix.dayKey,
          slotKey: fix.slotKey,
          exerciseId: fix.exerciseId,
        },
      ];
    case 'sessionMinutes':
    case 'addDay':
      // Input fixes: the caller regenerates the plan with the changed answers (PLN-14).
      return [];
    default:
      // Supersets, technique sets and time-saver rests are session features (WKT-17, M3).
      return [];
  }
}
