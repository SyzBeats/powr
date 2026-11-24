import type { ExerciseId } from '../ids';

/** Translation-ready content text (NFR-MNT-04). */
export interface LocalizedText {
  readonly en: string;
}

/**
 * Exercise definition. M0 carries the identifying subset only; the full shape
 * (muscles, equipment, defaults, cues) arrives with the content pipeline in M1.
 */
export interface ExerciseDef {
  readonly id: ExerciseId;
  readonly name: LocalizedText;
  readonly mechanics: 'compound' | 'isolation';
  readonly competitionLift?: 'squat' | 'bench' | 'deadlift';
  readonly status: 'active' | 'deprecated';
}
