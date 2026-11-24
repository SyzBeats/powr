import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { isLocalDate, makeInstantTz, toIsoWithOffset, toLocalDate } from '../src';

const at = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds;

describe('time', () => {
  it('captures offset and zone for an instant', () => {
    // 2026-07-01T12:00:00Z is summer time in Zurich (+02:00)
    const instant = makeInstantTz(at('2026-07-01T12:00:00Z'), 'Europe/Zurich');
    expect(instant).toEqual({
      epochMs: at('2026-07-01T12:00:00Z'),
      offsetMin: 120,
      zone: 'Europe/Zurich',
    });
  });

  it('derives the local calendar day in the captured zone', () => {
    // 23:30 UTC on 23 Nov is already 24 Nov in Zurich (+01:00)
    const lateEvening = makeInstantTz(at('2026-11-23T23:30:00Z'), 'Europe/Zurich');
    expect(toLocalDate(lateEvening)).toBe('2026-11-24');
    const sameMomentInNewYork = makeInstantTz(at('2026-11-23T23:30:00Z'), 'America/New_York');
    expect(toLocalDate(sameMomentInNewYork)).toBe('2026-11-23');
  });

  it('handles the DST switch night', () => {
    // Zurich switches to summer time at 01:00 UTC on 29 Mar 2026
    expect(makeInstantTz(at('2026-03-29T00:59:00Z'), 'Europe/Zurich').offsetMin).toBe(60);
    expect(makeInstantTz(at('2026-03-29T01:00:00Z'), 'Europe/Zurich').offsetMin).toBe(120);
  });

  it('falls back to the stored offset for an unknown zone', () => {
    const instant = { epochMs: at('2026-11-23T23:30:00Z'), offsetMin: 60, zone: 'Mars/Olympus' };
    expect(toLocalDate(instant)).toBe('2026-11-24');
  });

  it('formats ISO 8601 with offset', () => {
    const instant = makeInstantTz(at('2026-11-23T17:04:11.123Z'), 'Europe/Zurich');
    expect(toIsoWithOffset(instant)).toBe('2026-11-23T18:04:11.123+01:00');
  });

  it('validates LocalDate strings', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-2-3')).toBe(false);
  });
});
