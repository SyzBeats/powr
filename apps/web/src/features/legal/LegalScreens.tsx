import { Trans, useLingui } from '@lingui/react/macro';
import { Suspense, use, useEffect, useState, type ReactNode } from 'react';

import { Callout } from '#ui/badge';
import { Screen } from '#ui/screen';

import { useRegistryInfo } from '../../hooks/use-settings';
import { loadCatalog } from '../../i18n';
import { NotFound } from '../shell/NotFound';
import { fetchAttributions, type AttributionEntry } from './attributions-data';
import { DraftMarker } from './DraftMarker';
import { AttributionsText } from './texts/Attributions';
import { DisclaimerText } from './texts/Disclaimer';
import { HowPowrDecidesText } from './texts/HowPowrDecides';
import { ImprintText } from './texts/Imprint';
import { PrivacyText } from './texts/Privacy';
import { LEGAL_VERSIONS } from './versions';

/*
 * The legal and trust screens at /legal/$page (LEG-01, LEG-02, LEG-05, LEG-06, LEG-09; SET-09):
 * available before onboarding completes (the first-run guard keeps /legal open), offline, and
 * from Settings. Titles and the draft marker are in the boot catalog; the long texts are the lazy
 * `legal` catalog, loaded when a page opens. Drafts for the legal review (V-05, V-06).
 */
export const LEGAL_PAGES = [
  'disclaimer',
  'privacy',
  'imprint',
  'how-powr-decides',
  'attributions',
] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

function isLegalPage(value: string): value is LegalPage {
  return (LEGAL_PAGES as readonly string[]).includes(value);
}

export function LegalPageScreen({ page }: { page: string }) {
  if (!isLegalPage(page)) return <NotFound />;
  switch (page) {
    case 'disclaimer':
      return <DisclaimerScreen />;
    case 'privacy':
      return <PrivacyScreen />;
    case 'imprint':
      return <ImprintScreen />;
    case 'how-powr-decides':
      return <HowPowrDecidesScreen />;
    case 'attributions':
      return <AttributionsScreen />;
    default:
      return <NotFound />;
  }
}

/** Renders its children once the lazy `legal` catalog is loaded (suspends until then). */
function LegalCatalog({ children }: { children: ReactNode }) {
  use(loadCatalog('legal'));
  return <>{children}</>;
}

function Loading() {
  return (
    <p className="text-fg-muted">
      <Trans>Loading…</Trans>
    </p>
  );
}

function LegalScreen({
  title,
  version,
  children,
}: {
  title: string;
  version?: string;
  children: ReactNode;
}) {
  return (
    <Screen title={title}>
      {version ? (
        <p className="text-sm text-fg-muted" data-testid="legal-version">
          <Trans>Version {version}</Trans>
        </p>
      ) : null}
      <DraftMarker />
      <Suspense fallback={<Loading />}>
        <LegalCatalog>{children}</LegalCatalog>
      </Suspense>
    </Screen>
  );
}

/** LEG-01, PRD §8.1. */
function DisclaimerScreen() {
  const { t } = useLingui();
  return (
    <LegalScreen title={t`Health and safety notice`} version={LEGAL_VERSIONS.disclaimerVersion}>
      <DisclaimerText />
    </LegalScreen>
  );
}

/** LEG-02, PRD §8.2. */
function PrivacyScreen() {
  const { t } = useLingui();
  return (
    <LegalScreen title={t`Privacy notice`} version={LEGAL_VERSIONS.privacyVersion}>
      <PrivacyText />
    </LegalScreen>
  );
}

/** LEG-09, PRD §8.6. */
function ImprintScreen() {
  const { t } = useLingui();
  return (
    <LegalScreen title={t`Publisher and imprint`}>
      <ImprintText />
    </LegalScreen>
  );
}

/** LEG-05, PRG-09: generated from the shipped registry (the resolver is a lazy chunk). */
function HowPowrDecidesScreen() {
  const { t } = useLingui();
  const registry = useRegistryInfo();
  const [parameters] = useState(() => registry.parameters());
  return (
    <Screen title={t`How POWR decides`}>
      <Suspense fallback={<Loading />}>
        <LegalCatalog>
          <HowPowrDecidesText parameters={parameters} />
        </LegalCatalog>
      </Suspense>
    </Screen>
  );
}

/** LEG-06: from the build's `attributions.json` (precached; offline). */
function AttributionsScreen() {
  const { t } = useLingui();
  const [state, setState] = useState<
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready'; readonly entries: readonly AttributionEntry[] }
    | { readonly kind: 'missing' }
  >({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetchAttributions().then(
      (entries) => {
        if (!cancelled) setState({ kind: 'ready', entries });
      },
      () => {
        if (!cancelled) setState({ kind: 'missing' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Screen title={t`Open-source licences and attributions`}>
      {state.kind === 'loading' ? (
        <Loading />
      ) : state.kind === 'missing' ? (
        <Callout tone="warning" title={t`The list is not available`}>
          <p>
            <Trans>
              The list of licences is created when the app is built, and this copy of the app does
              not include it. Reload the app; if that does not help, update it.
            </Trans>
          </p>
        </Callout>
      ) : (
        <Suspense fallback={<Loading />}>
          <LegalCatalog>
            <AttributionsText entries={state.entries} />
          </LegalCatalog>
        </Suspense>
      )}
    </Screen>
  );
}
