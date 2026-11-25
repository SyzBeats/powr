import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { Button } from '#ui/button';

import { useAppUpdate } from '../../hooks/use-app';
import { useActiveSession } from '../../hooks/use-session';

/**
 * TD-14, §6.3 rule 2: before a workout starts, a waiting update is offered first, so the workout
 * runs on the new version instead of holding the update until it ends. Never while a workout is
 * active (the update gate never updates during one). "Start without updating" keeps the old
 * version for this page: neither Home nor the start screen asks again until the next load.
 */
export function useUpdateFirst(): {
  readonly show: boolean;
  readonly update: () => void;
  readonly defer: () => void;
} {
  const { updateAvailable, updateDeferred, applyUpdate, deferUpdate } = useAppUpdate();
  const session = useActiveSession();
  return {
    show: updateAvailable && !updateDeferred && session.loaded && session.value === undefined,
    update: applyUpdate,
    defer: deferUpdate,
  };
}

/**
 * The offer on the start screen (TD-14) and, since M6a, in Home's start card (TD-64), so the
 * one-tap start does not pass it by. `startWithout` replaces the "Start without updating" button
 * (Home passes the link that starts today's session); `onDecline` runs after that button.
 */
export function UpdateFirstOffer({
  level = 2,
  startWithout,
  onDecline,
}: {
  level?: 2 | 3;
  startWithout?: ReactNode;
  onDecline?: (() => void) | undefined;
}) {
  const offer = useUpdateFirst();
  if (!offer.show) return null;
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div
      data-testid="update-first"
      className="flex flex-col gap-3 rounded-2xl border-2 border-info bg-surface p-4"
    >
      <Heading className="text-lg font-semibold">
        <Trans>Update before you start?</Trans>
      </Heading>
      <p>
        <Trans>
          A new version of POWR is ready. Updating takes a few seconds and keeps your data. During a
          workout POWR never updates, so now is a good moment.
        </Trans>
      </p>
      <Button variant="primary" size="lg" onClick={offer.update}>
        <Trans>Update first</Trans>
      </Button>
      {startWithout ?? (
        <Button
          size="lg"
          onClick={() => {
            offer.defer();
            onDecline?.();
          }}
        >
          <Trans>Start without updating</Trans>
        </Button>
      )}
    </div>
  );
}
