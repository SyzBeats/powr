import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import type { ThemePreference } from '@powr/formats';

import { Screen } from '#ui/screen';
import { Segmented } from '#ui/segmented';

import { isEnabled } from '../../feature-flags';
import { APP_INFO, useDebugMode } from '../../hooks/use-app';
import { useRegistryInfo, useSetTheme, useThemePreference } from '../../hooks/use-settings';
import { assertNever } from '../exhaustive';
import { LEGAL_DETAILS } from '../legal/publisher';
import { EmailLink } from '../legal/texts/parts';
import { AlertsSection } from './AlertsSection';
import { InsightsSection } from './InsightsSection';
import {
  SETTINGS_SECTIONS,
  SettingsSection,
  settingsLinkClass,
  type SettingsSectionId,
} from './parts';
import { ProfileSection } from './ProfileSection';
import { TrainingSection } from './TrainingSection';
import { UnitsSection } from './UnitsSection';
import { WorkoutSection } from './WorkoutSection';

const DebugTools = lazy(() => import('../debug/DebugTools'));

/**
 * Settings (SET-01…06, SET-08…11; M5s): one page in clear sections, in this order: profile and
 * plan, units, training, workout, alerts, insights, appearance, data, legal and about. An "On
 * this page" list jumps to each. Deeper editors are their own screens (one onboarding answer,
 * rest times, per-exercise choices, equipment, the legal pages).
 */
export function SettingsScreen() {
  const { t } = useLingui();
  const debug = useDebugMode();

  return (
    <Screen title={t`Settings`}>
      <OnThisPage />
      <ProfileSection />
      <UnitsSection />
      <TrainingSection />
      <WorkoutSection />
      {/* The timer kit is a lazy chunk (M3b): the section shows once it is loaded. */}
      <Suspense fallback={null}>
        <AlertsSection />
      </Suspense>
      <InsightsSection />
      <AppearanceSection />
      <DataSection />
      <LegalSection />
      <AboutSection />

      {isEnabled('debugTools') && debug ? (
        <Suspense fallback={null}>
          <DebugTools />
        </Suspense>
      ) : null}
    </Screen>
  );
}

/** A list of the sections with in-page links (WCAG 2.4.5, a second way through a long page). */
function OnThisPage() {
  const { t } = useLingui();
  const name = useSectionNames();
  return (
    <nav aria-label={t`Settings sections`}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {SETTINGS_SECTIONS.map((id) => (
          <li key={id}>
            <Link
              to="/settings"
              hash={id}
              className="inline-flex min-h-target-min items-center font-medium text-info underline underline-offset-4"
            >
              {name(id)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function useSectionNames() {
  const { t } = useLingui();
  return (id: SettingsSectionId): string => {
    switch (id) {
      case 'profile':
        return t`Profile and plan`;
      case 'units':
        return t`Units`;
      case 'training':
        return t`Training`;
      case 'workout':
        return t`Workout`;
      case 'alerts':
        return t`Alerts`;
      case 'insights':
        return t`Insights`;
      case 'appearance':
        return t`Appearance`;
      case 'data':
        return t`Data`;
      case 'legal':
        return t`Legal`;
      case 'about':
        return t`About`;
      default:
        return assertNever(id);
    }
  };
}

/** SET-01: light, dark or the phone's theme, applied without a reload. */
function AppearanceSection() {
  const { t } = useLingui();
  const theme = useThemePreference();
  const setTheme = useSetTheme();
  return (
    <SettingsSection id="appearance" title={t`Appearance`}>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="px-2 font-medium">
          <Trans>Theme</Trans>
        </span>
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
      </div>
    </SettingsSection>
  );
}

/** The data screen (backups, restore, storage) is its own page. */
function DataSection() {
  const { t } = useLingui();
  return (
    <SettingsSection id="data" title={t`Data`}>
      <Link to="/data" className={settingsLinkClass}>
        <Trans>Data and backups</Trans>
      </Link>
      <p className="text-sm text-fg-muted">
        <Trans>Your data stays on this phone. Back it up, restore it or delete it here.</Trans>
      </p>
    </SettingsSection>
  );
}

/** SET-09, LEG-01, LEG-02, LEG-05, LEG-06, LEG-09. */
function LegalSection() {
  const { t } = useLingui();
  const links = [
    { page: 'disclaimer', label: t`Health and safety notice` },
    { page: 'privacy', label: t`Privacy notice` },
    { page: 'imprint', label: t`Publisher and imprint` },
    { page: 'how-powr-decides', label: t`How POWR decides` },
    { page: 'attributions', label: t`Open-source licences and attributions` },
  ] as const;
  return (
    <SettingsSection id="legal" title={t`Legal`}>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.page}>
            <Link to="/legal/$page" params={{ page: link.page }} className={settingsLinkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

/** SET-09: version, registry and content versions, the publisher and how to reach them. */
function AboutSection() {
  const { t } = useLingui();
  const { rulesVersion, contentVersion } = useRegistryInfo();
  const { person, business, country } = LEGAL_DETAILS;
  return (
    <SettingsSection id="about" title={t`About`}>
      <ul className="flex flex-col gap-1 text-sm text-fg-muted tabular">
        <li data-testid="app-version">
          <Trans>
            Version {APP_INFO.version} ({APP_INFO.build})
          </Trans>
        </li>
        <li>
          <Trans>Rules registry {rulesVersion}</Trans>
        </li>
        <li>
          <Trans>Exercise library {contentVersion}</Trans>
        </li>
      </ul>
      <p>
        <Trans>
          Published by {person}, {business}, {country}.
        </Trans>
      </p>
      <p>
        <Trans>
          Questions or feedback: <EmailLink details={LEGAL_DETAILS} />
        </Trans>
      </p>
    </SettingsSection>
  );
}
