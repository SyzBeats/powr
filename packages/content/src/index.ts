import { createContentCatalog, type ContentCatalog } from './catalog';
import { STUB_EXERCISES } from './stub';

export { createContentCatalog, type ContentCatalog } from './catalog';
export { exerciseDefSchema, parseExerciseDef } from './schema';

export const CONTENT_VERSION = '0.0.0+m0';

let catalog: ContentCatalog | undefined;

/**
 * The built-in catalog shipped with this build. Built on first use, not at import time, so the
 * app can configure Zod (JIT-less, for the CSP) before anything is parsed.
 */
export function builtInContent(): ContentCatalog {
  catalog ??= createContentCatalog(CONTENT_VERSION, STUB_EXERCISES);
  return catalog;
}
