import { useLingui } from '@lingui/react/macro';

import type { LengthUnit, MassUnit, MeasurementSite } from '@powr/domain';
import type { BodyweightRate, RateBand } from '@powr/domain/bodyweight';

import { useProfile } from '../../hooks/use-planning';
import { formatNumber } from '../../i18n/format';
import { assertNever } from '../exhaustive';
import { massFromKg } from '../session/words';

/*
 * Words of the bodyweight and measurement screens (BOD-01…03). Tone (MOT-10): the trend and the
 * rate are facts; never a BMI label, never praise for losing fast, no alert from a single day.
 */

const KG_PER_LB = 0.45359237;

/** The user's bodyweight unit (onboarding), kg until a profile exists. */
export function useBodyweightUnit(): MassUnit {
  const profile = useProfile();
  return (profile.loaded ? profile.value?.units.bodyweight : undefined) ?? 'kg';
}

/** The user's length unit for circumferences (skinfolds are always mm). */
export function useLengthUnit(): LengthUnit {
  const profile = useProfile();
  return (profile.loaded ? profile.value?.units.length : undefined) ?? 'cm';
}

/** A value in kg in the user's unit as a number (for inputs). */
export function kgToUnit(valueKg: number, unit: MassUnit): number {
  return unit === 'kg' ? valueKg : valueKg / KG_PER_LB;
}

/** "82.4 kg" in the bodyweight unit, one decimal. */
export function bodyMass(valueKg: number, unit: MassUnit): string {
  return massFromKg(valueKg, unit, 1);
}

export function useBodyWords() {
  const { t } = useLingui();

  /** "−0.3 kg a week (−0.4%)", gains with a plus sign. */
  const rate = (value: BodyweightRate, unit: MassUnit): string => {
    const perWeek = kgToUnit(value.kgPerWeek, unit);
    const amount = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(Math.round(perWeek * 100) / 100);
    const pct = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(Math.round(value.pctPerWeek * 100) / 100);
    return unit === 'kg' ? t`${amount} kg a week (${pct}%)` : t`${amount} lb a week (${pct}%)`;
  };

  /** The rate against the phase's band, in a few words (the "Why?" says the rest). */
  const band = (value: RateBand): string => {
    switch (value.status) {
      case 'in':
        return t`Within your target range`;
      case 'below':
        return t`Below your target range`;
      case 'above':
        return t`Above your target range`;
      case 'untracked':
        return t`No phase set`;
      case 'insufficientData':
        return t`Not enough data yet`;
      default:
        return assertNever(value.status);
    }
  };

  const site = (value: MeasurementSite): string => {
    switch (value) {
      case 'neck':
        return t`Neck`;
      case 'chest':
        return t`Chest`;
      case 'waist':
        return t`Waist`;
      case 'hips':
        return t`Hips`;
      case 'upperArmLeft':
        return t`Upper arm, left`;
      case 'upperArmRight':
        return t`Upper arm, right`;
      case 'thighLeft':
        return t`Thigh, left`;
      case 'thighRight':
        return t`Thigh, right`;
      case 'calfLeft':
        return t`Calf, left`;
      case 'calfRight':
        return t`Calf, right`;
      case 'skinfoldChest':
        return t`Skinfold, chest`;
      case 'skinfoldAbdomen':
        return t`Skinfold, abdomen`;
      case 'skinfoldThigh':
        return t`Skinfold, thigh`;
      case 'skinfoldTriceps':
        return t`Skinfold, triceps`;
      case 'skinfoldSuprailiac':
        return t`Skinfold, suprailiac`;
      case 'skinfoldSubscapular':
        return t`Skinfold, subscapular`;
      case 'skinfoldMidaxillary':
        return t`Skinfold, midaxillary`;
      default:
        return assertNever(value);
    }
  };

  /** "84.5 cm", "33.3 in", "12 mm". */
  const length = (value: number, unit: LengthUnit | 'mm'): string => {
    const shown = formatNumber(value, 1);
    return unit === 'mm' ? t`${shown} mm` : unit === 'cm' ? t`${shown} cm` : t`${shown} in`;
  };

  return { mass: bodyMass, rate, band, site, length };
}
