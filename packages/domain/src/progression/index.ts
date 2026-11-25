/**
 * `@powr/domain/progression`: next-exposure suggestions (PRG-03…07, PRG-10; EB §Progression).
 * Double progression, RPE-based loads from e1RM with in-session back-off adjustment, the APRE-6
 * preset, linear progression with level increments and the stall rule, fixed percentages and
 * the trainee classifier, and the PRG-07 pace check (TD-44). Every function suggests; the user confirms (each result is explained).
 */
export { apreSession, suggestApre, type ApreSet } from './apre';
export { suggestDoubleProgression, type DoubleProgressionInput } from './double';
export { classifyTrainee, type ClassificationRules } from './level';
export { suggestLinear, type LinearInput, type LinearRules } from './linear';
export {
  progressionPace,
  type PaceCheck,
  type PaceInput,
  type PaceRules,
  type PaceSample,
} from './pace';
export { percentLoad } from './percent';
export { suggestBackoff, suggestRpeLoad, type BackoffInput } from './rpe';
export {
  bodyRegionOf,
  workingSets,
  type BodyRegion,
  type LoadSuggestion,
  type PerformedSet,
  type SuggestionEquipment,
} from './types';
