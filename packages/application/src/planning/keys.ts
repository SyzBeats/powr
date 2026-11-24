/**
 * `meta` keys of onboarding (§6.1). A module of its own, so the root entry's first-run check can
 * read them without pulling the planning use cases into the startup bundle (§8.19).
 */
export const ONBOARDING_DRAFT_KEY = 'onboardingDraft';
export const LEGAL_ACK_KEY = 'legalAck';
