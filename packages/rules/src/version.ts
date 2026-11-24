import type { CompiledRules } from './compile';

/** Registry SemVer; the compiled `rules.json` adds its content hash (§7.8). */
export const RULES_VERSION = '1.3.0';

/** `version+hash12`, the string stored in `VersionStamp.rules`. */
export function rulesStamp(compiled: Pick<CompiledRules, 'version' | 'hash'>): string {
  return `${compiled.version}+${compiled.hash.slice(0, 12)}`;
}
