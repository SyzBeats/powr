import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `pnpm --filter @powr/web ui:add <component…> [shadcn options]`: runs the pinned shadcn CLI and
 * lands its output on the app's own `#ui/cn` helper (TD-21, product-owner decision 2026-11-24).
 * Registry items import `cn` from the pre-1.0 `cn` npm package, which the CLI also installs, and
 * `components.json` aliases cannot redirect a bare package import. So this script rewrites those
 * imports to `#ui/cn`, removes the package again and formats the design system. The rest of the
 * review in technical concept §8.9.2 stays manual.
 */
export const SHADCN = 'shadcn@4.23.0';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = join(webRoot, '../..');
const uiDir = join(webRoot, 'src/ui');

/** `import { cn } from "cn"` (either quote style) → `import { cn } from '#ui/cn'`. */
export function useOwnCn(source: string): string {
  return source.replace(/(\bfrom\s*)(["'])cn\2/g, "$1'#ui/cn'");
}

/** Removes the `cn` package from a package.json text; returns null when it is not listed. */
export function withoutCnPackage(manifestText: string): string | null {
  const manifest = JSON.parse(manifestText) as Record<string, Record<string, string> | undefined>;
  let found = false;
  for (const field of ['dependencies', 'devDependencies']) {
    const deps = manifest[field];
    if (deps && 'cn' in deps) {
      delete deps['cn'];
      found = true;
    }
  }
  return found ? `${JSON.stringify(manifest, null, 2)}\n` : null;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => join(dir, file));
}

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main(args: string[]): void {
  if (args.length === 0) {
    console.error('Usage: pnpm --filter @powr/web ui:add <component…> [shadcn add options]');
    process.exit(1);
  }
  run('pnpm', ['dlx', SHADCN, 'add', ...args], webRoot);

  const rewritten = sourceFiles(uiDir).filter((file) => {
    const source = readFileSync(file, 'utf8');
    const updated = useOwnCn(source);
    if (updated !== source) writeFileSync(file, updated);
    return updated !== source;
  });
  for (const file of rewritten)
    console.log(`ui:add: cn import → #ui/cn in ${relative(webRoot, file)}`);

  const manifestPath = join(webRoot, 'package.json');
  const manifest = withoutCnPackage(readFileSync(manifestPath, 'utf8'));
  if (manifest !== null) {
    writeFileSync(manifestPath, manifest);
    console.log('ui:add: removed the `cn` package; #ui/cn provides class merging');
    run('pnpm', ['install'], repoRoot);
  }

  run(join(repoRoot, 'node_modules/.bin/oxfmt'), [uiDir, manifestPath], repoRoot);
  console.log(
    'ui:add: now review the diff (technical concept §8.9.2): 48 px targets, the global focus outline instead of translucent rings, no new fonts or packages.',
  );
}

if (import.meta.main) main(process.argv.slice(2));
