import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import type { ThemePreference } from '@powr/formats';

import { isEnabled } from '../../feature-flags';
import { APP_INFO, useDebugMode } from '../../hooks/use-app';
import { useSetTheme, useThemePreference } from '../../hooks/use-settings';
import { Card, Screen } from '../../ui/screen';
import { Segmented } from '../../ui/segmented';

const DebugTools = lazy(() => import('../debug/DebugTools'));

export function SettingsScreen() {
  const { t } = useLingui();
  const theme = useThemePreference();
  const setTheme = useSetTheme();
  const debug = useDebugMode();

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
        <Link to="/data" className="flex min-h-target items-center font-semibold text-primary">
          <Trans>Data and backups</Trans>
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
