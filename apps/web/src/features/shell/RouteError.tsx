import { Trans, useLingui } from '@lingui/react/macro';

import { buttonClass } from '#ui/button-class';
import { Screen } from '#ui/screen';

/**
 * Route error boundary (§8.16): the data is safe because every confirmed write is committed. On
 * the startup path (the root route), so a native button with the design system's classes, not
 * Base UI's (TD-63).
 */
export function RouteError() {
  const { t } = useLingui();
  return (
    <Screen title={t`Something went wrong`}>
      <p>
        <Trans>Your data is saved. Reload to continue.</Trans>
      </p>
      <button
        type="button"
        className={buttonClass({ variant: 'primary' })}
        onClick={() => location.reload()}
      >
        <Trans>Reload</Trans>
      </button>
    </Screen>
  );
}
