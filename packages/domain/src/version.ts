/**
 * Engine version; bump MINOR/MAJOR whenever outputs for the same inputs change (§7.8). 0.3.0
 * (T-01): the PRG-07 pace check's t quantile and IPF GL's 6-decimal rounding.
 */
export const ENGINE_VERSION = '0.3.0';

/** Engine, rules and content versions an output was computed with (PRG-18). */
export interface VersionStamp {
  readonly engine: string;
  readonly rules: string;
  readonly content: string;
}
