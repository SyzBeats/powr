import { describe, expect, it } from 'vitest';

import { claimRuntimeFlag, getRuntimeValue, pruneFiredFlags, setRuntimeValue } from '.';

describe('powr-runtime fired flags (§8.8.4)', () => {
  it('lets exactly one path claim an alert key', async () => {
    expect(await claimRuntimeFlag('fired:t1@1000', { by: 'sw', at: 1000 })).toBe(true);
    expect(await claimRuntimeFlag('fired:t1@1000', { by: 'page', at: 1001 })).toBe(false);
    expect(await getRuntimeValue('fired:t1@1000')).toEqual({ by: 'sw', at: 1000 });
  });

  it('prunes old fired flags and leaves recent flags and other keys alone', async () => {
    const now = 10 * 86_400_000;
    await setRuntimeValue('activeSession', { id: 's1', build: 'b' });
    await claimRuntimeFlag('fired:old@1', { by: 'page', at: now - 2 * 86_400_000 });
    await claimRuntimeFlag('fired:new@2', { by: 'sw', at: now - 60_000 });
    expect(await pruneFiredFlags(86_400_000, now)).toBeGreaterThanOrEqual(1);
    expect(await getRuntimeValue('fired:old@1')).toBeUndefined();
    expect(await getRuntimeValue('fired:new@2')).toEqual({ by: 'sw', at: now - 60_000 });
    expect(await getRuntimeValue('activeSession')).toEqual({ id: 's1', build: 'b' });
  });
});
