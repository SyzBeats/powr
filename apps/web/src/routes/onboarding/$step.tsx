import { createFileRoute } from '@tanstack/react-router';

import { OnboardingFlow } from '../../features/onboarding/OnboardingFlow';
import { validateNextSearch } from '../../features/search';

export const Route = createFileRoute('/onboarding/$step')({
  validateSearch: validateNextSearch,
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const { step } = Route.useParams();
  const { next } = Route.useSearch();
  return <OnboardingFlow mode="onboarding" step={step} next={next} />;
}
