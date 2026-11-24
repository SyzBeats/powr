import { readFileSync } from 'node:fs';

import parseSpdx, { type LicenseNode } from 'spdx-expression-parse';
import { parse as parseYaml } from 'yaml';

interface LicenceException {
  readonly package: string;
  readonly version: string;
  readonly licence: string;
  readonly scope: 'distributed' | 'build-only';
  readonly reviewer: string;
  readonly date: string;
  readonly rationale: string;
}

export interface LicencePolicy {
  readonly allowed: readonly string[];
  readonly denied: readonly string[];
  /** Allowed only for components that are never shipped to users (test and build tools). */
  readonly devOnlyAllowed: readonly string[];
  readonly exceptions: readonly LicenceException[];
}

export function loadPolicy(file: string): LicencePolicy {
  const raw = parseYaml(readFileSync(file, 'utf8')) as Partial<LicencePolicy>;
  return {
    allowed: raw.allowed ?? [],
    denied: raw.denied ?? [],
    devOnlyAllowed: raw.devOnlyAllowed ?? [],
    exceptions: raw.exceptions ?? [],
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
  const exception = policy.exceptions.find(
    (entry) =>
      entry.package === component.name &&
      entry.version === component.version &&
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
