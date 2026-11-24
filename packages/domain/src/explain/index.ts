/**
 * `@powr/domain/explain`: the typed "why" trace behind "suggests, you confirm" (PRG-09, technical
 * concept §8.7.3). Every suggestion and derived value the engine returns is an `Explained<T>`:
 * the value plus the rule that produced it, the data it used and the registry parameters (with
 * evidence tags, `verified` flags and origin) that shaped it. The UI renders `message` with
 * `args`; the body-map score (MAP-03) uses the same structure.
 */
import type { SourceId } from '../ids';
import type { EvidenceTag } from '../model';
import type { Param, ParamOrigin } from '../rules';
import type { ParamId } from '../rules/params';
import type { Mass } from '../units';

/** Every rule that can explain an output. Closed, so a test can check each has a message. */
export const RULE_IDS = [
  'loading.round',
  'e1rm.set',
  'e1rm.set.unknownEffort',
  'e1rm.set.excluded',
  'e1rm.session',
  'e1rm.loadForTarget',
  'trend.series',
  'trend.change.insufficientData',
  'trend.change.none',
  'trend.change.likely',
  'trend.change.veryLikely',
  'progression.double.topReached',
  'progression.double.repsUp',
  'progression.double.noHistory',
  'progression.rpe.load',
  'progression.rpe.backoff',
  'progression.apre.session',
  'progression.apre.adjust',
  'progression.linear.increase',
  'progression.linear.retry',
  'progression.linear.stallReset',
  'progression.linear.advancedHold',
  'progression.percent.load',
  'progression.level.trainingAge',
  'progression.level.slope',
  'warmup.heavy',
  'warmup.compound',
  'warmup.isolation',
  'warmup.feeder',
  'warmup.none',
  'rest.default',
  'volume.setCredit',
  'volume.notHardSet',
  'volume.muscles',
  'volume.band.belowFloor',
  'volume.band.low',
  'volume.band.default',
  'volume.band.high',
  'volume.band.softWarning',
  'volume.band.hardWarning',
  'volume.sessionCap.within',
  'volume.sessionCap.exceeded',
  'scoring.wilks',
  'scoring.wilks2020',
  'scoring.dots',
  'scoring.ipfPoints',
  'scoring.ipfGl',
  'scoring.allometric',
  'bodyweight.trend',
  'bodyweight.rate',
  'bodyweight.rate.insufficientData',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

/** Lingui message ID of a rule's explanation. */
export type MessageId = `why.${RuleId}`;

export type ExplainArg = string | number | boolean | null | { readonly mass: Mass };

/** Data an explanation is based on. */
export type Fact =
  | {
      readonly kind: 'set';
      readonly index: number;
      readonly load: Mass | null;
      readonly reps: number | null;
      readonly rir: number | null;
      readonly effortKnown: boolean;
    }
  | { readonly kind: 'quantity'; readonly name: string; readonly value: ExplainArg };

/** A registry parameter an output used, with its provenance (LEG-05). */
export interface ParamRef {
  readonly id: ParamId;
  readonly value: unknown;
  readonly origin: ParamOrigin;
  readonly evidence: readonly EvidenceTag[];
  readonly sources: readonly SourceId[];
  readonly verified: boolean;
}

export interface Explanation {
  readonly rule: RuleId;
  readonly message: MessageId;
  readonly args: Readonly<Record<string, ExplainArg>>;
  readonly facts: readonly Fact[];
  readonly params: readonly ParamRef[];
  /** Sub-steps, e.g. the rounding step of a suggested load. */
  readonly children: readonly Explanation[];
}

export interface Explained<T> {
  readonly value: T;
  readonly why: Explanation;
}

export function paramRef(param: Param<unknown>): ParamRef {
  return {
    id: param.id,
    value: param.value,
    origin: param.meta.origin,
    evidence: param.meta.evidence,
    sources: param.meta.sources,
    verified: param.meta.verified,
  };
}

export interface ExplanationParts {
  readonly args?: Readonly<Record<string, ExplainArg>>;
  readonly facts?: readonly Fact[];
  readonly params?: readonly Param<unknown>[];
  readonly children?: readonly Explanation[];
}

export function explain(rule: RuleId, parts: ExplanationParts = {}): Explanation {
  return {
    rule,
    message: `why.${rule}`,
    args: parts.args ?? {},
    facts: parts.facts ?? [],
    params: (parts.params ?? []).map(paramRef),
    children: parts.children ?? [],
  };
}

export function explained<T>(value: T, rule: RuleId, parts?: ExplanationParts): Explained<T> {
  return { value, why: explain(rule, parts) };
}

/** Shorthand for a named quantity fact. */
export function quantity(name: string, value: ExplainArg): Fact {
  return { kind: 'quantity', name, value };
}

/** Every parameter an explanation tree used, once each, in first-use order. */
export function paramsUsed(why: Explanation): readonly ParamRef[] {
  const seen = new Map<ParamId, ParamRef>();
  const visit = (node: Explanation): void => {
    for (const ref of node.params) if (!seen.has(ref.id)) seen.set(ref.id, ref);
    for (const child of node.children) visit(child);
  };
  visit(why);
  return [...seen.values()];
}
