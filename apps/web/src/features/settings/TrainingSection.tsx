import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';

import type { TrainingPreferences } from '@powr/application';

import { CheckRow } from '#ui/choice';
import { Segmented } from '#ui/segmented';

import { useSetWeekStart, useWeekStart } from '../../hooks/use-planning';
import { useSettingsUseCases, useTrainingPreferences } from '../../hooks/use-settings';
import { localeWeekStart } from '../../i18n/format';
import { useLabels } from '../labels';
import { SettingsSection, settingsLinkClass } from './parts';
import { TrainingAdvanced } from './TrainingAdvanced';

/**
 * SET-05 and SET-11 (M5s): effort shown and entered as RIR or RPE, the RIR entry style, warm-up
 * sets at the start of a workout, the advanced registry choices (progression, the e1RM formula,
 * the lighter-week interval), the first day of the week, and the per-exercise choices
 * (PRG-03 manual mode, TMR-01 auto-start) on their own screen.
 */
export function TrainingSection() {
  const { t } = useLingui();
  const labels = useLabels();
  const preferences = useTrainingPreferences();
  const run = useSettingsUseCases();
  const { stored } = useWeekStart();
  const setWeekStart = useSetWeekStart();
  const localeDay = labels.weekday(localeWeekStart());
  if (!preferences.loaded) return null;
  const save = (patch: Partial<TrainingPreferences>) =>
    void run((settings, deps) => settings.setTrainingPreferences(deps, patch));

  return (
    <SettingsSection id="training" title={t`Training`}>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>Show effort as</Trans>
        </span>
        <Segmented<TrainingPreferences['effortScale']>
          label={t`Show effort as`}
          value={preferences.effortScale}
          onChange={(effortScale) => save({ effortScale })}
          options={[
            { value: 'rir', label: t`Reps in reserve (RIR)` },
            { value: 'rpe', label: t`RPE (1–10)` },
          ]}
        />
        <p className="px-2 text-sm text-fg-muted">
          <Trans>
            The same scale both ways: RPE 8 means 2 reps in reserve. POWR keeps your entries either
            way.
          </Trans>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>Enter effort with</Trans>
        </span>
        <Segmented<TrainingPreferences['rirInput']>
          label={t`Enter effort with`}
          value={preferences.rirInput}
          onChange={(rirInput) => save({ rirInput })}
          options={[
            { value: 'chips', label: t`One tap per value` },
            { value: 'decimal', label: t`Half steps` },
          ]}
        />
        <p className="px-2 text-sm text-fg-muted">
          {preferences.rirInput === 'chips' ? (
            <Trans>Six buttons, one tap. Half steps stay possible in the set details.</Trans>
          ) : (
            <Trans>A stepper in half steps, for example 1.5 reps in reserve.</Trans>
          )}
        </p>
      </div>

      <CheckRow
        label={t`Warm-up sets at the start of a workout`}
        description={t`Lighter sets that ramp up to your first working weight, where POWR knows it.`}
        checked={preferences.warmups}
        onChange={(warmups) => save({ warmups })}
      />

      <TrainingAdvanced />

      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>First day of the week</Trans>
        </span>
        <Segmented<'locale' | '1' | '7' | '6'>
          label={t`First day of the week`}
          value={stored === null ? 'locale' : (String(stored) as '1' | '7' | '6')}
          onChange={(next) =>
            void setWeekStart(next === 'locale' ? null : (Number(next) as 1 | 6 | 7))
          }
          options={[
            { value: 'locale', label: t`Like this phone (${localeDay})` },
            { value: '1', label: labels.weekday(1) },
            { value: '7', label: labels.weekday(7) },
            { value: '6', label: labels.weekday(6) },
          ]}
        />
      </div>

      <div className="flex flex-col">
        <Link to="/settings/exercises" className={settingsLinkClass}>
          <Trans>Choices per exercise</Trans>
        </Link>
        <p className="text-sm text-fg-muted">
          <Trans>Keep an exercise as last time, or start its rest timer by hand.</Trans>
        </p>
      </div>
    </SettingsSection>
  );
}
