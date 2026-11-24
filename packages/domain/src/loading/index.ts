/**
 * `@powr/domain/loading`: achievable loads (WKT-07, PRG-07, EQP-03). The plate calculator in
 * both directions, dumbbell, kettlebell and stack rounding, and bodyweight-added or assisted
 * loads. Every load the engine suggests is rounded here.
 */
export type {
  BarSpec,
  Implement,
  LoadOption,
  PlateInventory,
  PlatePair,
  Rounding,
  RoundingReason,
} from './types';
export {
  barbellTotal,
  implementUnit,
  maxLoad,
  nextLoadAbove,
  roundToAchievable,
  roundingExplanation,
} from './round';
export {
  effectiveLoadKg,
  externalLoadForTotal,
  type BodyweightImplements,
  type BodyweightLoadModel,
  type ExternalLoad,
} from './bodyweight';
