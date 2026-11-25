import { useLingui } from '@lingui/react/macro';

import type { Mass, MassUnit, SetType } from '@powr/domain';
import type { TechniqueKind } from '@powr/domain/rules';
import type {
  Announcement,
  GuardrailKind,
  PrRecord,
  SessionRejection,
  SessionView,
} from '@powr/domain/session';

import { useProfile } from '../../hooks/use-planning';
import { formatMass, formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { useLabels } from '../labels';

const KG_PER_LB = 0.45359237;

/** The user's load unit (onboarding), kg until a profile exists. */
export function useLoadUnit(): MassUnit {
  const profile = useProfile();
  return (profile.loaded ? profile.value?.units.load : undefined) ?? 'kg';
}

/**
 * A value stored in kg, shown in the user's unit ("102.5 kg", "226 lb"), rounded to `digits`
 * decimals after the conversion (estimates to 0.1, volume loads to whole numbers).
 */
export function massFromKg(valueKg: number, unit: MassUnit, digits = 2): string {
  const factor = 10 ** digits;
  const value = unit === 'kg' ? valueKg : valueKg / KG_PER_LB;
  return formatMass(Math.round(value * factor) / factor, unit);
}

/** Effort as the user enters it (WKT-03): RIR in half steps, "5+" for open-ended. */
export function rirText(rir: number | null, openEnded = false): string {
  if (rir === null) return '';
  return openEnded ? `${formatNumber(rir, 1)}+` : formatNumber(rir, 1);
}

/** A load with its unit, or null for none (pure bodyweight). Assistance shows as negative. */
export function massText(load: Mass | null): string | null {
  return load ? formatMass(load.value, load.unit) : null;
}

/** Words of the session screens: set types, techniques, rejections, hints and announcements. */
export function useSessionWords() {
  const { t } = useLingui();
  const labels = useLabels();
  const loadUnit = useLoadUnit();

  const setType = (type: SetType): string => {
    switch (type) {
      case 'warmup':
        return t`Warm-up`;
      case 'working':
        return t`Working set`;
      case 'top':
        return t`Top set`;
      case 'backoff':
        return t`Back-off set`;
      case 'amrap':
        return t`As many reps as possible`;
      case 'timed':
        return t`Timed set`;
      default:
        return assertNever(type);
    }
  };

  const technique = (kind: TechniqueKind): string => {
    switch (kind) {
      case 'drop':
        return t`Drop set`;
      case 'restPause':
        return t`Rest-pause`;
      case 'myoReps':
        return t`Myo-reps`;
      case 'cluster':
        return t`Cluster set`;
      case 'lengthenedPartials':
        return t`Lengthened partials`;
      case 'partialExtension':
        return t`Partials after failure`;
      default:
        return assertNever(kind);
    }
  };

  /** What the technique's count means ("Drops", "Mini-sets"), or null when it has none. */
  const techniqueUnits = (kind: TechniqueKind): string | null => {
    switch (kind) {
      case 'drop':
        return t`Drops`;
      case 'restPause':
      case 'myoReps':
        return t`Mini-sets`;
      case 'partialExtension':
        return t`Partial blocks`;
      case 'cluster':
      case 'lengthenedPartials':
        return null;
      default:
        return assertNever(kind);
    }
  };

  const hintTitle = (kind: GuardrailKind): string => {
    switch (kind) {
      case 'sessionVolume':
        return t`A lot of sets for one muscle today`;
      case 'failure':
        return t`Failure on a heavy compound lift`;
      case 'shortRest':
        return t`Short rest on a competition lift`;
      case 'slowReps':
        return t`Very slow reps`;
      default:
        return assertNever(kind);
    }
  };

  /** Why the session refused an event, in words the user can act on. */
  const rejection = (rejected: SessionRejection): string => {
    switch (rejected.kind) {
      case 'notActive':
        return t`This workout has already ended.`;
      case 'unknownSlot':
      case 'unknownSet':
      case 'unknownGroup':
        return t`That set or exercise is no longer in this workout.`;
      case 'unknownExercise':
        return t`That exercise is not in the library.`;
      case 'alreadyLogged':
        return t`This set is logged already. Edit it in the list instead.`;
      case 'notPending':
        return t`This set is not open any more.`;
      case 'hasLoggedSets':
        return t`This exercise has logged sets. Skip it instead of removing it.`;
      case 'invalidValues':
        return t`Check the values: weight and reps cannot be negative.`;
      case 'implausible':
        return t`These values look unusual. Check them, then confirm again.`;
      case 'invalidOrder':
        return t`That order is not possible.`;
      case 'alreadyGrouped':
        return t`This exercise is already in a superset.`;
      case 'noWorkingLoad':
        return t`Log or enter a working weight first.`;
      case 'noTimer':
        return t`No timer is running.`;
      case 'undoExpired':
        return t`It is too late to undo that.`;
      case 'idsExhausted':
        return t`Something went wrong. Try again.`;
      default:
        return assertNever(rejected);
    }
  };

  /** "New rep PR: 100 kg for 5" (MOT-02, §8.9.6), in the user's load unit. */
  const pr = (record: PrRecord, unit: MassUnit = loadUnit): string => {
    // Estimates to 0.1, volume loads to whole numbers; lifted loads as entered.
    const digits = record.type === 'e1rm' ? 1 : record.type === 'volume' ? 0 : 2;
    const value = massFromKg(record.valueKg, unit, digits);
    const name = labels.exercise(record.exerciseId);
    switch (record.type) {
      case 'rep': {
        const reps = record.reps ?? 0;
        return t`New rep PR on ${name}: ${value} for ${reps}`;
      }
      case 'load':
        return t`New heaviest weight on ${name}: ${value}`;
      case 'e1rm':
        return t`New estimated 1-rep max on ${name}: ${value}`;
      case 'volume':
        return t`New volume record on ${name}: ${value}`;
      default:
        return assertNever(record.type);
    }
  };

  /** The live-region text of a session announcement; rests are announced by the timer alerts. */
  const announcement = (item: Announcement, view: SessionView | null): string | null => {
    const slotName = (slotKey: string) => {
      const slot = view?.session.exercises.find((entry) => entry.key === slotKey);
      return slot ? labels.exercise(slot.exerciseId) : '';
    };
    const setNumber = (slotKey: string, setKey: string) => {
      const slot = view?.session.exercises.find((entry) => entry.key === slotKey);
      return (slot?.sets.findIndex((set) => set.key === setKey) ?? -1) + 1;
    };
    switch (item.kind) {
      case 'setLogged': {
        const name = slotName(item.slotKey);
        const number = setNumber(item.slotKey, item.setKey);
        return t`${name}, set ${number} logged.`;
      }
      case 'setSkipped': {
        const name = slotName(item.slotKey);
        const number = setNumber(item.slotKey, item.setKey);
        return t`${name}, set ${number} skipped.`;
      }
      case 'exerciseDone': {
        const name = slotName(item.slotKey);
        return t`${name} done.`;
      }
      case 'sessionDone':
        return t`All planned sets done.`;
      case 'undone':
        return t`Undone.`;
      case 'restStarted':
      case 'transition':
        // Announced by the timer alerts when the timer is armed ("Rest started, 2 minutes").
        return null;
      default:
        return assertNever(item);
    }
  };

  return { setType, technique, techniqueUnits, hintTitle, rejection, pr, announcement };
}

export type SessionWords = ReturnType<typeof useSessionWords>;
