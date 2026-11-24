/**
 * `@powr/rules`: the rules registry (technical concept §8.6, ADR-0012). The parameter tables live
 * in `data/*.yaml`; the build (`scripts/build.ts`) validates them against the schemas and writes a
 * versioned, hashed `rules.json`; the resolver applies context variants and user overrides and
 * returns the typed `RuleSet` the engine in `@powr/domain` reads.
 *
 * The package root is on the app's startup path (the container stamps `RULES_VERSION`), so it is
 * free of Zod: only the version, the pure condition matcher and types (TD-17, §8.19). Everything
 * that builds a Zod schema is behind its own entry:
 * - `@powr/rules/schema`: row, condition and per-parameter value schemas (build and tools);
 * - `@powr/rules/resolve`: `parseCompiledRules`, `resolveRules`, `resolveParam` (lazy in the app);
 * - `@powr/rules/sources`, `…/sources/node`, `…/build/node`: the source registry and the build.
 */
export type { CompiledRules } from './compile';
export { matchesCondition, type ResolveContext } from './context';
export type { ParamOverride, ResolvedParam, ResolvedRuleSet } from './resolve';
export type { Condition, ParamDef } from './schema';
export { RULES_VERSION, rulesStamp } from './version';
