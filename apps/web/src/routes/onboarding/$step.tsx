import { createFileRoute } from '@tanstack/react-router';

import { deferredSearch } from '../../app/route-search';
import { OnboardingFlow } from '../../features/onboarding/OnboardingFlow';
import { validateNextSearch, type NextSearch } from '../../features/search';

export const Route = createFileRoute('/onboarding/$step')({
  validateSearch: deferredSearch<NextSearch>(),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const { step } = Route.useParams();
  const { next } = validateNextSearch(Route.useSearch());
  return <OnboardingFlow mode="onboarding" step={step} next={next} />;
}
