/**
 * Training goals. Each exercise has a default rep range per goal (PRD §7.1 "Defaults", PLN-07);
 * the style picks which goals a plan serves (ONB-03).
 */
export const GOALS = ['hypertrophy', 'strength'] as const;
export type Goal = (typeof GOALS)[number];

/**
 * The primary training style chosen in onboarding (ONB-03); it selects the template (PLN-02).
 * Bodybuilding trains for hypertrophy, powerlifting for strength, powerbuilding for both.
 */
export const TRAINING_STYLES = ['bodybuilding', 'powerlifting', 'powerbuilding'] as const;
export type TrainingStyle = (typeof TRAINING_STYLES)[number];
