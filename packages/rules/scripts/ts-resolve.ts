import { registerHooks } from 'node:module';

/**
 * Lets plain `node` run the rules build: the workspace packages import TypeScript modules without
 * extensions (`./params`, `../ids`), which Node's ESM resolver rejects. This hook retries such a
 * relative import with `.ts` and `/index.ts`; Node strips the types itself.
 * Usage: node --import ./scripts/ts-resolve.ts scripts/build.ts
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith('.')) throw error;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // Try the next candidate.
        }
      }
      throw error;
    }
  },
});
