import { redirect } from '@tanstack/react-router';

import { firstRunState } from '@powr/application';

import { LEGAL_VERSIONS } from '../features/legal/versions';
import type { Container } from './container';

/**
 * Screens a first-run user may open: onboarding, the full legal texts it links to, settings
 * (theme), data (restore a backup on a new phone) and the developer harness. Everything else,
 * training screens in particular, waits for the legal acknowledgement and a profile (ONB-01).
 */
const OPEN = [
  /^\/onboarding(\/|$)/,
  /^\/legal(\/|$)/,
  /^\/settings\/?$/,
  /^\/data$/,
  /^\/debug(\/|$)/,
];

/** The route guard (root `beforeLoad`): sends first-run users to onboarding. */
export async function guardFirstRun(container: Container, pathname: string): Promise<void> {
  if (OPEN.some((pattern) => pattern.test(pathname))) return;
  const state = await firstRunState(container.deps, LEGAL_VERSIONS);
  if (state === 'ready') return;
  throw redirect({
    to: '/onboarding/$step',
    params: { step: state === 'legal' ? 'welcome' : 'resume' },
    search: { next: pathname },
    replace: true,
  });
}
