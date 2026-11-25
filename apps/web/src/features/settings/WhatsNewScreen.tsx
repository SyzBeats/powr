import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useId, useState } from 'react';

import { Badge, Callout } from '#ui/badge';
import { Button } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { APP_INFO, useAppUpdate } from '../../hooks/use-app';
import { formatLocalDateWithYear } from '../../i18n/format';
import { compareVersions, fetchChangelog, type ChangelogRelease } from './changelog-data';

/**
 * Settings → About → "What's new" (SET-09, NFR-MNT-07, TD-20; M6c): the release notes of every
 * version, newest first, from `changelog.json`. The update notice links here. Online, the list
 * also has the notes of a waiting update (newer than the running version); offline it shows the
 * precached notes of the installed version.
 */
export function WhatsNewScreen() {
  const { t } = useLingui();
  // "Try again" mounts a fresh list, which loads once.
  const [attempt, setAttempt] = useState(0);
  return (
    <Screen title={t`What's new`}>
      <p className="text-fg-muted">
        <Trans>You are using version {APP_INFO.version}.</Trans>
      </p>
      <ReleaseList key={attempt} onRetry={() => setAttempt((value) => value + 1)} />
    </Screen>
  );
}

function ReleaseList({ onRetry }: { onRetry: () => void }) {
  const { t } = useLingui();
  const { updateAvailable } = useAppUpdate();
  const [state, setState] = useState<
    | { readonly kind: 'loading' }
    | { readonly kind: 'ready'; readonly releases: readonly ChangelogRelease[] }
    | { readonly kind: 'failed' }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchChangelog().then(
      (releases) => {
        if (!cancelled) setState({ kind: 'ready', releases });
      },
      () => {
        if (!cancelled) setState({ kind: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading')
    return (
      <p className="text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  if (state.kind === 'failed')
    return (
      <Callout tone="warning" title={t`The release notes could not be loaded`}>
        <p>
          <Trans>Check your connection, then try again.</Trans>
        </p>
        <Button onClick={onRetry}>
          <Trans>Try again</Trans>
        </Button>
      </Callout>
    );
  if (state.releases.length === 0)
    return (
      <p>
        <Trans>No release notes yet.</Trans>
      </p>
    );
  return (
    <ol className="flex flex-col gap-4">
      {state.releases.map((release) => (
        <li key={release.version}>
          <ReleaseCard release={release} updateAvailable={updateAvailable} />
        </li>
      ))}
    </ol>
  );
}

function ReleaseCard({
  release,
  updateAvailable,
}: {
  release: ChangelogRelease;
  updateAvailable: boolean;
}) {
  const { t } = useLingui();
  const sectionTitle = useSectionTitle();
  const headingId = useId();
  const order = compareVersions(release.version, APP_INFO.version);
  const { version } = release;
  return (
    <Card>
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-2"
        data-testid="release"
        data-version={version}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={headingId} className="text-lg font-bold">
            <Trans>Version {version}</Trans>
          </h2>
          {order === 0 ? (
            <Badge tone="ok">{t`This version`}</Badge>
          ) : order > 0 ? (
            <Badge tone="info">{updateAvailable ? t`In the waiting update` : t`Newer`}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-fg-muted">
          <time dateTime={release.date}>{formatLocalDateWithYear(release.date)}</time>
        </p>
        <p>{release.summary}</p>
        {release.sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <h3 className="font-semibold">{sectionTitle(section.title)}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </Card>
  );
}

/** The fixed section titles of tools/release-notes, in the catalog; anything else as it is. */
function useSectionTitle() {
  const { t } = useLingui();
  return (title: string): string => {
    switch (title) {
      case 'New':
        return t`New`;
      case 'Improved':
        return t`Improved`;
      case 'Changed':
        return t`Changed`;
      case 'Fixed':
        return t`Fixed`;
      case 'Removed':
        return t`Removed`;
      case 'Known limitations':
        return t`Known limitations`;
      default:
        return title;
    }
  };
}
