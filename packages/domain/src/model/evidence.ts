/**
 * Evidence tags, exactly as defined in the evidence base ("How to read the evidence tags") and
 * technical concept §8.6.1. A rules parameter carries one or more; a registry source carries
 * exactly one, describing its design. The UI groups them into five labels (§8.6.4, LEG-05).
 */
export const EVIDENCE_TAGS = [
  'MA', // meta-analysis or meta-regression
  'SR', // systematic or scoping review
  'RCT-T', // randomized trial, trained participants
  'RCT-U', // randomized trial, untrained participants
  'RCT', // randomized trial, mixed participants
  'POS', // position stand or consensus
  'OBS', // observational, cross-sectional, competition-database or validation study
  'DELPHI/SURVEY', // expert Delphi consensus or practitioner/athlete survey
  'NARR', // narrative review
  'PREPRINT', // not peer-reviewed: verify before hard-coding
  'PRACT', // practitioner heuristic, textbook or coaching source
  'OFFICIAL', // federation document or reference source code
  'MODEL', // mathematical model or model validation
  'INF', // inference or derived design rule
] as const;
export type EvidenceTag = (typeof EVIDENCE_TAGS)[number];

/**
 * Support for one exercise-to-muscle credit (EXL-05, EB §Session › Mapping): H = longitudinal
 * hypertrophy data, EMG = muscle-activation data only, C = convention or biomechanics.
 * Ranked H > EMG > C for the MAP-03 effectiveness score.
 */
export const MAPPING_EVIDENCE = ['H', 'EMG', 'C'] as const;
export type MappingEvidence = (typeof MAPPING_EVIDENCE)[number];
