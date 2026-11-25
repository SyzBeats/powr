import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { History } from 'lucide-react';

import { buttonClass } from '#ui/button';
import { Screen } from '#ui/screen';

import { ComingSoon } from './ComingSoon';

export function ExploreScreen() {
  const { t } = useLingui();
  return <ComingSoon title={t`Explore`} />;
}

/** Analytics arrive in M4; until then Progress leads to the past sessions (WKT-15, M3b). */
export function ProgressScreen() {
  const { t } = useLingui();
  return (
    <Screen title={t`Progress`}>
      <p className="text-fg-muted">
        <Trans>This part of POWR is not built yet.</Trans>
      </p>
      <Link to="/session/past" className={buttonClass({ size: 'lg' })}>
        <History aria-hidden="true" className="size-5" />
        <Trans>Past sessions</Trans>
      </Link>
    </Screen>
  );
}
