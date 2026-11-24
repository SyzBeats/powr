/**
 * `@powr/rules/sources`: the source registry format and its validator. Build-time only, so it is a
 * separate entry and never part of the app bundle. Environment-free: `@powr/rules/sources/node`
 * reads the YAML files from disk.
 */
export { sourceIdSchema } from '../schema';
export {
  buildSourceRegistry,
  checkSourceRefs,
  type SourceFile,
  type SourceRef,
  type SourceRegistry,
} from './registry';
export { SOURCE_STATUSES, sourceDefSchema, type SourceDef, type SourceStatus } from './schema';
