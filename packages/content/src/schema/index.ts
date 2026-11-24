/**
 * `@powr/content/schema`: Zod schemas of the YAML sources in packages/content/data. Build time
 * and tests only (tools/content-build); the app never imports this entry, so Zod stays out of
 * its startup path (TD-17). Each schema `satisfies` the matching runtime type.
 */
export { exerciseDefSchema } from './exercise';
export { equipmentDefSchema, equipmentPresetDefSchema } from './equipment';
export { muscleGroupSchema } from './taxonomy';
export { templateDefSchema } from './template';
