import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';

import { Screen } from '#ui/screen';

export function NotFound() {
  const { t } = useLingui();
  return (
    <Screen title={t`Page not found`}>
      <p>
        <Trans>This page does not exist.</Trans>
      </p>
      <Link to="/" className="font-semibold text-primary underline">
        <Trans>Go to Home</Trans>
      </Link>
    </Screen>
  );
}
