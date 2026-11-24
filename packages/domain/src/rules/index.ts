/**
 * `@powr/domain/rules`: the shape of a resolved rule set (technical concept §8.6.2). The domain
 * owns the types; `@powr/rules` loads the registry, applies context variants and user overrides
 * and hands engine functions a `RuleSet` (or the slice they need) as an argument.
 */
import type { SourceId } from '../ids';
import type { EvidenceTag } from '../model';
import type { ParamId, ParamUnit, ParamValues } from './params';

/** Where a resolved value came from (resolution order default → variant → user → exercise). */
export const PARAM_ORIGINS = ['default', 'variant', 'user', 'exercise'] as const;
export type ParamOrigin = (typeof PARAM_ORIGINS)[number];

/** Provenance of a resolved parameter, shown by "Why?" and the evidence labels (LEG-05). */
export interface ParamMeta {
  readonly unit: ParamUnit;
  readonly evidence: readonly EvidenceTag[];
  readonly sources: readonly SourceId[];
  readonly ebRef: string;
  /** false: a preliminary value (preprint or POWR design choice), labelled as such in the UI. */
  readonly verified: boolean;
  readonly label: string;
  readonly origin: ParamOrigin;
  /** The evidence default for this context, shown next to a user's own value (§8.6.3). */
  readonly defaultValue: unknown;
  /** A user value outside the registry range: accepted, with a note (TMR-02, §8.6.3). */
  readonly outOfRange: boolean;
}

export interface Param<V> {
  readonly id: ParamId;
  readonly value: V;
  readonly meta: ParamMeta;
}

/** Every MVP parameter, resolved for one context. */
export type RuleSet = { readonly [K in ParamId]: Param<ParamValues[K]> };

/** The parameters one engine function reads. */
export type RuleSlice<K extends ParamId> = Pick<RuleSet, K>;

export * from './params';
export * from './techniques';
