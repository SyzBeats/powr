import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import type { ThemePreference } from '@powr/formats';

import { Card, Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { isEnabled } from '../../feature-flags';
import { APP_INFO, useDebugMode } from '../../hooks/use-app';
import { useSetWeekStart, useWeekStart } from '../../hooks/use-planning';
import { useSetTheme, useThemePreference } from '../../hooks/use-settings';
import { localeWeekStart } from '../../i18n/format';
import { useLabels } from '../labels';
import { AlertsSection } from './AlertsSection';
import { InsightsSection } from './InsightsSection';
import { WorkoutSection } from './WorkoutSection';

const DebugTools = lazy(() => import('../debug/DebugTools'));

export function SettingsScreen() {
  const { t } = useLingui();
  const theme = useThemePreference();
  const setTheme = useSetTheme();
  const debug = useDebugMode();
  const labels = useLabels();
  const { stored } = useWeekStart();
  const setWeekStart = useSetWeekStart();
  const localeDay = labels.weekday(localeWeekStart());
  const linkClass = 'flex min-h-target items-center font-semibold text-primary underline-offset-4';

  return (
    <Screen title={t`Settings`}>
      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>Theme</Trans>
        </h2>
        <Segmented<ThemePreference>
          label={t`Theme`}
          value={theme}
          onChange={(next) => void setTheme(next)}
          options={[
            { value: 'system', label: t`System` },
            { value: 'light', label: t`Light` },
            { value: 'dark', label: t`Dark` },
          ]}
        />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>First day of the week</Trans>
        </h2>
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
      </Card>

      <WorkoutSection />

      {/* The timer kit is a lazy chunk (M3b): the section shows once it is loaded. */}
      <Suspense fallback={null}>
        <AlertsSection />
      </Suspense>

      <InsightsSection />

      <Card className="gap-1">
        <Link to="/settings/equipment" className={linkClass}>
          <Trans>Equipment</Trans>
        </Link>
        <Link to="/data" className={linkClass}>
          <Trans>Data and backups</Trans>
        </Link>
        <Link to="/legal/disclaimer" className={linkClass}>
          <Trans>Health and safety notice</Trans>
        </Link>
        <Link to="/legal/privacy" className={linkClass}>
          <Trans>Privacy notice</Trans>
        </Link>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>About</Trans>
        </h2>
        <p data-testid="app-version" className="text-sm text-fg-muted tabular">
          <Trans>
            Version {APP_INFO.version} ({APP_INFO.build})
          </Trans>
        </p>
      </Card>

      {isEnabled('debugTools') && debug ? (
        <Suspense fallback={null}>
          <DebugTools />
        </Suspense>
      ) : null}
    </Screen>
  );
}
