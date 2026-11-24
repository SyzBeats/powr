import { useLingui } from '@lingui/react/macro';

import { ComingSoon } from './ComingSoon';

export function PlanScreen() {
  const { t } = useLingui();
  return <ComingSoon title={t`Plan`} />;
}

export function ExploreScreen() {
  const { t } = useLingui();
  return <ComingSoon title={t`Explore`} />;
}

export function ProgressScreen() {
  const { t } = useLingui();
  return <ComingSoon title={t`Progress`} />;
}
