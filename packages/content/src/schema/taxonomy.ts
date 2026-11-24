import { BODY_AREAS, type MuscleGroupDef } from '../types';
import { z } from '../zod';
import { localizedText, muscleId, synonym } from './common';

/** `front.chest`, `back.side-delts`, `front.chest.clavicular`: view, then the muscle's path. */
const region = (view: 'front' | 'back') =>
  z
    .string()
    .regex(
      new RegExp(`^${view}\\.[a-z0-9]+(?:-[a-z0-9]+)*(?:\\.[a-z0-9]+(?:-[a-z0-9]+)*)?$`),
      `Body-map regions of the ${view} view look like ${view}.chest`,
    );

const bodyMap = z
  .strictObject({ front: region('front').exactOptional(), back: region('back').exactOptional() })
  .refine(
    (regions) => regions.front !== undefined || regions.back !== undefined,
    'A muscle is visible in at least one view',
  );

const muscleBase = {
  id: muscleId,
  name: localizedText(40),
  synonyms: z.array(synonym),
  bodyMap,
  ebHypertrophyData: z.boolean(),
};

/** One display group of data/muscles.yaml with its sub-regions (PRD §7.2). */
export const muscleGroupSchema = z.strictObject({
  ...muscleBase,
  area: z.enum(BODY_AREAS),
  optional: z.boolean(),
  subRegions: z.array(z.strictObject(muscleBase)),
}) satisfies z.ZodType<MuscleGroupDef>;
