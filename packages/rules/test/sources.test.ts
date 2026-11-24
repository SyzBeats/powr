import { describe, expect, it } from 'vitest';

import type { SourceId } from '@powr/domain';

import { buildSourceRegistry, checkSourceRefs } from '../src/sources';

const kubo = {
  id: 'src.kubo2019',
  citation: 'Kubo, Ikebukuro & Yata 2019. Effects of squat training with different depths.',
  url: 'https://link.springer.com/doi/10.1007/s00421-019-04181-y',
  tag: 'RCT-U',
  status: 'active',
};
const barbalho = {
  id: 'src.barbalho2020a',
  citation: 'Barbalho et al. 2020. IJSPP.',
  url: 'https://pubmed.ncbi.nlm.nih.gov/32804467/',
  tag: 'RCT',
  status: 'excluded',
  reason: 'Retracted.',
};

describe('source registry', () => {
  it('merges valid files into one registry', () => {
    const { sources, issues } = buildSourceRegistry([
      { file: 'exercise-mapping.yaml', data: [kubo] },
      { file: 'excluded.yaml', data: [barbalho] },
    ]);
    expect(issues).toEqual([]);
    expect([...sources.keys()]).toEqual(['src.kubo2019', 'src.barbalho2020a']);
    expect(sources.get('src.barbalho2020a' as SourceId)?.status).toBe('excluded');
  });

  it('reports a duplicate ID across files and keeps the first definition', () => {
    const { sources, issues } = buildSourceRegistry([
      { file: 'exercise-mapping.yaml', data: [kubo] },
      { file: 'volume.yaml', data: [{ ...kubo, tag: 'MA' }] },
    ]);
    expect(issues).toEqual([
      'volume.yaml entry 1 (src.kubo2019): duplicate ID, already defined in exercise-mapping.yaml',
    ]);
    expect(sources.get('src.kubo2019' as SourceId)?.tag).toBe('RCT-U');
  });

  it('requires a reason on excluded entries, and only there', () => {
    const { reason: _, ...withoutReason } = barbalho;
    const { issues } = buildSourceRegistry([
      { file: 'excluded.yaml', data: [withoutReason, { ...kubo, reason: 'Fine.' }] },
    ]);
    expect(issues).toEqual([
      'excluded.yaml entry 1 (src.barbalho2020a): reason: An excluded source needs a reason',
      'excluded.yaml entry 2 (src.kubo2019): reason: Only excluded sources carry a reason; use note for caveats',
    ]);
  });

  it('rejects unknown tags, malformed IDs, missing fields and unknown keys', () => {
    const { citation: _, ...withoutCitation } = kubo;
    const { sources, issues } = buildSourceRegistry([
      {
        file: 'content-extra.yaml',
        data: [
          { ...kubo, tag: 'EMG' },
          { ...kubo, id: 'kubo-2019' },
          withoutCitation,
          { ...kubo, doi: '10.1007/s00421-019-04181-y' },
          { ...kubo, url: 'ftp://example.org/paper.pdf' },
        ],
      },
    ]);
    expect(sources.size).toBe(0);
    expect(issues).toHaveLength(5);
    expect(issues[0]).toMatch(/^content-extra\.yaml entry 1 \(src\.kubo2019\): tag: /);
    expect(issues[1]).toMatch(/entry 2 \(kubo-2019\): id: Source IDs look like src\.kubo2019/);
    expect(issues[2]).toMatch(/entry 3 \(src\.kubo2019\): citation: /);
    expect(issues[3]).toMatch(/entry 4 \(src\.kubo2019\): .*doi/);
    expect(issues[4]).toMatch(/entry 5 \(src\.kubo2019\): url: /);
  });

  it('rejects a file that is not a list', () => {
    const { issues } = buildSourceRegistry([{ file: 'load.yaml', data: { sources: [kubo] } }]);
    expect(issues).toEqual(['load.yaml: expected a list of sources']);
  });

  it('flags citations of unknown or excluded sources', () => {
    const { sources } = buildSourceRegistry([{ file: 'all.yaml', data: [kubo, barbalho] }]);
    expect(
      checkSourceRefs(sources, [
        { sourceId: 'src.kubo2019', usedBy: 'ex.barbell-back-squat mu.hamstrings' },
        { sourceId: 'src.barbalho2020a', usedBy: 'volume.yaml volume.hypertrophy.band' },
        { sourceId: 'src.nobody2030', usedBy: 'ex.x mu.y' },
      ]),
    ).toEqual([
      'volume.yaml volume.hypertrophy.band: cites excluded source src.barbalho2020a (Retracted.)',
      'ex.x mu.y: unknown source src.nobody2030',
    ]);
  });
});
