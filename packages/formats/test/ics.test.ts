import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { instantAt, type LocalDate } from '@powr/domain';

import {
  ICS_MIME,
  encodeIcs,
  escapeIcsText,
  foldIcsLine,
  icsUid,
  type IcsCalendar,
  type IcsEvent,
  type IcsStart,
} from '../src/ics';

// A small RFC 5545 reader for the tests (no dependency): unfold, then split each content line
// into name, parameters and value.

interface ContentLine {
  readonly name: string;
  readonly params: readonly string[];
  readonly value: string;
}

const encoder = new TextEncoder();
const octets = (text: string) => encoder.encode(text).length;

/** Physical lines: the text must end with CRLF and contain no bare CR or LF. */
function physicalLines(text: string): string[] {
  expect(text.endsWith('\r\n')).toBe(true);
  const lines = text.slice(0, -2).split('\r\n');
  for (const line of lines) expect(line).not.toMatch(/[\r\n]/u);
  return lines;
}

/** RFC 5545 §3.1: a line starting with a space or tab continues the previous one. */
function unfold(text: string): string[] {
  const logical: string[] = [];
  for (const line of physicalLines(text)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && logical.length > 0) {
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  return logical;
}

function parseLine(line: string): ContentLine {
  const colon = line.indexOf(':');
  expect(colon).toBeGreaterThan(0);
  const [name = '', ...params] = line.slice(0, colon).split(';');
  return { name, params, value: line.slice(colon + 1) };
}

const parse = (text: string) => unfold(text).map(parseLine);

/** RFC 5545 §3.3.11, the inverse of the escaping. */
function unescapeText(value: string): string {
  return value.replaceAll(/\\([\\;,nN])/gu, (_, char: string) =>
    char === 'n' || char === 'N' ? '\n' : char,
  );
}

/** The value of the n-th property called `name` (0-based). */
function valueOf(lines: readonly ContentLine[], name: string, nth = 0): string | undefined {
  return lines.filter((line) => line.name === name)[nth]?.value;
}

const HOST = 'powr.invalid';
const STAMP = Date.UTC(2026, 10, 23, 18, 4, 11, 123);

function calendarOf(events: readonly IcsEvent[], extra: Partial<IcsCalendar> = {}): IcsCalendar {
  return {
    prodId: '-//SZ WEB DEVELOPMENT//POWR 0.0.0//EN',
    dtStampEpochMs: STAMP,
    events,
    ...extra,
  };
}

function timed(epochMs: number, durationMinutes = 60): IcsStart {
  return { kind: 'dateTime', epochMs, durationMinutes };
}

/** A timed start at a wall-clock time in Zurich (CET/CEST). */
const zurichAt = (date: string, time: string) =>
  timed(instantAt(date as LocalDate, time, 'Europe/Zurich').epochMs);

const allDayLines = (date: string) =>
  parse(encodeIcs(calendarOf([event({ start: { kind: 'date', date } })])));

/** The physical lines of one folded line, and the line they unfold to. */
const physical = (folded: string) => folded.split('\r\n');
const unfoldOne = (folded: string) =>
  physical(folded)
    .map((line, index) => (index === 0 ? line : line.slice(1)))
    .join('');

function event(overrides: Partial<IcsEvent> = {}): IcsEvent {
  return {
    uid: icsUid('ps-1', HOST),
    sequence: 0,
    status: 'CONFIRMED',
    start: timed(Date.UTC(2026, 10, 24, 17, 0)),
    summary: 'POWR · Upper A (Week 3)',
    ...overrides,
  };
}

describe('encodeIcs: the file (CAL-01, §8.13)', () => {
  it('writes a timed event with an alarm, an all-day event and a cancellation (golden text)', () => {
    const text = encodeIcs(
      calendarOf(
        [
          {
            uid: icsUid('0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8a', HOST),
            sequence: 2,
            status: 'CONFIRMED',
            start: timed(Date.UTC(2026, 10, 24, 17, 0), 75),
            summary: 'POWR · Upper A (Week 3)',
            description: 'Bench press: 4 sets\nBarbell row, overhand: 3 sets',
            alarm: { minutesBefore: 30, description: 'POWR · Upper A (Week 3)' },
          },
          {
            uid: icsUid('0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8b', HOST),
            sequence: 0,
            status: 'CONFIRMED',
            start: { kind: 'date', date: '2026-12-31' },
            summary: 'POWR · Lower B (Week 3)',
          },
          {
            uid: icsUid('0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8c', HOST),
            sequence: 4,
            status: 'CANCELLED',
            start: timed(Date.UTC(2026, 10, 26, 6, 30), 45),
            summary: 'POWR · Upper B (Week 2)',
            alarm: { minutesBefore: 15, description: 'never written' },
          },
        ],
        { name: 'POWR training' },
      ),
    );
    expect(text).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SZ WEB DEVELOPMENT//POWR 0.0.0//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:POWR training',
        'BEGIN:VEVENT',
        'UID:0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8a@powr.invalid',
        'DTSTAMP:20261123T180411Z',
        'DTSTART:20261124T170000Z',
        'DURATION:PT1H15M',
        'SUMMARY:POWR · Upper A (Week 3)',
        'DESCRIPTION:Bench press: 4 sets\\nBarbell row\\, overhand: 3 sets',
        'SEQUENCE:2',
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'TRIGGER:-PT30M',
        'DESCRIPTION:POWR · Upper A (Week 3)',
        'END:VALARM',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8b@powr.invalid',
        'DTSTAMP:20261123T180411Z',
        'DTSTART;VALUE=DATE:20261231',
        'DTEND;VALUE=DATE:20270101',
        'SUMMARY:POWR · Lower B (Week 3)',
        'SEQUENCE:0',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8c@powr.invalid',
        'DTSTAMP:20261123T180411Z',
        'DTSTART:20261126T063000Z',
        'DURATION:PT45M',
        'SUMMARY:POWR · Upper B (Week 2)',
        'SEQUENCE:4',
        'STATUS:CANCELLED',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n'),
    );
  });

  it('uses CRLF for every line and ends with CRLF', () => {
    const text = encodeIcs(calendarOf([event({ description: 'a\nb\r\nc\rd' })]));
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/u);
  });

  it('is deterministic: the same input gives the same text', () => {
    const calendar = calendarOf([event(), event({ uid: icsUid('ps-2', HOST), sequence: 3 })]);
    expect(encodeIcs(calendar)).toBe(encodeIcs(structuredClone(calendar)));
  });

  it('omits the calendar name when none is given', () => {
    expect(encodeIcs(calendarOf([event()]))).not.toContain('X-WR-CALNAME');
  });

  it('exports the MIME type for downloads and sharing', () => {
    expect(ICS_MIME).toBe('text/calendar');
  });
});

describe('times (CAL-02, CAL-03)', () => {
  it('writes DTSTAMP and DTSTART in UTC and drops milliseconds', () => {
    const lines = parse(
      encodeIcs(calendarOf([event({ start: timed(Date.UTC(2026, 0, 2, 3, 4, 5, 999)) })])),
    );
    expect(valueOf(lines, 'DTSTAMP')).toBe('20261123T180411Z');
    expect(valueOf(lines, 'DTSTART')).toBe('20260102T030405Z');
  });

  it('keeps the same local wall-clock time across the autumn DST change (Europe/Zurich)', () => {
    const lines = parse(
      encodeIcs(
        calendarOf([
          event({ uid: icsUid('before', HOST), start: zurichAt('2026-10-24', '18:00') }),
          event({ uid: icsUid('after', HOST), start: zurichAt('2026-10-25', '18:00') }),
        ]),
      ),
    );
    // 18:00 CEST (UTC+2) the day before, 18:00 CET (UTC+1) on the day the clocks go back.
    expect(valueOf(lines, 'DTSTART', 0)).toBe('20261024T160000Z');
    expect(valueOf(lines, 'DTSTART', 1)).toBe('20261025T170000Z');
  });

  it('keeps the same local wall-clock time across the spring DST change (Europe/Zurich)', () => {
    const lines = parse(
      encodeIcs(
        calendarOf([
          event({ uid: icsUid('before', HOST), start: zurichAt('2027-03-27', '07:30') }),
          event({ uid: icsUid('after', HOST), start: zurichAt('2027-03-29', '07:30') }),
        ]),
      ),
    );
    expect(valueOf(lines, 'DTSTART', 0)).toBe('20270327T063000Z');
    expect(valueOf(lines, 'DTSTART', 1)).toBe('20270329T053000Z');
  });

  it.each([
    [45, 'PT45M'],
    [1, 'PT1M'],
    [60, 'PT1H'],
    [75, 'PT1H15M'],
    [120, 'PT2H'],
    [600, 'PT10H'],
  ])('writes a %i-minute session as DURATION:%s', (minutes, expected) => {
    const lines = parse(encodeIcs(calendarOf([event({ start: timed(STAMP, minutes) })])));
    expect(valueOf(lines, 'DURATION')).toBe(expected);
    expect(valueOf(lines, 'DTEND')).toBeUndefined();
  });

  it('writes an all-day event with an exclusive end on the next day (month and leap day)', () => {
    const plain = allDayLines('2026-11-24');
    expect(plain.find((line) => line.name === 'DTSTART')).toEqual({
      name: 'DTSTART',
      params: ['VALUE=DATE'],
      value: '20261124',
    });
    expect(valueOf(plain, 'DTEND')).toBe('20261125');
    expect(valueOf(plain, 'DURATION')).toBeUndefined();
    expect(valueOf(allDayLines('2028-02-28'), 'DTEND')).toBe('20280229');
    expect(valueOf(allDayLines('2028-02-29'), 'DTEND')).toBe('20280301');
    expect(valueOf(allDayLines('2026-11-30'), 'DTEND')).toBe('20261201');
  });
});

describe('alarms (CAL-02)', () => {
  it.each([
    [15, '-PT15M'],
    [30, '-PT30M'],
    [60, '-PT1H'],
    [120, '-PT2H'],
    [0, 'PT0M'],
  ])('writes a reminder %i minutes before as TRIGGER:%s', (minutesBefore, trigger) => {
    const lines = parse(
      encodeIcs(calendarOf([event({ alarm: { minutesBefore, description: 'Train: Upper A' } })])),
    );
    const begin = lines.findIndex((line) => line.name === 'BEGIN' && line.value === 'VALARM');
    expect(lines.slice(begin, begin + 5)).toEqual([
      { name: 'BEGIN', params: [], value: 'VALARM' },
      { name: 'ACTION', params: [], value: 'DISPLAY' },
      { name: 'TRIGGER', params: [], value: trigger },
      { name: 'DESCRIPTION', params: [], value: 'Train: Upper A' },
      { name: 'END', params: [], value: 'VALARM' },
    ]);
  });

  it('writes no alarm without one, and none for a cancelled event', () => {
    expect(encodeIcs(calendarOf([event()]))).not.toContain('VALARM');
    const cancelled = event({
      status: 'CANCELLED',
      alarm: { minutesBefore: 30, description: 'Train' },
    });
    expect(encodeIcs(calendarOf([cancelled]))).not.toContain('VALARM');
  });
});

describe('identity and updates (CAL-04)', () => {
  it('builds `<id>@<host>` UIDs', () => {
    expect(icsUid('0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8a', 'powr.invalid')).toBe(
      '0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8a@powr.invalid',
    );
    expect(icsUid('ps.1', 'beta.example.org')).toBe('ps.1@beta.example.org');
  });

  it.each([
    ['', HOST, 'id is empty'],
    ['ps-1', '', 'host is empty'],
    ['a@b', HOST, "id must not contain '@'"],
    ['ps-1', 'powr@invalid', "host must not contain '@'"],
    ['ps 1', HOST, 'id must not'],
    ['ps-1', 'powr .invalid', 'host must not'],
    ['ps\n1', HOST, 'id must not'],
    ['ps\t1', HOST, 'id must not'],
    ['ps\u00001', HOST, 'id must not'],
    ['ps-1', 'powr.invalid\u007f', 'host must not'],
  ])('rejects the UID parts %j and %j', (id, host, message) => {
    expect(() => icsUid(id, host)).toThrow(message);
  });

  it('keeps the UID line of a planned session the same across exports', () => {
    const uid = icsUid('0195f3a2-7c1e-7d4b-9a10-3c2f1e0d9b8a', HOST);
    const first = parse(encodeIcs(calendarOf([event({ uid, sequence: 0 })])));
    const changed = parse(
      encodeIcs(
        calendarOf([event({ uid, sequence: 1, summary: 'POWR · Upper A (Week 4)' })], {
          dtStampEpochMs: STAMP + 86_400_000,
        }),
      ),
    );
    expect(valueOf(first, 'UID')).toBe(valueOf(changed, 'UID'));
    expect(valueOf(first, 'SEQUENCE')).toBe('0');
    expect(valueOf(changed, 'SEQUENCE')).toBe('1');
  });

  it('marks removed sessions as cancelled with a higher sequence', () => {
    const lines = parse(encodeIcs(calendarOf([event({ status: 'CANCELLED', sequence: 7 })])));
    expect(valueOf(lines, 'STATUS')).toBe('CANCELLED');
    expect(valueOf(lines, 'SEQUENCE')).toBe('7');
  });
});

describe('escaping (RFC 5545 §3.3.11)', () => {
  it.each([
    ['back\\slash', 'back\\\\slash'],
    ['semi;colon', 'semi\\;colon'],
    ['com,ma', 'com\\,ma'],
    ['line\nbreak', 'line\\nbreak'],
    ['windows\r\nbreak', 'windows\\nbreak'],
    ['old mac\rbreak', 'old mac\\nbreak'],
    ['two\n\nbreaks', 'two\\n\\nbreaks'],
    ['colon: stays', 'colon: stays'],
    ['tab\tstays', 'tab\tstays'],
    ['bell\u0007 and nul\u0000 go', 'bell and nul go'],
    ['a\\;b,c\\n', 'a\\\\\\;b\\,c\\\\n'],
  ])('escapes %j as %j', (text, escaped) => {
    expect(escapeIcsText(text)).toBe(escaped);
  });

  it('escapes SUMMARY, DESCRIPTION and the alarm text so they read back exactly', () => {
    const summary = 'POWR · Push; Day, 1 \\ "heavy"';
    const description = 'Bench press: 4 × 5\nIncline press, dumbbell: 3 sets\r\nDips; 2 sets';
    const lines = parse(
      encodeIcs(
        calendarOf([
          event({ summary, description, alarm: { minutesBefore: 60, description: summary } }),
        ]),
      ),
    );
    expect(unescapeText(valueOf(lines, 'SUMMARY') ?? '')).toBe(summary);
    expect(unescapeText(valueOf(lines, 'DESCRIPTION', 0) ?? '')).toBe(
      'Bench press: 4 × 5\nIncline press, dumbbell: 3 sets\nDips; 2 sets',
    );
    expect(unescapeText(valueOf(lines, 'DESCRIPTION', 1) ?? '')).toBe(summary);
  });

  it('round-trips any text through escape and unescape (line breaks become LF)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        const escaped = escapeIcsText(text);
        expect(escaped).not.toMatch(/[\r\n]/u);
        const expected = text
          .replaceAll(/\r\n|\n|\r/gu, '\n')
          // oxlint-disable-next-line no-control-regex -- the escaping drops these
          .replaceAll(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
        expect(unescapeText(escaped)).toBe(expected);
      }),
    );
  });
});

describe('folding (RFC 5545 §3.1)', () => {
  it('leaves a line of 75 octets alone and folds one of 76', () => {
    const exact = `DESCRIPTION:${'x'.repeat(63)}`;
    expect(octets(exact)).toBe(75);
    expect(foldIcsLine(exact)).toBe(exact);
    const over = `${exact}y`;
    expect(foldIcsLine(over)).toBe(`${exact}\r\n y`);
  });

  it('folds long ASCII lines into 75-octet pieces with a leading space', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(30)}`;
    const lines = physical(foldIcsLine(line));
    expect(lines.length).toBeGreaterThan(3);
    expect(octets(lines[0]!)).toBe(75);
    for (const continuation of lines.slice(1)) {
      expect(continuation.startsWith(' ')).toBe(true);
      expect(octets(continuation)).toBeLessThanOrEqual(75);
    }
    expect(octets(lines[1]!)).toBe(75);
    expect(unfoldOne(foldIcsLine(line))).toBe(line);
  });

  it.each([
    ['umlauts (2 octets)', 'Übungsplan für Kniebeugen und Bankdrücken: '.repeat(6)],
    ['CJK (3 octets)', '深蹲卧推硬拉训练计划'.repeat(12)],
    ['emoji (4 octets, surrogate pairs)', '🏋️💪🔥 '.repeat(20)],
    ['mixed', 'a€😀ü漢'.repeat(25)],
  ])('never splits a UTF-8 sequence: %s', (_, text) => {
    const line = `SUMMARY:${text}`;
    const folded = foldIcsLine(line);
    for (const piece of physical(folded)) {
      expect(octets(piece)).toBeLessThanOrEqual(75);
      expect(piece.isWellFormed()).toBe(true);
      // Decoding each physical line on its own would fail on a split sequence.
      expect(new TextDecoder('utf-8', { fatal: true }).decode(encoder.encode(piece))).toBe(piece);
    }
    expect(unfoldOne(folded)).toBe(line);
  });

  it('counts a lone surrogate as the 3-octet replacement character', () => {
    const line = `SUMMARY:${'\ud800'.repeat(30)}`;
    for (const piece of physical(foldIcsLine(line))) {
      expect(octets(piece)).toBeLessThanOrEqual(75);
    }
  });

  it('round-trips any line through folding and unfolding', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 400 }), (raw) => {
        const line = raw.replaceAll(/[\r\n]/gu, '');
        const folded = foldIcsLine(line);
        for (const piece of physical(folded)) expect(octets(piece)).toBeLessThanOrEqual(75);
        expect(unfoldOne(folded)).toBe(line);
      }),
    );
  });
});

describe('input checks', () => {
  it.each<[string, () => unknown, string]>([
    ['no events', () => encodeIcs(calendarOf([])), 'at least one event'],
    ['an empty PRODID', () => encodeIcs(calendarOf([event()], { prodId: ' ' })), 'prodId'],
    [
      'a NaN stamp',
      () => encodeIcs(calendarOf([event()], { dtStampEpochMs: Number.NaN })),
      'dtStampEpochMs',
    ],
    [
      'an infinite start',
      () => encodeIcs(calendarOf([event({ start: timed(Infinity) })])),
      'start.epochMs',
    ],
    [
      'a start after the year 9999',
      () => encodeIcs(calendarOf([event({ start: timed(Date.UTC(10_000, 0, 1)) })])),
      'start.epochMs',
    ],
    ['a negative sequence', () => encodeIcs(calendarOf([event({ sequence: -1 })])), 'sequence'],
    ['a fractional sequence', () => encodeIcs(calendarOf([event({ sequence: 1.5 })])), 'sequence'],
    [
      'a zero duration',
      () => encodeIcs(calendarOf([event({ start: timed(STAMP, 0) })])),
      'durationMinutes',
    ],
    [
      'a negative duration',
      () => encodeIcs(calendarOf([event({ start: timed(STAMP, -5) })])),
      'durationMinutes',
    ],
    [
      'a fractional duration',
      () => encodeIcs(calendarOf([event({ start: timed(STAMP, 1.5) })])),
      'durationMinutes',
    ],
    [
      'an impossible date',
      () => encodeIcs(calendarOf([event({ start: { kind: 'date', date: '2026-02-30' } })])),
      'start.date',
    ],
    [
      'the last day iCalendar can write',
      () => encodeIcs(calendarOf([event({ start: { kind: 'date', date: '9999-12-31' } })])),
      'last day',
    ],
    [
      'a date without padding',
      () => encodeIcs(calendarOf([event({ start: { kind: 'date', date: '2026-2-3' } })])),
      'start.date',
    ],
    [
      'a negative alarm',
      () => encodeIcs(calendarOf([event({ alarm: { minutesBefore: -15, description: 'Train' } })])),
      'alarm.minutesBefore',
    ],
    [
      'an empty alarm text',
      () =>
        encodeIcs(calendarOf([event({ alarm: { minutesBefore: 15, description: '\u0007 ' } })])),
      'alarm.description',
    ],
    ['an empty UID', () => encodeIcs(calendarOf([event({ uid: '' })])), 'uid'],
    [
      'an unknown status',
      () => encodeIcs(calendarOf([event({ status: 'TENTATIVE' as IcsEvent['status'] })])),
      'status',
    ],
    [
      'an unknown start kind',
      () => encodeIcs(calendarOf([event({ start: { kind: 'week' } as unknown as IcsStart })])),
      'start kind',
    ],
  ])('rejects %s', (_, run, message) => {
    expect(run).toThrow(message);
  });
});

describe('any calendar (properties)', () => {
  const text = fc.string({ unit: 'binary', maxLength: 200 });
  const visibleText = fc
    .string({ unit: 'binary', minLength: 1, maxLength: 80 })
    .filter((value) => escapeIcsText(value).trim().length > 0);
  const start: fc.Arbitrary<IcsStart> = fc.oneof(
    fc.record({
      kind: fc.constant('dateTime' as const),
      // 1970 … 9999 in whole minutes.
      epochMs: fc.integer({ min: 0, max: 4_102_444_800 }).map((minutes) => minutes * 60_000),
      durationMinutes: fc.integer({ min: 1, max: 600 }),
    }),
    fc
      .date({
        min: new Date('1970-01-01T00:00:00Z'),
        max: new Date('9999-12-30T00:00:00Z'),
        noInvalidDate: true,
      })
      .map((date) => ({ kind: 'date' as const, date: date.toISOString().slice(0, 10) })),
  );
  const events = fc.array(
    fc.record(
      {
        uid: fc.uuid().map((id) => icsUid(id, HOST)),
        sequence: fc.nat({ max: 10_000 }),
        status: fc.constantFrom('CONFIRMED' as const, 'CANCELLED' as const),
        start,
        summary: text,
        description: text,
        alarm: fc.record({
          minutesBefore: fc.constantFrom(0, 15, 30, 60, 120),
          description: visibleText,
        }),
      },
      { requiredKeys: ['uid', 'sequence', 'status', 'start', 'summary'] },
    ),
    { minLength: 1, maxLength: 6 },
  );

  it('folds every line to ≤ 75 octets, ends every line with CRLF and nests BEGIN/END', () => {
    fc.assert(
      fc.property(events, fc.option(text, { nil: undefined }), (generated, name) => {
        const output = encodeIcs(calendarOf(generated, name === undefined ? {} : { name }));
        for (const line of physicalLines(output)) expect(octets(line)).toBeLessThanOrEqual(75);

        const lines = parse(output);
        const stack: string[] = [];
        const mismatched: string[] = [];
        for (const line of lines) {
          if (line.name === 'BEGIN') stack.push(line.value);
          if (line.name === 'END' && stack.pop() !== line.value) mismatched.push(line.value);
        }
        expect(mismatched).toEqual([]);
        expect(stack).toEqual([]);
        expect(lines[0]).toEqual({ name: 'BEGIN', params: [], value: 'VCALENDAR' });
        expect(lines.at(-1)).toEqual({ name: 'END', params: [], value: 'VCALENDAR' });

        expect(
          lines.filter((line) => line.name === 'BEGIN' && line.value === 'VEVENT'),
        ).toHaveLength(generated.length);
        const alarms = generated.filter((item) => item.alarm && item.status === 'CONFIRMED');
        expect(
          lines.filter((line) => line.name === 'BEGIN' && line.value === 'VALARM'),
        ).toHaveLength(alarms.length);
        generated.forEach((item, index) => {
          expect(unescapeText(valueOf(lines, 'UID', index) ?? '')).toBe(item.uid);
          expect(unescapeText(valueOf(lines, 'SUMMARY', index) ?? '')).toBe(
            unescapeText(escapeIcsText(item.summary)),
          );
        });
      }),
    );
  });
});
