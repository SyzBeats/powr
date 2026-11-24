// The build output of scripts/build.ts (`pnpm --filter @powr/rules build`), committed so every
// tool and the app can import it; scripts/build.test.ts fails when it is stale. Validated and
// hashed at build time, hence the cast.
import compiled from '../generated/rules.json';
import type { CompiledRules } from './compile';

/**
 * `@powr/rules/built-in`: the compiled registry shipped with this build (TD-31). Data only, no
 * Zod: the app loads it with `import()` at boot to stamp `rulesStamp(BUILT_IN_RULES)`
 * (`1.0.0+<hash12>`) and resolves it lazily through `@powr/rules/resolve` (§8.19).
 */
export const BUILT_IN_RULES = compiled as unknown as CompiledRules;
