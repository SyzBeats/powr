/** SET-08: the onboarding answers Settings can change one at a time (`/settings/profile/$answer`). */
export const PROFILE_ANSWERS = [
  'goal',
  'experience',
  'schedule',
  'body',
  'priorities',
  'baselines',
] as const;
export type ProfileAnswer = (typeof PROFILE_ANSWERS)[number];

export function isProfileAnswer(value: string): value is ProfileAnswer {
  return (PROFILE_ANSWERS as readonly string[]).includes(value);
}
