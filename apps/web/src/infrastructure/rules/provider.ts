import type { RulesProvider } from '@powr/application';
import { rulesStamp, type CompiledRules } from '@powr/rules';
import type { resolveRules } from '@powr/rules/resolve';

type Resolver = { readonly resolveRules: typeof resolveRules };

/**
 * The rules port (§8.6.2, TD-31) over the shipped registry: `version` is its hashed stamp
 * (`1.0.0+<hash12>`); the resolver, which builds Zod schemas, loads on the first `resolve`, so
 * neither it nor Zod is on the startup path (§8.19). The service worker precaches the chunk.
 */
export function createRulesProvider(compiled: CompiledRules): RulesProvider {
  let resolver: Promise<Resolver> | null = null;
  return {
    version: rulesStamp(compiled),
    async resolve(context, overrides = []) {
      // oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the resolver
      resolver ??= import('@powr/rules/resolve');
      const { rules, issues } = (await resolver).resolveRules(compiled, context, overrides);
      return { rules, issues };
    },
  };
}

/**
 * The compiled registry (`@powr/rules/built-in`, data only, about 15 kB gzip): a lazy chunk the
 * boot sequence loads in parallel with the database and the content.
 */
export async function loadBuiltInRules(): Promise<CompiledRules> {
  // oxlint-disable-next-line no-restricted-imports -- the one sanctioned (lazy) load of the rules data
  const { BUILT_IN_RULES } = await import('@powr/rules/built-in');
  return BUILT_IN_RULES;
}
