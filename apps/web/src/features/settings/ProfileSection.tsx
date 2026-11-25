import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';

import type { Profile } from '@powr/domain';

import { useActivePlan, useEquipmentProfiles, useProfile } from '../../hooks/use-planning';
import { formatLength, formatMinutes } from '../../i18n/format';
import { useLabels } from '../labels';
import { SettingsSection, settingsLinkClass } from './parts';
import { PROFILE_ANSWERS, type ProfileAnswer } from './profile-answers';

/**
 * SET-08 / SET-06 (M5s): the onboarding answers as stored, each with "Change", which edits that
 * one answer and re-plans only when the plan would change (with a preview). Equipment keeps its
 * own flow (EQP-05); "Set up a new plan" asks every question again.
 */
export function ProfileSection() {
  const { t } = useLingui();
  const labels = useLabels();
  const profile = useProfile();
  const plan = useActivePlan();
  const equipment = useEquipmentProfiles();
  const summary = useAnswerSummary();
  if (!profile.loaded || !plan.loaded || !equipment.loaded) return null;
  const me = profile.value;
  const active = plan.value ?? null;
  const gym =
    (active && equipment.value.find((entry) => entry.id === active.equipmentProfileId)) ??
    equipment.value.find((entry) => entry.isDefault);

  return (
    <SettingsSection id="profile" title={t`Profile and plan`}>
      {me ? (
        <ul className="flex flex-col divide-y divide-border">
          {PROFILE_ANSWERS.filter((answer) => answer !== 'schedule' || active !== null).map(
            (answer) => (
              <AnswerRow
                key={answer}
                answer={answer}
                value={summary(answer, me, active?.schedule ?? null)}
              />
            ),
          )}
          <li className="flex flex-wrap items-center justify-between gap-x-3 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">
                <Trans>Equipment</Trans>
              </span>
              <span className="text-sm text-fg-muted">{gym?.name ?? t`Not set`}</span>
            </span>
            <Link to="/settings/equipment" className={settingsLinkClass}>
              <Trans>Manage equipment</Trans>
            </Link>
          </li>
        </ul>
      ) : (
        <p className="text-fg-muted">
          <Trans>Answer a few questions to get your profile and a plan.</Trans>
        </p>
      )}
      {active ? (
        <p className="text-sm text-fg-muted">
          <Trans>Current plan: {labels.template(active.templateId)}.</Trans>
        </p>
      ) : null}
      <Link to="/plan/setup/$step" params={{ step: 'goal' }} className={settingsLinkClass}>
        {active ? <Trans>Set up a new plan</Trans> : <Trans>Set up a plan</Trans>}
      </Link>
    </SettingsSection>
  );
}

function AnswerRow({ answer, value }: { answer: ProfileAnswer; value: string }) {
  const { t } = useLingui();
  const title = useAnswerTitle()(answer);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-fg-muted" data-testid={`answer-${answer}`}>
          {value}
        </span>
      </span>
      <Link
        to="/settings/profile/$answer"
        params={{ answer }}
        aria-label={t`Change: ${title}`}
        className={settingsLinkClass}
      >
        <Trans>Change</Trans>
      </Link>
    </li>
  );
}

/** The name of each answer, as a row title and an editor heading. */
export function useAnswerTitle() {
  const { t } = useLingui();
  return (answer: ProfileAnswer): string => {
    switch (answer) {
      case 'goal':
        return t`Your goal`;
      case 'experience':
        return t`Your experience`;
      case 'schedule':
        return t`Your week`;
      case 'body':
        return t`About you`;
      case 'priorities':
        return t`Priorities`;
      case 'baselines':
        return t`Your current lifts`;
      default:
        return answer;
    }
  };
}

/** One answer in a line of words. */
function useAnswerSummary() {
  const { t } = useLingui();
  const labels = useLabels();
  return (
    answer: ProfileAnswer,
    profile: Profile,
    schedule: { weekdays: readonly number[]; sessionMinutes: number | null } | null,
  ): string => {
    switch (answer) {
      case 'goal': {
        const style = labels.style(profile.style);
        return profile.phase === 'notTracking'
          ? style
          : t`${style} · ${labels.phase(profile.phase)}`;
      }
      case 'experience':
        return labels.trainingAge(profile.experience.trainingAge);
      case 'schedule': {
        if (!schedule) return t`No plan yet`;
        const days = schedule.weekdays.map((day) => labels.weekday(day, true)).join(', ');
        const minutes =
          schedule.sessionMinutes === null ? t`90+ min` : formatMinutes(schedule.sessionMinutes);
        return t`${days} · ${minutes}`;
      }
      case 'body': {
        const parts = [
          profile.sex === 'female'
            ? t`Female`
            : profile.sex === 'male'
              ? t`Male`
              : t`Prefer not to say`,
          ...(profile.birthYear === null ? [] : [t`born ${profile.birthYear}`]),
          ...(profile.height === null
            ? []
            : [formatLength(profile.height.value, profile.height.unit)]),
        ];
        return parts.join(' · ');
      }
      case 'priorities': {
        const muscles = profile.priorities.map((id) => labels.muscle(id)).join(', ');
        const avoided = profile.avoid.exercises.length + profile.avoid.patterns.length;
        if (muscles === '' && avoided === 0) return t`None`;
        if (avoided === 0) return muscles;
        return muscles === '' ? t`${avoided} avoided` : t`${muscles} · ${avoided} avoided`;
      }
      case 'baselines': {
        const count = profile.baselines.length;
        return count === 0 ? t`None entered` : t`${count} entered`;
      }
      default:
        return '';
    }
  };
}
