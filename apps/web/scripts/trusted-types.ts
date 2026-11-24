/**
 * Trusted Types for development and E2E builds (§7.3, TD-12). The Vite dev server sends these
 * directives as its CSP; the E2E test server appends them to the production CSP from
 * deploy/security-headers.conf. Production does not send them yet (TD-03).
 *
 * The allow-list names every policy the app creates. Today that is one:
 * `powr-sw` (src/infrastructure/security/trusted-types.ts, the service-worker script URL).
 */
const TRUSTED_TYPES_POLICIES = ['powr-sw'] as const;

export const TRUSTED_TYPES_CSP = `require-trusted-types-for 'script'; trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')}`;
