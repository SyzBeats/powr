import { describe, expect, it } from 'vitest';

import { uuidv7 } from './ids';

describe('uuidv7', () => {
  it('encodes the timestamp, version and variant (RFC 9562)', () => {
    const id = uuidv7(0x0190_a6f2_1234, new Uint8Array(10).fill(0xff));
    expect(id).toBe('0190a6f2-1234-7fff-bfff-ffffffffffff');
  });

  it('sorts by creation time', () => {
    const random = new Uint8Array(10);
    const ids = [3, 1, 2].map((ms) => uuidv7(1_795_000_000_000 + ms, random));
    expect(ids.toSorted()).toEqual([1, 2, 3].map((ms) => uuidv7(1_795_000_000_000 + ms, random)));
  });

  it('produces unique random ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });
});
