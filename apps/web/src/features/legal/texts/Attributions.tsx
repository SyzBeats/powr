import { Trans, useLingui } from '@lingui/react/macro';

import { Card } from '#ui/screen';

import type { AttributionEntry } from '../attributions-data';
import { Section } from './parts';

/**
 * "Open-source licences and attributions" (LEG-06, LEG-08): every component distributed with
 * this build, generated at build time from the licence inventory (`attributions.json`, written by
 * tools/licence and precached), with its licence, copyright lines, the full NOTICE text where the
 * licence requires it (Apache-2.0: ECharts) and the licence text; then POWR's own work (artwork,
 * content). Rendered as text, never as HTML.
 */
export function AttributionsText({ entries }: { entries: readonly AttributionEntry[] }) {
  const software = entries
    .filter((entry) => entry.kind === 'npm')
    .toSorted((a, b) => a.name.localeCompare(b.name));
  const own = entries
    .filter((entry) => entry.kind === 'asset')
    .toSorted((a, b) => a.name.localeCompare(b.name));
  const softwareCount = software.length;
  const ownCount = own.length;
  return (
    <>
      <Card>
        <p>
          <Trans>
            POWR is built with open-source software. This list is generated from the licence
            inventory when the app is built, so it always matches this version. It shows every
            component shipped with the app, its licence and copyright, and the notices its licence
            asks for.
          </Trans>
        </p>
      </Card>
      <Section id="software" title={<Trans>Open-source software ({softwareCount})</Trans>}>
        <ul className="flex flex-col gap-3" data-testid="attributions-software">
          {software.map((entry) => (
            <Entry key={`${entry.name}@${entry.version}`} entry={entry} />
          ))}
        </ul>
      </Section>
      <Section id="own-work" title={<Trans>POWR's own work ({ownCount})</Trans>}>
        <p>
          <Trans>
            The body-map figure, the app icons, the exercise library, the muscle names, the
            equipment lists and the plan templates were created for POWR.
          </Trans>
        </p>
        <ul className="flex flex-col gap-3" data-testid="attributions-own">
          {own.map((entry) => (
            <Entry key={entry.name} entry={entry} />
          ))}
        </ul>
      </Section>
    </>
  );
}

function Entry({ entry }: { entry: AttributionEntry }) {
  const { t } = useLingui();
  const licence = entry.licence === 'LicenseRef-Own-Work' ? t`Own work` : entry.licence;
  const { name, version } = entry;
  return (
    <li
      data-testid="attribution"
      data-name={entry.name}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border p-3"
    >
      <h3 className="font-semibold break-words">
        {entry.kind === 'npm' ? (
          <Trans>
            {name} version {version}
          </Trans>
        ) : (
          name
        )}
      </h3>
      <p>
        <Trans>Licence: {licence}</Trans>
      </p>
      {entry.copyright.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm break-words">
          {entry.copyright.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {entry.noticeText ? (
        <div className="flex flex-col gap-1">
          <h4 className="font-semibold">
            <Trans>NOTICE</Trans>
          </h4>
          <pre
            data-testid="notice-text"
            className="max-w-full overflow-x-auto rounded-lg bg-surface-raised p-2 font-mono text-sm break-words whitespace-pre-wrap"
          >
            {entry.noticeText}
          </pre>
        </div>
      ) : null}
      {entry.licenceText ? (
        <details>
          <summary className="min-h-target-min cursor-pointer font-semibold">
            <Trans>Licence text</Trans>
          </summary>
          <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-surface-raised p-2 font-mono text-sm break-words whitespace-pre-wrap">
            {entry.licenceText}
          </pre>
        </details>
      ) : null}
    </li>
  );
}
