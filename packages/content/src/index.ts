/**
 * `@powr/content`: the content types and the catalog over a compiled bundle. Free of Zod and of
 * the data itself, so the app may import it anywhere. The shipped data is the separate entry
 * `@powr/content/built-in` (loaded lazily); the Zod schemas of the YAML sources are
 * `@powr/content/schema` (build time and tests only).
 */
export {
  createContentCatalog,
  type ContentCatalog,
  type EquipmentCatalog,
  type MuscleTaxonomy,
} from './catalog';
export * from './types';
