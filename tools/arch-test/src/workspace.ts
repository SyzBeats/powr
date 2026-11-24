import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export interface WorkspacePackage {
  readonly name: string;
  /** Directory relative to the workspace root, e.g. "packages/domain". */
  readonly dir: string;
  /** Internal (`@powr/*`) dependencies declared in package.json. */
  readonly internalDeps: string[];
  /** Internal packages referenced from the package's tsconfig files. */
  readonly tsReferences: string[];
}

const WORKSPACE_GLOBS = ['apps', 'packages', 'tools'];

/** Reads every workspace package with its declared and referenced internal dependencies. */
export function readWorkspace(root: string): WorkspacePackage[] {
  const dirs = WORKSPACE_GLOBS.flatMap((group) =>
    existsSync(join(root, group))
      ? readdirSync(join(root, group), { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() && existsSync(join(root, group, entry.name, 'package.json')),
          )
          .map((entry) => `${group}/${entry.name}`)
      : [],
  );
  const nameByDir = new Map(
    dirs.map((dir) => [dir, readJson(join(root, dir, 'package.json')).name as string]),
  );

  return dirs.map((dir) => {
    const manifest = readJson(join(root, dir, 'package.json'));
    const declared = { ...manifest.dependencies, ...manifest.devDependencies } as Record<
      string,
      string
    >;
    return {
      name: nameByDir.get(dir) ?? dir,
      dir,
      internalDeps: Object.keys(declared)
        .filter((dep) => dep.startsWith('@powr/'))
        .toSorted(),
      tsReferences: [...collectReferences(root, join(root, dir, 'tsconfig.json'), new Set())]
        .map((refDir) => nameByDir.get(refDir))
        .filter((name): name is string => name !== undefined && name !== nameByDir.get(dir))
        .toSorted(),
    };
  });
}

/** Follows tsconfig `references` within a package (apps/web has a solution tsconfig). */
function collectReferences(root: string, tsconfigPath: string, seen: Set<string>): Set<string> {
  const found = new Set<string>();
  if (seen.has(tsconfigPath) || !existsSync(tsconfigPath)) return found;
  seen.add(tsconfigPath);
  const config = readJson(tsconfigPath);
  const ownDir = dirname(tsconfigPath);
  for (const reference of (config.references ?? []) as { path: string }[]) {
    const target = resolve(ownDir, reference.path);
    const targetConfig = target.endsWith('.json') ? target : join(target, 'tsconfig.json');
    const targetPackageDir = relative(root, findPackageDir(dirname(targetConfig)));
    if (resolve(root, targetPackageDir) === findPackageDir(ownDir)) {
      for (const nested of collectReferences(root, targetConfig, seen)) found.add(nested);
    } else {
      found.add(targetPackageDir);
    }
  }
  return found;
}

function findPackageDir(dir: string): string {
  let current = dir;
  while (!existsSync(join(current, 'package.json'))) {
    const parent = dirname(current);
    if (parent === current) return dir;
    current = parent;
  }
  return current;
}

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8'));
}
