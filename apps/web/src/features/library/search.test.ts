import { describe, expect, it } from 'vitest';

import { validateLibrarySearch } from './search';

describe('library search params (EXL-02, TD-56)', () => {
  it('keeps several values per dimension, in order, without duplicates', () => {
    expect(
      validateLibrarySearch({
        muscle: ['mu.elbow-flexors', 'mu.triceps', 'mu.elbow-flexors'],
        equipment: ['eq.barbell'],
        pattern: ['horizontalPush', 'verticalPush'],
        mechanics: ['isolation', 'compound'],
        available: 'true',
      }),
    ).toEqual({
      muscle: ['mu.elbow-flexors', 'mu.triceps'],
      equipment: ['eq.barbell'],
      pattern: ['horizontalPush', 'verticalPush'],
      mechanics: ['isolation', 'compound'],
      available: true,
    });
  });

  it('still reads an old single-value link', () => {
    expect(validateLibrarySearch({ muscle: 'mu.chest', mechanics: 'compound' })).toEqual({
      muscle: ['mu.chest'],
      mechanics: ['compound'],
    });
  });

  it('drops invalid values and empty lists, and caps a list', () => {
    expect(
      validateLibrarySearch({
        muscle: ['mu chest', 42, null, '<script>'],
        equipment: [],
        mechanics: ['both', 'compound'],
        pattern: { nested: true },
        q: '',
        hidden: 'no',
      }),
    ).toEqual({ mechanics: ['compound'] });
    const many = Array.from({ length: 100 }, (_, index) => `eq.item-${index}`);
    expect(validateLibrarySearch({ equipment: many }).equipment).toHaveLength(64);
  });
});
