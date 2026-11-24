/**
 * Advanced set techniques (WKT-04, technical concept §5.6 `TechniqueKind`). Supersets and
 * pre-exhaust are groupings, not techniques: their sets count normally.
 */
export const TECHNIQUE_KINDS = [
  'drop',
  'restPause',
  'myoReps',
  'cluster',
  'lengthenedPartials',
  'partialExtension',
] as const;
export type TechniqueKind = (typeof TECHNIQUE_KINDS)[number];

/**
 * A technique applied to one logged set. `units` counts what earns extra credit: drops of a drop
 * set, mini-sets of rest-pause or myo-reps, appended partial blocks (1). Clusters and standalone
 * lengthened partials earn none.
 */
export interface Technique {
  readonly kind: TechniqueKind;
  readonly units?: number;
}
