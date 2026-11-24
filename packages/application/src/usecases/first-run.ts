import type { IsoWeekday } from '@powr/domain';

import type { Deps } from '../deps';
import { LEGAL_ACK_KEY } from '../planning/keys';

/** The versions of the health disclaimer and the privacy notice the user must acknowledge. */
export interface LegalVersions {
  readonly disclaimerVersion: string;
  readonly privacyVersion: string;
}

/**
 * Where a launch stands (ONB-01, ONB-12): `legal` until the current disclaimer and privacy
 * versions are acknowledged (nothing else is stored before that), `onboarding` until a profile
 * exists (the plan is optional: "Just let me log" creates the profile only), else `ready`. Part of
 * the root entry, because the app's route guard runs it before any screen loads; the onboarding
 * use cases themselves stay in the lazy `@powr/application/planning` entry.
 */
export async function firstRunState(
  deps: Deps,
  current: LegalVersions,
): Promise<'legal' | 'onboarding' | 'ready'> {
  const { ack, profile } = await deps.uow.read(['meta', 'profile'], async (repos) => ({
    ack: await repos.meta.get(LEGAL_ACK_KEY),
    profile: await repos.profile.get(),
  }));
  const value = ack?.value as Partial<LegalVersions> | null | undefined;
  const acknowledged =
    value?.disclaimerVersion === current.disclaimerVersion &&
    value.privacyVersion === current.privacyVersion;
  if (!acknowledged) return 'legal';
  return profile ? 'ready' : 'onboarding';
}

/** SET-11: the user's week start; `null` follows the device locale again. */
export async function setWeekStart(deps: Deps, weekStart: IsoWeekday | null): Promise<void> {
  await deps.uow.write(['settings'], async (repos) => {
    const current = await repos.settings.get();
    const next = { ...current, id: 'me' as const, theme: current?.theme ?? 'system' };
    if (weekStart === null) delete next.weekStart;
    else next.weekStart = weekStart;
    await repos.settings.put(next);
  });
}
