import { Trans } from '@lingui/react/macro';

import { Screen } from '../../ui/screen';

/** Placeholder for tabs whose features arrive after the walking skeleton. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <Screen title={title}>
      <p className="text-fg-muted">
        <Trans>This part of POWR is not built yet.</Trans>
      </p>
    </Screen>
  );
}
