import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

import { Button } from '#ui/button';

import { useAppUpdate } from '../../hooks/use-app';
import { useActiveSession } from '../../hooks/use-session';

/**
 * TD-14, §6.3 rule 2: before a workout starts, a waiting update is offered first, so the workout
 * runs on the new version instead of holding the update until it ends. Shown on the start
 * screen only, where no workout is active; "Start without updating" keeps the old version until
 * the next chance (the update gate never applies one during a workout).
 */
export function UpdateFirstOffer() {
  const { updateAvailable, applyUpdate } = useAppUpdate();
  const session = useActiveSession();
  const [declined, setDeclined] = useState(false);
  if (!updateAvailable || declined || !session.loaded || session.value !== undefined) return null;
  return (
    <div
      data-testid="update-first"
      className="flex flex-col gap-3 rounded-2xl border-2 border-info bg-surface p-4"
    >
      <h2 className="text-lg font-semibold">
        <Trans>Update before you start?</Trans>
      </h2>
      <p>
        <Trans>
          A new version of POWR is ready. Updating takes a few seconds and keeps your data. During a
          workout POWR never updates, so now is a good moment.
        </Trans>
      </p>
      <Button variant="primary" size="lg" onClick={applyUpdate}>
        <Trans>Update first</Trans>
      </Button>
      <Button size="lg" onClick={() => setDeclined(true)}>
        <Trans>Start without updating</Trans>
      </Button>
    </div>
  );
}
