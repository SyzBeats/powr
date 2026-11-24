// The build output of tools/content-build (`pnpm content:build`), committed so that every tool
// can import it; a test fails when it is stale. Validated at build time, hence the cast.
import compiled from '../generated/content.json';
import { createContentCatalog, type ContentCatalog } from './catalog';
import type { ContentBundle } from './types';

/**
 * `@powr/content/built-in`: the content shipped with this build. A separate entry because it
 * carries the data (about 17 kB gzip): the app loads it with `import()` in parallel with the
 * database, so neither the data nor any schema code sits in the entry chunk (§8.19, TD-17).
 */
export const BUILT_IN_CONTENT = compiled as unknown as ContentBundle;

let catalog: ContentCatalog | undefined;

export function builtInContent(): ContentCatalog {
  catalog ??= createContentCatalog(BUILT_IN_CONTENT);
  return catalog;
}
