# ADR-0015: Date and time handling: Temporal via temporal-polyfill

- Status: Accepted
- Date: 2026-11-23
- Related: technical concept §8.1, §6.6; PRD NFR-REL-05, SET-11, CAL-03, TMR-04, MOT-03/04, BOD-02

## Context

The domain needs calendar dates independent of time zones (session day, bodyweight day, planned day), instants with offsets (NFR-REL-05), week boundaries with a configurable week start (SET-11), DST-correct wall-clock times for `.ics` export (CAL-03), and day differences for EMA gaps and return-from-break logic. The engine must be deterministic and run in Node tests.

Facts checked 2026-11-23: native Temporal exists in Chrome Android 144+ and Samsung Internet 31+ only (MDN BCD 8.1.10), and in the developer's Node 26. The project baseline is Chromium 130 / Samsung Internet 28. Packages: `temporal-polyfill` 1.0.8 (MIT, about 19 KB gzipped, active), `@js-temporal/polyfill` 0.5.1 (ISC, last release March 2025), `date-fns` 4.4.0 + `@date-fns/tz` 1.5.0 (MIT), `dayjs` 1.11.23 (MIT).

## Options considered

| Criterion (weight) | Temporal via `temporal-polyfill` (ponyfill) | date-fns 4 + `@date-fns/tz` | Day.js + timezone plugin |
|---|---|---|---|
| Correctness for zones and DST (3) | 5 | 4 | 3 |
| Bundle size (2) | 4 | 4 | 5 |
| API fit (`PlainDate`, `ZonedDateTime`, `Instant`) (3) | 5 | 3 | 2 |
| Future-proofing (standard API) (2) | 5 | 3 | 2 |
| Maintenance (2) | 5 | 4 | 3 |
| **Total (max 60)** | **58** | 43 | 35 |

## Decision

Use the **Temporal API through `temporal-polyfill` imported as a ponyfill** (no global patching) from a single `@powr/domain/time` module, in the app, the worker and tests. The same implementation runs everywhere, which keeps results deterministic across browsers. Switching to native Temporal later is a one-file change once the baseline reaches Samsung Internet 31.

Representations: `LocalDate` strings (`YYYY-MM-DD`), `PlainTime` strings (`HH:MM`), `InstantTz { epochMs, offsetMin, zone }`. `Date.now()` is called only in infrastructure (`Clock` port).

## Consequences

- Positive: DST-safe arithmetic and clear types for dates vs instants; the domain never touches `Date`.
- Negative: about 19 KB gzipped in the entry bundle; within budget.
- Runner-up: **date-fns 4 with `@date-fns/tz`**.
