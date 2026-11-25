import { useLingui } from '@lingui/react/macro';

import type {
  CreditValue,
  CurveClass,
  EquipmentRequirement,
  LoadType,
  Mechanics,
  MuscleCredit,
  RestClass,
  SetupField,
} from '@powr/domain';
import type { CustomExerciseIssue, DetailMuscle } from '@powr/domain/library';

import { formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';

/*
 * Words of the exercise library (EXL-02…05, EXL-07…09): enum labels, the evidence tags of a
 * muscle credit explained in plain language (EXL-03 "explained on tap"), setup-memory fields and
 * the custom-exercise form's errors, each saying how to fix it.
 */

export function useLibraryWords() {
  const { t } = useLingui();
  const labels = useLabels();

  const mechanics = (value: Mechanics): string =>
    value === 'compound' ? t`Compound (several joints)` : t`Isolation (one joint)`;

  const loadType = (value: LoadType): string => {
    switch (value) {
      case 'barbell':
        return t`Barbell (bar plus plates)`;
      case 'dumbbell':
        return t`Dumbbells (weight per hand)`;
      case 'machine':
        return t`Machine or cable`;
      case 'bodyweightAdded':
        return t`Bodyweight plus added weight`;
      case 'bodyweightAssisted':
        return t`Bodyweight with assistance`;
      case 'band':
        return t`Band`;
      case 'timed':
        return t`Timed (seconds instead of weight)`;
      default:
        return assertNever(value);
    }
  };

  const curveClass = (value: CurveClass): string => {
    switch (value) {
      case 'equation':
        return t`Equation (Wathan or the RPE chart)`;
      case 'legPressLike':
        return t`Like a leg press`;
      case 'pooled':
        return t`Pooled (all exercises)`;
      default:
        return assertNever(value);
    }
  };

  const curveHint = (value: CurveClass): string => {
    switch (value) {
      case 'equation':
        return t`For free-weight lifts: squats, presses, rows, deadlifts.`;
      case 'legPressLike':
        return t`For machines where you do many reps at a high share of your max.`;
      case 'pooled':
        return t`When neither fits; an average over many exercises.`;
      default:
        return assertNever(value);
    }
  };

  const restClass = (value: RestClass): string => {
    switch (value) {
      case 'strength':
        return t`Strength (longest rest)`;
      case 'hypertrophyCompound':
        return t`Muscle building, several joints`;
      case 'hypertrophyIsolation':
        return t`Muscle building, one joint (shortest rest)`;
      default:
        return assertNever(value);
    }
  };

  /** EXL-05: the credit of one set for a muscle, in words. */
  const credit = (value: number): string => {
    if (value >= 1) return t`Primary: each set counts as 1 set`;
    if (value >= 0.5) return t`Secondary: each set counts as half a set`;
    if (value > 0) return t`Minor: each set counts as a quarter set`;
    return t`Not counted`;
  };

  const creditOption = (value: CreditValue): string => {
    switch (value) {
      case 1:
        return t`Primary (1 set)`;
      case 0.5:
        return t`Secondary (half a set)`;
      case 0.25:
        return t`Minor (a quarter set, unvalidated convention)`;
      case 0:
        return t`Not counted`;
      default:
        return assertNever(value);
    }
  };

  const role = (value: DetailMuscle['role']): string => {
    switch (value) {
      case 'primary':
        return t`Primary`;
      case 'secondary':
        return t`Secondary`;
      case 'minor':
        return t`Minor`;
      case 'none':
        return t`Not counted`;
      default:
        return assertNever(value);
    }
  };

  /** The evidence tag's short label (EXL-05: H, EMG, C). */
  const evidence = (value: MuscleCredit['evidence']): string => {
    switch (value) {
      case 'H':
        return t`Growth studies`;
      case 'EMG':
        return t`Activity measurements`;
      case 'C':
        return t`Convention`;
      default:
        return assertNever(value);
    }
  };

  /** EXL-03: the evidence tag explained ("explained on tap"). */
  const evidenceText = (muscle: DetailMuscle, exercise: string): string => {
    const name = labels.muscle(muscle.muscle);
    if (muscle.credit === 0) {
      return muscle.evidence === 'H'
        ? t`${exercise} does not count toward ${name}: studies that measured muscle growth found no meaningful growth there.`
        : t`${exercise} does not count toward ${name}.`;
    }
    switch (muscle.evidence) {
      case 'H':
        return t`Studies that measured muscle growth support this credit for ${name}.`;
      case 'EMG':
        return t`Based on muscle activity (EMG) measurements. Activity suggests, but does not prove, growth in ${name}.`;
      case 'C':
        return muscle.credit === 0.25
          ? t`An unvalidated convention: a quarter set for ${name}, not backed by growth or activity data.`
          : t`A coaching convention: no study has measured this credit for ${name} yet.`;
      default:
        return assertNever(muscle.evidence);
    }
  };

  const setupField = (value: SetupField): string => {
    switch (value) {
      case 'seat':
        return t`Seat`;
      case 'backrest':
        return t`Backrest`;
      case 'pin':
        return t`Pin`;
      case 'handle':
        return t`Handle`;
      case 'grip':
        return t`Grip`;
      case 'stance':
        return t`Stance`;
      case 'rack':
        return t`Rack height`;
      case 'safeties':
        return t`Safeties`;
      case 'other':
        return t`Other`;
      default:
        return assertNever(value);
    }
  };

  /** "Barbell and flat bench, and one of: power rack or squat stand". */
  const requirement = (equipment: EquipmentRequirement): string => {
    const list = new Intl.ListFormat(undefined, { type: 'conjunction' });
    const either = new Intl.ListFormat(undefined, { type: 'disjunction' });
    const all = equipment.allOf.map((id) => labels.equipment(id));
    const groups = equipment.anyOf.map((group) =>
      either.format(group.map((id) => labels.equipment(id))),
    );
    if (all.length === 0 && groups.length === 0) return t`No equipment`;
    return list.format([...all, ...groups]);
  };

  /** "6–10 reps". */
  const reps = (range: readonly [number, number]): string => {
    const low = formatNumber(range[0], 0);
    const high = formatNumber(range[1], 0);
    return range[0] === range[1] ? t`${low} reps` : t`${low}–${high} reps`;
  };

  /** EXL-04: what is wrong with a field of the custom-exercise form and how to fix it. */
  const issue = (value: CustomExerciseIssue): string => {
    switch (value.field) {
      case 'name':
        return value.code === 'empty'
          ? t`Enter a name.`
          : value.code === 'tooLong'
            ? t`Use at most 120 characters for the name.`
            : t`An exercise with this name exists. Choose another name.`;
      case 'synonyms':
        return value.code === 'tooMany'
          ? t`Use at most 10 other names.`
          : value.code === 'tooLong'
            ? t`Use at most 120 characters for each other name.`
            : t`One of the other names is already used. Remove or change it.`;
      case 'pattern':
        return t`Choose a movement pattern.`;
      case 'mechanics':
        return t`Choose compound or isolation.`;
      case 'restClass':
        return t`Choose a rest class.`;
      case 'equipment':
        if (value.code === 'unknownItem') {
          const item = value.item;
          return t`The equipment item ${item} is unknown. Remove it.`;
        }
        return value.code === 'tooMany'
          ? t`Choose at most 30 equipment items.`
          : t`Each "one of" group needs at least one item.`;
      case 'muscles':
        switch (value.code) {
          case 'none':
            return t`Add at least one muscle.`;
          case 'noPrimary':
            return t`Give at least one muscle the primary credit (1 set).`;
          case 'tooMany':
            return t`Use at most 20 muscles.`;
          case 'unknownMuscle': {
            const muscle = value.muscle;
            return t`The muscle ${muscle} is unknown. Remove it.`;
          }
          case 'duplicate': {
            const muscle = labels.muscle(value.muscle);
            return t`${muscle} is listed twice. Remove one.`;
          }
          case 'groupAndSubRegion': {
            const muscle = labels.muscle(value.muscle);
            return t`${muscle} is part of a muscle group that is also listed. Keep either the group or its part.`;
          }
          case 'invalidCredit': {
            const muscle = labels.muscle(value.muscle);
            return t`Choose a credit of 1, 0.5, 0.25 or 0 for ${muscle}.`;
          }
          default:
            return assertNever(value);
        }
      case 'load':
        switch (value.code) {
          case 'unknownType':
            return t`Choose how the weight is loaded.`;
          case 'unknownCurve':
            return t`Choose a load curve.`;
          case 'bodyweightFlag':
            return t`Bodyweight can count toward the load only for bodyweight exercises.`;
          case 'increment':
            return t`Enter a weight step above 0 and at most 50 kg (110 lb).`;
          default:
            return assertNever(value);
        }
      case 'repRange':
        return t`Enter rep ranges from 1 to 100 with the lower number first.`;
      case 'tempo':
        return t`Write the tempo as four numbers like 3-1-X-0 (X for as fast as possible).`;
      case 'variantOf':
        return value.code === 'unknown'
          ? t`The exercise it is a variant of is not in the library.`
          : t`Choose a main exercise, not a variant of a variant.`;
      case 'cues':
        return value.code === 'tooMany'
          ? t`Use at most 6 cues.`
          : t`Use at most 140 characters for each cue.`;
      default:
        return assertNever(value);
    }
  };

  return {
    mechanics,
    loadType,
    curveClass,
    curveHint,
    restClass,
    credit,
    creditOption,
    role,
    evidence,
    evidenceText,
    setupField,
    requirement,
    reps,
    issue,
  };
}
