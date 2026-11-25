import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { messages as legalMessages } from '../../../../i18n/locales/en/legal.po';
import { messages as bootMessages } from '../../../../i18n/locales/en/messages.po';
import type { AttributionEntry } from '../../attributions-data';
import { DraftMarker } from '../../DraftMarker';
import { LEGAL_DETAILS } from '../../publisher';
import { LEGAL_VERSIONS } from '../../versions';
import { AttributionsText } from '../Attributions';
import { DisclaimerText } from '../Disclaimer';
import { ImprintText } from '../Imprint';
import { EmailLink } from '../parts';
import { PrivacyText } from '../Privacy';

/*
 * The static website copy of the legal texts (LEG-09, TD-71; M6c). Rendered once at build time by
 * `scripts/legal-static-plugin.ts` into `dist/legal-static/*.html`: the same React texts, the same
 * publisher details (`publisher.ts`, placeholders and draft marker included) and the same English
 * catalogs as the app's legal screens, so the website and the app cannot say different things.
 * Plain HTML: no script, no inline style, one same-origin stylesheet (the CSP allows nothing
 * else), readable without JavaScript.
 */

/** The pages of the website copy, in the order of their navigation. */
export const STATIC_LEGAL_PAGES = ['imprint', 'privacy', 'disclaimer', 'attributions'] as const;
export type StaticLegalPage = (typeof STATIC_LEGAL_PAGES)[number];

/** Where the pages are served; the app's routes stay at /legal/$page. */
const STATIC_LEGAL_BASE = '/legal-static/';

export interface StaticLegalInput {
  /** The build's `attributions.json` (written by tools/licence before this runs). */
  readonly attributions: readonly AttributionEntry[];
  /** The app version and build the copy was generated with (shown in the footer). */
  readonly app: { readonly version: string; readonly build: string };
}

/** File name (relative to `legal-static/`) → the complete HTML document. */
export function renderLegalPages(input: StaticLegalInput): Record<string, string> {
  const i18n = setupI18n({ locale: 'en', messages: { en: { ...bootMessages, ...legalMessages } } });
  const render = (node: ReactNode) =>
    // oxlint-disable-next-line lingui/no-unlocalized-strings -- the HTML doctype, not a message
    `<!doctype html>\n${renderToStaticMarkup(<I18nProvider i18n={i18n}>{node}</I18nProvider>)}\n`;
  return {
    'index.html': render(<IndexPage app={input.app} />),
    'imprint.html': render(
      <LegalPage page="imprint" app={input.app}>
        <ImprintText />
      </LegalPage>,
    ),
    'privacy.html': render(
      <LegalPage page="privacy" app={input.app} version={LEGAL_VERSIONS.privacyVersion}>
        <PrivacyText />
      </LegalPage>,
    ),
    'disclaimer.html': render(
      <LegalPage page="disclaimer" app={input.app} version={LEGAL_VERSIONS.disclaimerVersion}>
        <DisclaimerText />
      </LegalPage>,
    ),
    'attributions.html': render(
      <LegalPage page="attributions" app={input.app} draft={false}>
        <AttributionsText entries={input.attributions} />
      </LegalPage>,
    ),
  };
}

/** The page titles: the same words as the app's legal screens and Settings → Legal. */
function usePageTitles(): Record<StaticLegalPage, string> {
  const { t } = useLingui();
  return {
    imprint: t`Publisher and imprint`,
    privacy: t`Privacy notice`,
    disclaimer: t`Health and safety notice`,
    attributions: t`Open-source licences and attributions`,
  };
}

function LegalPage({
  page,
  app,
  version,
  draft = true,
  children,
}: {
  page: StaticLegalPage;
  app: StaticLegalInput['app'];
  version?: string;
  draft?: boolean;
  children: ReactNode;
}) {
  const { t } = useLingui();
  const title = usePageTitles()[page];
  return (
    <Document title={t`${title} · POWR`} current={page} app={app}>
      <h1>{title}</h1>
      {version ? (
        <p className="legal-version">
          <Trans>Version {version}</Trans>
        </p>
      ) : null}
      {draft ? <DraftMarker /> : null}
      {children}
    </Document>
  );
}

function IndexPage({ app }: { app: StaticLegalInput['app'] }) {
  const { t } = useLingui();
  const titles = usePageTitles();
  const { person, business, country } = LEGAL_DETAILS;
  return (
    <Document title={t`Legal texts · POWR`} current={null} app={app}>
      <h1>
        <Trans>Legal texts</Trans>
      </h1>
      <p>
        <Trans>
          Published by {person}, {business}, {country}.
        </Trans>
      </p>
      <p>
        <Trans>
          POWR is a training planner and log that runs in your browser and keeps your data on your
          device. These are the legal texts shown in the app, readable here without JavaScript.
        </Trans>
      </p>
      <ul className="legal-index">
        {STATIC_LEGAL_PAGES.map((page) => (
          <li key={page}>
            <a href={`${STATIC_LEGAL_BASE}${page}.html`}>{titles[page]}</a>
          </li>
        ))}
      </ul>
      <p>
        <Trans>
          Questions or feedback: <EmailLink details={LEGAL_DETAILS} />
        </Trans>
      </p>
    </Document>
  );
}

function Document({
  title,
  current,
  app,
  children,
}: {
  title: string;
  current: StaticLegalPage | null;
  app: StaticLegalInput['app'];
  children: ReactNode;
}) {
  const { t } = useLingui();
  const titles = usePageTitles();
  const { version, build } = app;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>{title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href={`${STATIC_LEGAL_BASE}legal.css`} />
      </head>
      <body>
        <a className="legal-skip" href="#main">
          <Trans>Skip to the text</Trans>
        </a>
        <header className="legal-header">
          <p className="legal-brand">
            <a href="/">
              <Trans>Open POWR</Trans>
            </a>
          </p>
          <nav aria-label={t`Legal texts`}>
            <ul>
              <li>
                <a
                  href={STATIC_LEGAL_BASE}
                  aria-current={current === null ? 'page' : undefined}
                >{t`Legal texts`}</a>
              </li>
              {STATIC_LEGAL_PAGES.map((page) => (
                <li key={page}>
                  <a
                    href={`${STATIC_LEGAL_BASE}${page}.html`}
                    aria-current={current === page ? 'page' : undefined}
                  >
                    {titles[page]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="main" className="legal-main">
          {children}
        </main>
        <footer className="legal-footer">
          <p>
            <Trans>
              A copy of the texts in the POWR app, made with version {version} ({build}) of the app.
              The app shows the same texts under Settings, Legal.
            </Trans>
          </p>
        </footer>
      </body>
    </html>
  );
}
