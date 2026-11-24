import { describe, expect, it } from 'vitest';

import { validateSessionSearch } from './search';

describe('validateSessionSearch', () => {
  it('accepts the manifest shortcut and no parameters', () => {
    expect(validateSessionSearch({ source: 'shortcut' })).toEqual({ source: 'shortcut' });
    expect(validateSessionSearch({})).toEqual({});
  });

  it('drops unknown parameters', () => {
    expect(validateSessionSearch({ utm: 'x', source: 'shortcut' })).toEqual({ source: 'shortcut' });
    expect(validateSessionSearch({ utm: 'x' })).toEqual({});
  });

  it('throws on an invalid source, so the router shows the error boundary', () => {
    for (const source of ['elsewhere', '', 1, null, ['shortcut'], { shortcut: true }]) {
      expect(() => validateSessionSearch({ source })).toThrow('Invalid search parameter source=');
    }
  });
});
