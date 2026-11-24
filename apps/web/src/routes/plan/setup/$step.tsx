import { createFileRoute } from '@tanstack/react-router';

import { OnboardingFlow } from '../../../features/onboarding/OnboardingFlow';

export const Route = createFileRoute('/plan/setup/$step')({ component: PlanSetupRoute });

function PlanSetupRoute() {
  const { step } = Route.useParams();
  return <OnboardingFlow mode="replan" step={step} />;
}
