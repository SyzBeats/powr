import type { Param, ParamId, ParamOrigin, RuleSet } from '@powr/domain/rules';

import type { CompiledRules } from './compile';
import { matchesCondition, type ResolveContext } from './context';
import { PARAM_IDS, PARAM_SCHEMAS, isParamId } from './params';
import { paramDefSchema, type ParamDef } from './schema';
import { z } from './zod';

/** A user's own value (settings.overrides, §8.6.3); with `exerciseId` it applies to one exercise. */
export interface ParamOverride {
  readonly paramId: string;
  readonly value: unknown;
  readonly exerciseId?: string;
}

export interface ResolvedParam {
  readonly param: Param<unknown>;
  /** Overrides that were ignored, with the reason. */
  readonly issues: readonly string[];
}

/**
 * Resolves one row (§8.6.3): default → first matching context variant → global user override →
 * per-exercise user override. A user value must pass the parameter's schema; outside the
 * registry range it is accepted and flagged. Throws for a row blocked until verified (E-5).
 */
export function resolveParam(
  def: ParamDef,
  overrides: readonly ParamOverride[] = [],
  context: ResolveContext = {},
): ResolvedParam {
  if (def.blockedUntilVerified && !def.verified) {
    throw new Error(`Parameter ${def.id} is blocked until verified (E-5)`);
  }
  const variant = def.variants?.find((candidate) => matchesCondition(candidate.when, context));
  const defaultValue: unknown = variant ? variant.value : def.value;
  let value = defaultValue;
  let origin: ParamOrigin = variant ? 'variant' : 'default';
  const issues: string[] = [];

  const exerciseId = context.exercise?.id;
  const candidates = overrides.filter(
    (override) =>
      override.paramId === def.id &&
      (override.exerciseId === undefined || override.exerciseId === exerciseId),
  );
  // Global overrides first, then the exercise's own, so the per-exercise value wins.
  for (const override of candidates.toSorted(
    (a, b) => Number(a.exerciseId !== undefined) - Number(b.exerciseId !== undefined),
  )) {
    if (!def.userOverridable) {
      issues.push(`${def.id}: not user-overridable, override ignored`);
      continue;
    }
    const schema = isParamId(def.id) ? PARAM_SCHEMAS[def.id] : z.json();
    const parsed = schema.safeParse(override.value);
    if (!parsed.success) {
      issues.push(`${def.id}: invalid override ignored (${parsed.error.issues[0]?.message})`);
      continue;
    }
    value = parsed.data;
    origin = override.exerciseId === undefined ? 'user' : 'exercise';
  }

  return {
    param: {
      id: def.id as ParamId,
      value,
      meta: {
        unit: def.unit,
        evidence: def.evidence,
        sources: def.sources,
        ebRef: def.ebRef,
        verified: def.verified,
        label: def.label ?? `params.${def.id}`,
        origin,
        defaultValue,
        outOfRange: origin !== 'default' && origin !== 'variant' && outOfRange(value, def.range),
      },
    },
    issues,
  };
}

export interface ResolvedRuleSet {
  /** The registry version and hash, for `VersionStamp.rules` (PRG-18): `1.0.0+<hash12>`. */
  readonly version: string;
  readonly rules: RuleSet;
  readonly issues: readonly string[];
}

/** Resolves every MVP parameter for one context (§8.6.2). */
export function resolveRules(
  compiled: CompiledRules,
  context: ResolveContext = {},
  overrides: readonly ParamOverride[] = [],
): ResolvedRuleSet {
  const byId = new Map(compiled.params.map((def) => [def.id, def]));
  const rules: Record<string, Param<unknown>> = {};
  const issues: string[] = [];
  for (const id of PARAM_IDS) {
    const def = byId.get(id);
    if (!def) throw new Error(`The compiled rules lack parameter ${id}`);
    const resolved = resolveParam(def, overrides, context);
    rules[id] = resolved.param;
    issues.push(...resolved.issues);
  }
  for (const override of overrides) {
    if (!byId.has(override.paramId))
      issues.push(`${override.paramId}: unknown parameter, override ignored`);
  }
  // Every value passed its schema when the registry was compiled or parsed, and each override
  // when it was applied, so the record has exactly the RuleSet shape.
  return { version: rulesStamp(compiled), rules: rules as RuleSet, issues };
}

/** `version+hash12`, the string stored in `VersionStamp.rules`. */
export function rulesStamp(compiled: Pick<CompiledRules, 'version' | 'hash'>): string {
  return `${compiled.version}+${compiled.hash.slice(0, 12)}`;
}

const compiledRulesSchema = z.strictObject({
  format: z.literal(1),
  version: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  params: z.array(paramDefSchema),
});

/**
 * Validates a loaded `rules.json` (e.g. from the precache) before it is resolved: the file shape,
 * every row, every value against its parameter schema and the complete MVP set. Throws on error.
 */
export function parseCompiledRules(json: unknown): CompiledRules {
  const parsed = compiledRulesSchema.parse(json);
  const ids = new Set(parsed.params.map((def) => def.id));
  for (const id of PARAM_IDS) if (!ids.has(id)) throw new Error(`rules.json lacks parameter ${id}`);
  for (const def of parsed.params) {
    if (!isParamId(def.id)) continue;
    const schema = PARAM_SCHEMAS[def.id];
    schema.parse(def.value);
    for (const variant of def.variants ?? []) schema.parse(variant.value);
  }
  return parsed;
}

function outOfRange(value: unknown, range: ParamDef['range']): boolean {
  if (typeof value !== 'number' || !range) return false;
  const { min, max } = range;
  return (typeof min === 'number' && value < min) || (typeof max === 'number' && value > max);
}
