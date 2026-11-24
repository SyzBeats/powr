/**
 * Trusted Types (§7.3). Development and E2E builds send `require-trusted-types-for 'script'`
 * with an allow-list of policy names (apps/web/scripts/trusted-types.ts; production follows with
 * TD-03), so every sink that loads or runs script needs a value from a named policy. The app has
 * one such sink, the service-worker registration, and one policy that only ever returns its URL.
 *
 * TypeScript 7.0's DOM types do not model Trusted Types: the policy is typed structurally, and
 * the trusted value is typed as the string it stands for (`register` accepts both at runtime).
 */
const SERVICE_WORKER_POLICY = 'powr-sw';
const SERVICE_WORKER_URL = '/sw.js';

interface ScriptUrlPolicy {
  createScriptURL(input: string): unknown;
}
interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL(input: string): string }): ScriptUrlPolicy;
}

let policy: ScriptUrlPolicy | null | undefined;

/** The service-worker script URL, as a TrustedScriptURL where the browser has Trusted Types. */
export function serviceWorkerScriptUrl(): string {
  if (policy === undefined) {
    const factory = (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
    policy =
      factory?.createPolicy(SERVICE_WORKER_POLICY, {
        createScriptURL(input) {
          if (input !== SERVICE_WORKER_URL) throw new TypeError(`Untrusted script URL: ${input}`);
          return input;
        },
      }) ?? null;
  }
  return policy ? (policy.createScriptURL(SERVICE_WORKER_URL) as string) : SERVICE_WORKER_URL;
}
