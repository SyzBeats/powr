import { create } from 'zustand';

import type { ReactiveDeloadCheck } from '@powr/application/planning';
import type { PlanId, PlannedSessionId, SessionId } from '@powr/domain';
import type { Guardrail, PrRecord, SessionProposal } from '@powr/domain/session';

/**
 * Ephemeral session UI state (§8.5 `sessionUi`): what the screens show around the persisted
 * session and must survive a route change, but never the session data itself (that is the live
 * view). Lost on reload by design: a resumed session shows its banner instead.
 */
export interface SessionUiState {
  /** WKT-14: the session found active at boot and resumed, with the stale prompt (> 6 h). */
  resumed: { readonly sessionId: SessionId; readonly stale: boolean } | null;
  /** The session this page started or resumed (no second RESUME). */
  runtimeFor: SessionId | null;
  /** TMR-04: the running timer ended while the page was hidden ("Rest over · +0:42"). */
  endedWhileHidden: boolean;
  /** MOT-02: the PRs of the last confirmed set, shown until dismissed or the next set. */
  celebration: readonly PrRecord[] | null;
  /** RDY-03 and PRG-13 proposals to offer before the first set (accepting sends APPLY_CHANGES). */
  proposals: {
    readonly sessionId: SessionId;
    readonly items: readonly SessionProposal[];
    readonly swapWith: PlannedSessionId | null;
  } | null;
  /** WCAG 2.4.3: the next set's dock takes focus after a confirm re-mounted it. */
  focusDock: boolean;
  /** WKT-16 hints of the last confirmed sets, until dismissed. */
  hints: readonly Guardrail[];
  /** PRG-12: the reactive-deload check after a finish, for the summary. */
  deloadCheck: {
    readonly sessionId: SessionId;
    readonly planId: PlanId;
    readonly check: ReactiveDeloadCheck;
  } | null;
}

export const useSessionUi = create<SessionUiState>(() => ({
  resumed: null,
  runtimeFor: null,
  endedWhileHidden: false,
  celebration: null,
  proposals: null,
  focusDock: false,
  hints: [],
  deloadCheck: null,
}));

/** Clears what belongs to one session (finish, discard, a new start). */
export function resetSessionUi(): void {
  useSessionUi.setState({
    resumed: null,
    endedWhileHidden: false,
    celebration: null,
    proposals: null,
    hints: [],
  });
}
