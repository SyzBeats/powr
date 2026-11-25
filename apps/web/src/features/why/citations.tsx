import { Trans, useLingui } from '@lingui/react/macro';
import { ExternalLink } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import type CitationsModule from 'virtual:powr-citations';

/** One source of the registry with its full citation (TD-33, LEG-05). */
export type Citation = (typeof CitationsModule)['citations'][number];

/*
 * The source registry's citations are a lazy chunk generated at build time from
 * packages/rules/data/sources (scripts/citations-plugin.ts); the "Why?" sheet and "How POWR
 * decides" load it on first use. Until it is there, sources show by their short names.
 */
let byId: ReadonlyMap<string, Citation> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadCitations(): Promise<void> {
  loading ??= import('virtual:powr-citations').then(({ default: file }) => {
    byId = new Map(file.citations.map((citation) => [citation.id, citation]));
    for (const listener of listeners) listener();
  });
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The citations by source ID once loaded (starts loading on mount), else null. */
export function useCitations(): ReadonlyMap<string, Citation> | null {
  const loaded = useSyncExternalStore(subscribe, () => byId);
  useEffect(() => {
    void loadCitations();
  }, []);
  return loaded;
}

/**
 * A source's short name: "Zourdos et al. 2016" from its citation, else from its ID
 * ('src.iversen2021' → 'Iversen 2021', 'src.pmid34644424' → 'PubMed 34644424').
 */
export function useSourceName(citations: ReadonlyMap<string, Citation> | null) {
  const { t } = useLingui();
  return (id: string): string => {
    const citation = citations?.get(id);
    if (citation?.authors && citation.year) return `${citation.authors} ${citation.year}`;
    const body = id.replace(/^src\./, '');
    const [, pmid] = /^pmid(\d+)$/.exec(body) ?? [];
    if (pmid !== undefined) return t`PubMed ${pmid}`;
    if (body.startsWith('powr-')) {
      const topic = body.slice(5).replaceAll('-', ' ');
      return t`POWR ${topic}`;
    }
    const author = /^([a-z-]+?)(\d{4})([a-z]?)$/.exec(body);
    if (author) {
      const [, name = '', year = '', suffix = ''] = author;
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}${suffix}`;
    }
    return body;
  };
}

/** The host of a link, as its visible name ("pubmed.ncbi.nlm.nih.gov"). */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * A full citation: authors and year, the title or description with the journal, and links to
 * the DOI and the source. Links open in a new tab (said in the name); following one is the
 * user's choice, the app itself never requests them.
 */
export function CitationText({ citation }: { citation: Citation }) {
  const { authors, year, details, doi, url, note } = citation;
  const linkClass =
    'inline-flex min-h-target-min items-center gap-1 font-semibold break-all text-info underline underline-offset-4';
  return (
    <span className="flex flex-col gap-1">
      <span>
        {authors && year ? (
          <span className="font-semibold">
            <Trans>
              {authors} ({year}).
            </Trans>{' '}
          </span>
        ) : null}
        {details}
      </span>
      {note ? <span className="text-sm text-fg-muted">{note}</span> : null}
      <span className="flex flex-wrap gap-x-4">
        {doi ? (
          <a
            href={`https://doi.org/${doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <Trans>DOI {doi}</Trans>
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">
              <Trans>(opens in a new tab)</Trans>
            </span>
          </a>
        ) : null}
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <Trans>Source: {hostOf(url)}</Trans>
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">
              <Trans>(opens in a new tab)</Trans>
            </span>
          </a>
        ) : null}
      </span>
    </span>
  );
}
