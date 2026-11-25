import { createFileRoute } from '@tanstack/react-router';

import { ProfileAnswerScreen } from '../../features/settings/ProfileAnswerScreen';

/** SET-08: one onboarding answer changed in Settings (goal, experience, schedule, …). */
export const Route = createFileRoute('/settings/profile/$answer')({
  component: ProfileAnswerRoute,
});

function ProfileAnswerRoute() {
  const { answer } = Route.useParams();
  return <ProfileAnswerScreen answer={answer} />;
}
