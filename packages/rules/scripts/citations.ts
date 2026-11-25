import type { SourceDef } from '../src/sources';
import { SOURCES_DIR, loadSourceRegistry } from './sources';

/**
 * `@powr/rules/citations/node` (M5s, TD-33): the source registry's citations for the app's
 * "Why?" sheet and "How POWR decides" page, generated at build time from
 * `data/sources/*.yaml` (the app's Vite plugin serves them as a lazy chunk, so they never go
 * stale). Read-only over the registry: the data stays owned by the rules work.
 */

/** One source as the app shows it (LEG-05). */
export interface Citation {
  readonly id: string;
  /** "Zourdos et al.", when the citation starts with authors and a year. */
  readonly authors: string | null;
  readonly year: string | null;
  /** The rest of the citation: title or description, journal, volume and pages. */
  readonly details: string;
  /** The DOI without its prefix ("10.1519/JSC.0000000000001049"), when the citation names one. */
  readonly doi: string | null;
  readonly url: string | null;
  readonly seeAlso: readonly string[];
  /** The source's evidence tag (EB tags, §8.6.4). */
  readonly tag: SourceDef['tag'];
  /** Caveats the registry records. */
  readonly note: string | null;
}

/** The file the app imports: every active source, sorted by ID. */
export interface CitationsFile {
  readonly format: 'powr-citations';
  readonly citations: readonly Citation[];
}

const AUTHOR_YEAR = /^([^[\].]{2,160}?(?:\bet al\.)?)\s+(\d{4}[a-z]?)\.\s+(.*)$/s;
const DOI = /\bDOI:?\s*(10\.\d{4,9}\/\S+?)\.?(?=\s|$)/i;

const squash = (text: string) => text.replaceAll(/\s+/g, ' ').trim();

/** Splits a registry citation into authors, year, details and DOI (best effort, never lossy). */
export function parseCitation(
  text: string,
): Pick<Citation, 'authors' | 'year' | 'details' | 'doi'> {
  const citation = squash(text);
  const doi = DOI.exec(citation)?.[1] ?? null;
  const match = AUTHOR_YEAR.exec(citation);
  if (!match) return { authors: null, year: null, details: citation, doi };
  const [, authors = '', year = '', details = ''] = match;
  return { authors: authors.trim(), year, details: details.trim(), doi };
}

/** The citations of the active sources, sorted by ID (excluded works are never cited). */
export function compileCitations(sources: readonly SourceDef[]): CitationsFile {
  const citations = sources
    .filter((source) => source.status === 'active')
    .map((source): Citation => ({
      id: source.id,
      ...parseCitation(source.citation),
      url: source.url ?? null,
      seeAlso: source.seeAlso ?? [],
      tag: source.tag,
      note: source.note === undefined ? null : squash(source.note),
    }))
    .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { format: 'powr-citations', citations };
}

/** Loads and compiles the shipped registry; a registry with issues fails the build. */
export function loadCitations(dir: string = SOURCES_DIR): CitationsFile {
  const registry = loadSourceRegistry(dir);
  if (registry.issues.length > 0)
    throw new Error(`Source registry invalid:\n${registry.issues.join('\n')}`);
  return compileCitations([...registry.sources.values()]);
}

export { SOURCES_DIR };
