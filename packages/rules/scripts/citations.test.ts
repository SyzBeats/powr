import { describe, expect, it } from 'vitest';

import compiled from '../generated/rules.json';
import { loadCitations, parseCitation } from './citations';
import { loadSourceRegistry } from './sources';

/*
 * TD-33 (M5s): the citations the app ships with the "Why?" sheet and "How POWR decides" come from
 * the source registry, complete, and every source a parameter cites has one.
 */
describe('citations generated from the source registry', () => {
  const file = loadCitations();
  const byId = new Map(file.citations.map((citation) => [citation.id, citation]));

  it('covers every active source and no excluded one', () => {
    const { sources } = loadSourceRegistry();
    const active = [...sources.values()].filter((source) => source.status === 'active');
    expect(file.citations.map((citation) => citation.id)).toEqual(
      active.map((source) => source.id).toSorted(),
    );
    const excluded = [...sources.values()].filter((source) => source.status === 'excluded');
    expect(excluded.length).toBeGreaterThan(0);
    expect(excluded.filter((source) => byId.has(source.id))).toEqual([]);
  });

  it('has a citation for every source a shipped parameter cites', () => {
    const cited = new Set(
      (compiled.params as readonly { sources: readonly string[] }[]).flatMap((row) => row.sources),
    );
    const missing = [...cited].filter((id) => !byId.has(id));
    expect(missing).toEqual([]);
  });

  it('keeps the whole citation: authors, year, details and DOI or URL', () => {
    expect(byId.get('src.zourdos2016')).toMatchObject({
      authors: 'Zourdos et al.',
      year: '2016',
      doi: '10.1519/JSC.0000000000001049',
      url: 'https://pubmed.ncbi.nlm.nih.gov/26049792/',
      tag: 'OBS',
    });
    expect(byId.get('src.zourdos2016')?.details).toContain('J Strength Cond Res 30(1):267–275');
    for (const citation of file.citations) {
      // Never lossy: what was not split off stays in the details, links stay as given.
      expect(citation.details.length).toBeGreaterThan(0);
      expect(citation.doi !== null || citation.url !== null || citation.details !== '').toBe(true);
      expect(citation.details).not.toMatch(/\s{2}/);
    }
  });

  it('splits authors and year only where the citation starts with them', () => {
    expect(
      parseCitation(
        'Nuzzo, Pinto, Nosaka & Steele 2024. [Maximal reps.] Sports Med 54:303–321. DOI 10.1007/s40279-023-01937-7.',
      ),
    ).toEqual({
      authors: 'Nuzzo, Pinto, Nosaka & Steele',
      year: '2024',
      details: '[Maximal reps.] Sports Med 54:303–321. DOI 10.1007/s40279-023-01937-7.',
      doi: '10.1007/s40279-023-01937-7',
    });
    expect(parseCitation('[A trial without authors.] PubMed 24265879.')).toEqual({
      authors: null,
      year: null,
      details: '[A trial without authors.] PubMed 24265879.',
      doi: null,
    });
    expect(parseCitation('POWR evidence base, "Session design" (reports/x.md).')).toMatchObject({
      authors: null,
      year: null,
    });
  });
});
