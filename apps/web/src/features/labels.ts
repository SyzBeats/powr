import { useLingui } from '@lingui/react/macro';

import type {
  BodyPhase,
  BreakReason,
  CompetitionLift,
  EquipmentCategory,
  ExerciseId,
  Goal,
  MovementPattern,
  MuscleId,
  PeriodizationModel,
  PlannedSessionStatus,
  RpeFamiliarity,
  Split,
  TargetSource,
  TemplateId,
  TimeOffBand,
  TrainingAgeBand,
  TrainingStyle,
} from '@powr/domain';
import type { ProgressionModel, TraineeLevel } from '@powr/domain/rules';

import { useCatalog } from '../hooks/use-planning';
import { formatWeekday } from '../i18n/format';
import { assertNever } from './exhaustive';

/**
 * Plain-language names for content IDs and engine enums (NFR-USE-03): content names come from
 * the catalog (`LocalizedText`), enum labels are Lingui messages.
 */
export function useLabels() {
  const { t } = useLingui();
  const content = useCatalog();

  const pattern = (value: MovementPattern): string => {
    switch (value) {
      case 'squat':
        return t`squat`;
      case 'hinge':
        return t`hip hinge`;
      case 'horizontalPush':
        return t`horizontal push`;
      case 'verticalPush':
        return t`overhead push`;
      case 'horizontalPull':
        return t`row`;
      case 'verticalPull':
        return t`pull-down or pull-up`;
      case 'lunge':
        return t`lunge`;
      case 'kneeExtension':
        return t`knee extension`;
      case 'kneeFlexion':
        return t`leg curl`;
      case 'elbowFlexion':
        return t`curl`;
      case 'elbowExtension':
        return t`triceps extension`;
      case 'shoulderAbduction':
        return t`lateral raise`;
      case 'hipExtension':
        return t`hip extension`;
      case 'hipAbduction':
        return t`hip abduction`;
      case 'hipAdduction':
        return t`hip adduction`;
      case 'calf':
        return t`calf raise`;
      case 'core':
        return t`core`;
      case 'carry':
        return t`carry`;
      case 'shoulderHorizontalAdduction':
        return t`chest fly`;
      case 'shoulderHorizontalAbduction':
        return t`rear-delt fly`;
      case 'shrug':
        return t`shrug`;
      case 'wristFlexion':
        return t`wrist curl`;
      case 'wristExtension':
        return t`reverse wrist curl`;
      default:
        return assertNever(value);
    }
  };

  const lift = (value: CompetitionLift): string =>
    value === 'squat' ? t`squat` : value === 'bench' ? t`bench press` : t`deadlift`;

  const level = (value: TraineeLevel): string =>
    value === 'novice' ? t`beginner` : value === 'intermediate' ? t`intermediate` : t`advanced`;

  const style = (value: TrainingStyle): string =>
    value === 'bodybuilding'
      ? t`Bodybuilding`
      : value === 'powerlifting'
        ? t`Powerlifting`
        : t`Powerbuilding`;

  const goal = (value: Goal): string => (value === 'hypertrophy' ? t`muscle size` : t`strength`);

  const split = (value: Split): string => {
    switch (value) {
      case 'fullBody':
        return t`Full body`;
      case 'upperLower':
        return t`Upper/lower`;
      case 'upperLowerPpl':
        return t`Upper/lower + push/pull/legs`;
      case 'pushPullLegs':
        return t`Push/pull/legs`;
      case 'sbd':
        return t`Squat, bench, deadlift`;
      default:
        return assertNever(value);
    }
  };

  const periodization = (value: PeriodizationModel): string => {
    switch (value) {
      case 'linear':
        return t`linear`;
      case 'dailyUndulating':
        return t`daily undulating`;
      case 'weeklyUndulating':
        return t`weekly undulating`;
      case 'block':
        return t`block`;
      default:
        return assertNever(value);
    }
  };

  const progression = (value: ProgressionModel): string => {
    switch (value) {
      case 'doubleProgression':
        return t`double progression (more reps, then more weight)`;
      case 'rpe':
        return t`effort-based loading (RPE)`;
      case 'linear':
        return t`linear (a little more weight each workout)`;
      case 'apre':
        return t`APRE`;
      default:
        return assertNever(value);
    }
  };

  const category = (value: EquipmentCategory): string => {
    switch (value) {
      case 'bar':
        return t`Bars`;
      case 'rack':
        return t`Racks`;
      case 'bench':
        return t`Benches`;
      case 'freeWeight':
        return t`Free weights`;
      case 'cable':
        return t`Cables`;
      case 'machine':
        return t`Machines`;
      case 'bodyweight':
        return t`Bodyweight`;
      case 'accessory':
        return t`Accessories`;
      case 'cardio':
        return t`Cardio`;
      default:
        return assertNever(value);
    }
  };

  const breakReason = (value: BreakReason): string => {
    switch (value) {
      case 'vacation':
        return t`Holiday`;
      case 'illness':
        return t`Illness`;
      case 'injury':
        return t`Injury`;
      case 'life':
        return t`Life event`;
      case 'other':
        return t`Other`;
      default:
        return assertNever(value);
    }
  };

  const sessionStatus = (value: PlannedSessionStatus): string => {
    switch (value) {
      case 'planned':
        return t`Planned`;
      case 'done':
        return t`Done`;
      case 'skipped':
        return t`Skipped`;
      case 'merged':
        return t`Merged into another workout`;
      case 'onBreak':
        return t`On break`;
      default:
        return assertNever(value);
    }
  };

  const targetSource = (value: TargetSource): string => {
    switch (value) {
      case 'band':
        return t`evidence band`;
      case 'priority':
        return t`priority muscle`;
      case 'maintenance':
        return t`maintenance`;
      case 'recent':
        return t`your recent volume`;
      case 'logged':
        return t`your logged volume`;
      case 'user':
        return t`your own target`;
      case 'timeBudget':
        return t`time budget`;
      default:
        return assertNever(value);
    }
  };

  const trainingAge = (value: TrainingAgeBand): string => {
    switch (value) {
      case 'under6Months':
        return t`Less than 6 months`;
      case 'months6To24':
        return t`6 months to 2 years`;
      case 'years2To5':
        return t`2 to 5 years`;
      case 'over5Years':
        return t`More than 5 years`;
      default:
        return assertNever(value);
    }
  };

  const timeOff = (value: TimeOffBand): string => {
    switch (value) {
      case 'upTo1Week':
        return t`I trained in the last week`;
      case 'weeks1To2':
        return t`1–2 weeks ago`;
      case 'weeks2To4':
        return t`2–4 weeks ago`;
      case 'months1To2':
        return t`1–2 months ago`;
      case 'over2Months':
        return t`More than 2 months ago`;
      default:
        return assertNever(value);
    }
  };

  const rpeFamiliarity = (value: RpeFamiliarity): string =>
    value === 'none' ? t`New to me` : value === 'some' ? t`I know a bit` : t`I use it regularly`;

  const phase = (value: BodyPhase): string => {
    switch (value) {
      case 'bulk':
        return t`Gaining (bulk)`;
      case 'cut':
        return t`Losing fat (cut)`;
      case 'maintain':
        return t`Maintaining`;
      case 'notTracking':
        return t`Not tracking`;
      default:
        return assertNever(value);
    }
  };

  return {
    exercise: (id: ExerciseId | string): string =>
      content.exercise(id as ExerciseId)?.name.en ?? id,
    muscle: (id: MuscleId | string): string =>
      content.muscles().muscle(id as MuscleId)?.name.en ?? id,
    template: (id: TemplateId | string): string =>
      content.template(id as TemplateId)?.name.en ?? id,
    equipment: (id: string): string => content.equipment().item(id as never)?.name.en ?? id,
    weekday: (day: number, short = false): string => formatWeekday(day, short ? 'short' : 'long'),
    pattern,
    lift,
    level,
    style,
    goal,
    split,
    periodization,
    progression,
    category,
    breakReason,
    sessionStatus,
    targetSource,
    trainingAge,
    timeOff,
    rpeFamiliarity,
    phase,
  };
}

export type Labels = ReturnType<typeof useLabels>;
