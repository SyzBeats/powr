/**
 * Units (§8.1): masses and lengths are stored as entered; calculations convert to kg (cm) with
 * exact factors and round only at the boundary, through `roundToStep`/`displayMass` here or the
 * achievable-load service in `@powr/domain/loading`.
 */
export { KG_PER_LB, convertMass, fromKg, toKg, type Mass, type MassUnit } from './mass';
export { CM_PER_IN, convertLength, toCm, type Length, type LengthUnit } from './length';
export {
  ROUNDING_MODES,
  cleanFloat,
  displayMass,
  roundToStep,
  type RoundingMode,
} from './rounding';
