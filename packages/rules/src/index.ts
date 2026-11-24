/**
 * `@powr/rules`: the rules registry (technical concept §8.6, ADR-0012). The parameter tables live
 * in `data/*.yaml`; the build (`scripts/build.ts`) validates them against the schemas here and
 * writes a versioned, hashed `rules.json`; the resolver applies context variants and user
 * overrides and returns the typed `RuleSet` the engine in `@powr/domain` reads.
 */
export type { CompiledRules } from './compile';
export { matchesCondition, type ResolveContext } from './context';
export { PARAM_IDS, PARAM_SCHEMAS, isParamId } from './params';
export {
  parseCompiledRules,
  resolveParam,
  resolveRules,
  rulesStamp,
  type ParamOverride,
  type ResolvedParam,
  type ResolvedRuleSet,
} from './resolve';
export {
  conditionSchema,
  evidenceTagSchema,
  paramDefSchema,
  sourceIdSchema,
  type Condition,
  type ParamDef,
} from './schema';

/** Registry SemVer; the compiled `rules.json` adds its content hash (§7.8). */
export const RULES_VERSION = '1.0.0';
