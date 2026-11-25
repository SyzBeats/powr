import type { WorkspacePackage } from './workspace';

/**
 * Allowed internal dependencies (technical concept §5.1/§5.2):
 * apps/web -> application -> {formats, rules, content} -> domain. Tools are build-time only.
 */
export const ALLOWED_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  '@powr/domain': [],
  '@powr/rules': ['@powr/domain'],
  '@powr/content': ['@powr/domain'],
  '@powr/formats': ['@powr/domain'],
  '@powr/application': ['@powr/domain', '@powr/rules', '@powr/content', '@powr/formats'],
  '@powr/web': [
    '@powr/domain',
    '@powr/rules',
    '@powr/content',
    '@powr/formats',
    '@powr/application',
    '@powr/tools-licence',
  ],
  '@powr/tools-licence': [],
  '@powr/tools-arch-test': [],
  '@powr/tools-icons': [],
  '@powr/tools-tokens-check': [],
  // Compiles S-1 device-test records into the app's capability matrix (§8.8.5): data only.
  '@powr/tools-capability-matrix': [],
  // Body-map pipeline (S-5, §8.11): reads the taxonomy YAML as a file, writes the app's region
  // module; no package dependency.
  '@powr/tools-body-map': [],
  // Content build: validates content against the rules package's source registry (§8.12).
  '@powr/tools-content-build': ['@powr/domain', '@powr/rules', '@powr/content'],
};

export interface Violation {
  readonly packageName: string;
  readonly problem: string;
}

export function checkDependencyMatrix(packages: readonly WorkspacePackage[]): Violation[] {
  const violations: Violation[] = [];
  for (const pkg of packages) {
    const allowed = ALLOWED_DEPENDENCIES[pkg.name];
    if (!allowed) {
      violations.push({
        packageName: pkg.name,
        problem: 'is not in the allowed-dependency matrix',
      });
      continue;
    }
    for (const dep of pkg.internalDeps) {
      if (!allowed.includes(dep)) {
        violations.push({ packageName: pkg.name, problem: `must not depend on ${dep}` });
      }
    }
    for (const ref of pkg.tsReferences) {
      if (!allowed.includes(ref)) {
        violations.push({
          packageName: pkg.name,
          problem: `must not reference ${ref} in tsconfig`,
        });
      }
    }
    // package.json and tsconfig references must agree, or one of the two gates is silently open.
    const runtimeDeps = pkg.internalDeps.filter((dep) => !dep.startsWith('@powr/tools-'));
    const missingRefs = runtimeDeps.filter((dep) => !pkg.tsReferences.includes(dep));
    const extraRefs = pkg.tsReferences.filter((ref) => !pkg.internalDeps.includes(ref));
    if (missingRefs.length > 0) {
      violations.push({
        packageName: pkg.name,
        problem: `has no tsconfig reference for ${missingRefs.join(', ')}`,
      });
    }
    if (extraRefs.length > 0) {
      violations.push({
        packageName: pkg.name,
        problem: `references undeclared ${extraRefs.join(', ')}`,
      });
    }
  }
  return violations;
}

/** Calls the domain must never make (§5.2): time and randomness are passed in. */
const IMPURE_CALLS = [
  { pattern: /\bMath\.random\b/, label: 'Math.random' },
  { pattern: /\bDate\.now\b/, label: 'Date.now' },
  { pattern: /\bnew\s+Date\s*\(/, label: 'new Date(' },
];

export function findImpureCalls(fileName: string, source: string): string[] {
  return IMPURE_CALLS.filter(({ pattern }) => pattern.test(source)).map(
    ({ label }) => `${fileName} uses ${label}`,
  );
}
