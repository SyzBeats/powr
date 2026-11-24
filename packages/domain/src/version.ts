/** Engine version; bump MINOR/MAJOR whenever outputs for the same inputs change (§7.8). */
export const ENGINE_VERSION = '0.0.0';

/** Engine, rules and content versions an output was computed with (PRG-18). */
export interface VersionStamp {
  readonly engine: string;
  readonly rules: string;
  readonly content: string;
}
