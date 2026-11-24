import { Trans, useLingui } from '@lingui/react/macro';

import { Button } from '#ui/button';
import { Screen } from '#ui/screen';

/** Route error boundary (§8.16): the data is safe because every confirmed write is committed. */
export function RouteError() {
  const { t } = useLingui();
  return (
    <Screen title={t`Something went wrong`}>
      <p>
        <Trans>Your data is saved. Reload to continue.</Trans>
      </p>
      <Button variant="primary" onClick={() => location.reload()}>
        <Trans>Reload</Trans>
      </Button>
    </Screen>
  );
}
