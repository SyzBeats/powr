import { readFileSync } from 'node:fs';

import parseSpdx, { type LicenseNode } from 'spdx-expression-parse';
import { parse as parseYaml } from 'yaml';

interface LicenceException {
  readonly package: string;
  readonly version: string;
  readonly licence: string;
  readonly scope: 'distributed' | 'build-only';
  readonly reviewer: string;
  /** Who approved the exception, and when (the product owner, ADR-0018). */
  readonly approval: string;
  readonly date: string;
  readonly rationale: string;
}

interface DeniedPackage {
  /** A package name, or a `prefix*` pattern such as `@sentry/*`. */
  readonly package: string;
  readonly reason: string;
}

export interface LicencePolicy {
  readonly allowed: readonly string[];
  readonly denied: readonly string[];
  /** Allowed only for components that are never shipped to users (test and build tools). */
  readonly devOnlyAllowed: readonly string[];
  /** Refused whatever their licence, shipped or build-only; no exception overrides them. */
  readonly deniedPackages: readonly DeniedPackage[];
  readonly exceptions: readonly LicenceException[];
  /**
   * Programs the publisher runs on its server (deploy/server-inventory.yaml, L-2) are never
   * distributed, so only these licences matter for them: ones that bind the publisher for
   * running a program as a network service, or restrict running it in production.
   */
  readonly serverDenied: readonly string[];
}

export function loadPolicy(file: string): LicencePolicy {
  const raw = parseYaml(readFileSync(file, 'utf8')) as Partial<LicencePolicy>;
  return {
    allowed: raw.allowed ?? [],
    denied: raw.denied ?? [],
    devOnlyAllowed: raw.devOnlyAllowed ?? [],
    deniedPackages: raw.deniedPackages ?? [],
    exceptions: raw.exceptions ?? [],
    serverDenied: raw.serverDenied ?? [],
  };
}

export type Verdict =
  | { readonly status: 'allowed'; readonly chosen: string; readonly via?: 'exception' }
  | { readonly status: 'denied' | 'unapproved' | 'unknown'; readonly reason: string };

export interface Component {
  readonly name: string;
  readonly version: string;
  /** Raw licence declaration as found (SPDX expression or legacy field). */
  readonly licence: string | null;
  readonly distributed: boolean;
}

/**
 * Evaluates one component against the policy (LEG-08). For `OR` expressions the first
 * permitted alternative is chosen and recorded; for `AND` every part must be permitted.
 */
export function evaluate(component: Component, policy: LicencePolicy): Verdict {
  // A denied package fails before anything else: neither its licence nor an exception saves it.
  const refused = policy.deniedPackages.find((entry) =>
    matchesPattern(component.name, entry.package),
  );
  if (refused) {
    return { status: 'denied', reason: `package ${component.name} is denied: ${refused.reason}` };
  }

  // An exception counts only with a recorded product-owner approval (ADR-0018).
  const exception = policy.exceptions.find(
    (entry) =>
      entry.package === component.name &&
      entry.version === component.version &&
      Boolean(entry.approval?.trim()) &&
      (entry.scope === 'build-only' ? !component.distributed : true),
  );
  if (exception) return { status: 'allowed', chosen: exception.licence, via: 'exception' };

  if (!component.licence) return { status: 'unknown', reason: 'no licence declared' };
  let tree: LicenseNode;
  try {
    tree = parseSpdx(component.licence);
  } catch {
    return { status: 'unknown', reason: `unparseable licence "${component.licence}"` };
  }

  const permitted = component.distributed
    ? policy.allowed
    : [...policy.allowed, ...policy.devOnlyAllowed];
  return evaluateNode(tree, permitted, policy.denied);
}

/**
 * Evaluates a program the publisher runs on its server (L-2). Its licence is recorded as the
 * package manager declares it (not always an SPDX expression), so every licence-like word is
 * checked against `serverDenied`; anything else is allowed, because nothing is distributed.
 */
export function evaluateServer(
  component: Omit<Component, 'distributed'>,
  policy: LicencePolicy,
): Verdict {
  if (!component.licence?.trim()) return { status: 'unknown', reason: 'no licence declared' };
  const words = component.licence.split(/[\s()]+/).filter((word) => word !== '');
  const found = words.find((word) =>
    policy.serverDenied.some((pattern) => matchesPattern(word, pattern)),
  );
  if (found) {
    return {
      status: 'denied',
      reason: `${found} binds running it as a network service or in production: review it first`,
    };
  }
  return { status: 'allowed', chosen: component.licence };
}

function evaluateNode(
  node: LicenseNode,
  permitted: readonly string[],
  denied: readonly string[],
): Verdict {
  if ('license' in node) {
    const id = node.plus ? `${node.license}+` : node.license;
    const full = node.exception ? `${id} WITH ${node.exception}` : id;
    if (permitted.includes(node.license) && !node.exception)
      return { status: 'allowed', chosen: full };
    if (denied.some((pattern) => matchesPattern(node.license, pattern))) {
      return { status: 'denied', reason: `${full} is denied` };
    }
    return { status: 'unapproved', reason: `${full} is not on the allowlist` };
  }

  const left = evaluateNode(node.left, permitted, denied);
  const right = evaluateNode(node.right, permitted, denied);
  if (node.conjunction === 'or') {
    if (left.status === 'allowed') return left;
    if (right.status === 'allowed') return right;
    return left;
  }
  if (left.status !== 'allowed') return left;
  if (right.status !== 'allowed') return right;
  return { status: 'allowed', chosen: `${left.chosen} AND ${right.chosen}` };
}

/** Policy patterns like `GPL-*` match any licence ID with that prefix. */
function matchesPattern(licence: string, pattern: string): boolean {
  return pattern.endsWith('*') ? licence.startsWith(pattern.slice(0, -1)) : licence === pattern;
}

/** Normalizes legacy `license` / `licenses` package.json fields into one SPDX expression. */
export function licenceFromManifest(manifest: Record<string, unknown>): string | null {
  const { license, licenses } = manifest as {
    license?: string | { type?: string };
    licenses?: { type?: string }[];
  };
  if (typeof license === 'string') {
    return /^(SEE LICEN[CS]E IN|UNLICENSED$)/i.test(license) ? null : license;
  }
  if (license && typeof license.type === 'string') return license.type;
  if (Array.isArray(licenses) && licenses.length > 0) {
    const types = licenses.map((entry) => entry.type).filter((type): type is string => !!type);
    return types.length > 1 ? `(${types.join(' OR ')})` : (types[0] ?? null);
  }
  return null;
}
