# POWR backup format

| Field | Value |
|---|---|
| Version | 1.0, 2026-11-25 (M6c) |
| Covers | Container `formatVersion` 1; record `dataVersion` 1 and 2 (2 is current) |
| Purpose | PRD DAT-05 (a backup is usable without the app and its format is documented) and DAT-07 (a schema description is kept with each format version) |
| Source of truth | The code in `packages/formats` (`src/backup/*`, `src/records/*`, `src/migrations/*`, `src/json.ts`). Where this document and the code disagree, the code is right and this document has a bug |
| Schemas | `docs/formats/schemas/` (section 12), generated from the same Zod schemas the import uses; `pnpm formats:schemas` writes them and a test fails when they are stale |
| Related | [Technical concept](../technical-concept.md) §8.3 (design), §8.2.1 (safety copies), §8.2.3 (migrations); [ADR-0013](../adr/0013-backup-file-format.md) |

A POWR backup is an ordinary ZIP file with JSON inside. You do not need POWR to read it: any unzip tool and any text editor or JSON viewer will do. This document says what is in the file, how the app checks it on restore, and how to check it yourself.

**Words.** The app says "workout" for a training session you start, log and finish. The data keeps the older name: the table is `sessions`, a set points to its workout with `sessionId`, and a planned day is a `plannedSessions` record. The product owner decided on 2026-11-25 that "session" stays in code, data and documents, so this document uses the data names.

## 1. Reading a backup by hand

1. Unzip it, for example `unzip powr-backup-2026-11-25-1804.zip -d backup` (or "Extract all" on Windows, or the Files app on Android).
2. Open `backup/manifest.json` to see when the backup was made, by which version of POWR, and how many records each table has.
3. Open any `backup/data/<table>.json`: each one is a JSON array of records. The files are written without spaces or line breaks; a JSON viewer (or `python3 -m json.tool data/sets.json`, or `jq . data/sets.json`) makes them readable.
4. To check that nothing was changed, compare the checksums:

   ```sh
   cd backup
   sha256sum data/*.json        # each must equal the entry's "sha256" in manifest.json
   # The "contentDigest": one line "path NUL sha256 LF" per entry, sorted by path, hashed again.
   for f in $(ls data/*.json | LC_ALL=C sort); do
     printf '%s\0%s\n' "$f" "$(sha256sum "$f" | cut -d' ' -f1)"
   done | sha256sum             # must equal "contentDigest" in manifest.json
   ```

   On Windows, `Get-FileHash -Algorithm SHA256 data\sets.json` in PowerShell gives the same hashes (in upper case).

Editing any file makes these checksums fail, and POWR then refuses to restore the backup (section 7). Edit a copy, never the only one.

## 2. The file and the ZIP container

- **Name:** `powr-backup-YYYY-MM-DD-HHMM.zip`, from the local date and time it was made (for example `powr-backup-2026-11-25-1804.zip`). The name carries no meaning for the import; renaming the file is fine.
- **Container:** a standard ZIP archive (PKZIP), written with fflate 0.8.3. Every entry is compressed with Deflate (level 6). No encryption, no ZIP64, no comments, no directories as entries. The time of every entry is the time the backup was made.
- **MIME type:** `application/zip`. POWR saves it through the browser's save dialog or as a download; it is never shared through Web Share (Chrome does not allow ZIP files there).
- **Text:** every entry is UTF-8 text without a byte-order mark.

| Entry (in this order) | Content |
|---|---|
| `manifest.json` | Always first. Describes the backup (section 3). Pretty-printed with two spaces |
| `data/<table>.json` | One entry per table, in the table order of section 4: a JSON array of records |
| `README.txt` | A short plain-English note on what the file is. Not checked by the import; its text may change between app versions |

A backup made by the export contains an entry for every table of its `dataVersion`, an empty table as `[]`. A safety copy taken before a data update (section 10) contains only the tables that existed at its older `dataVersion`. The import treats a table without an entry as empty.

## 3. The manifest (`manifest.json`)

Schema: [`schemas/manifest.format-1.schema.json`](schemas/manifest.format-1.schema.json). Unknown fields are an error.

| Field | Type | Meaning |
|---|---|---|
| `format` | `"powr-backup"` | Marks the file as a POWR backup. Anything else: "This is not a POWR backup file." |
| `formatVersion` | `1` | Version of the container layout (this document). A higher number is a newer app's file (section 6) |
| `dataVersion` | integer ≥ 1 | Version of the record shapes in `data/` (1 or 2 today). Equals the app's database version when the backup was made |
| `app.version`, `app.build` | strings ≤ 64 | The app version (`apps/web/package.json`) and build ID (a commit hash) that wrote the file. Informational |
| `rulesVersion` | string ≤ 64 | Version of the rules registry (parameters and their evidence) at export, for example `1.7.0+…`. Informational |
| `contentVersion` | string ≤ 64 | Version of the built-in exercise library at export. Informational |
| `createdAt` | string | When the backup was made: ISO 8601 with milliseconds and the UTC offset, for example `2026-11-25T18:04:11.123+01:00` |
| `backupId` | string, 1–64 characters | A unique ID of this backup (a UUIDv7 in the app). Reserved for tying photo parts to their data part (section 11) |
| `part` | `{ "kind": "data", "index": 1, "count": 1 }` | This version has one part. Photo parts are planned (section 11) |
| `encrypted` | `false` | This version is never encrypted (section 11) |
| `counts` | object: table name → integer ≥ 0 | Records per table, for the restore preview and for people. Not checked against the data: the app counts the records it read |
| `dateRange` | `{ "from": string \| null, "to": string \| null }` | The first and last `localDate` (YYYY-MM-DD) of any record in `sessions`; both `null` without sessions. Informational |
| `entries` | array of at most 64 objects | One per `data/` entry, in file order: `path` (`data/<letters>.json`), `bytes` (the exact size of the entry, uncompressed), `records` (the number of records; informational) and `sha256` (64 lower-case hex digits) |
| `contentDigest` | 64 lower-case hex digits | One checksum over all entries (section 7) |

Example (shortened):

```json
{
  "format": "powr-backup",
  "formatVersion": 1,
  "dataVersion": 2,
  "app": { "version": "0.0.0", "build": "a1b2c3d" },
  "rulesVersion": "1.7.0+619fd4d55abd",
  "contentVersion": "0.3.0+…",
  "createdAt": "2026-11-25T18:04:11.123+01:00",
  "backupId": "019ab3c4-…",
  "part": { "kind": "data", "index": 1, "count": 1 },
  "encrypted": false,
  "counts": { "meta": 3, "settings": 1, "sessions": 42, "sets": 1180, "…": 0 },
  "dateRange": { "from": "2026-09-01", "to": "2026-11-24" },
  "entries": [
    { "path": "data/meta.json", "bytes": 512, "records": 3, "sha256": "4f53…" },
    "…"
  ],
  "contentDigest": "f3be…"
}
```

## 4. The data files (`data/<table>.json`)

### 4.1 Rules for every table

- **A JSON array of records** (objects), sorted by the table's key in plain character-code order (the same on every device). Empty table: `[]`.
- **Canonical JSON:** no spaces or line breaks, and the keys of every object sorted alphabetically, so the same data always gives the same bytes and the same checksum.
- **Strict records:** a record has exactly the fields its schema lists. An unknown field, a wrong type or a value out of range makes the whole restore fail (section 8). An optional field that has no value is left out; it is never written as `null` unless the schema says `null` is a value.
- **IDs** are strings of 1–64 characters (UUIDv7 in practice). Exceptions: `profile` and `settings` have one record each with the ID `"me"`; `meta` is keyed by `key`; `exerciseUserData` by `exerciseId`.
- **Exercise IDs** are `ex.<name>` for the built-in library (for example `ex.barbell-back-squat`) and `cx.<name>` for the user's own exercises, which travel in the same backup (`customExercises`). Muscle IDs are `mu.…`, equipment `eq.…`, the user's own equipment items `ce.…`, plan templates `tpl.…`, equipment presets `preset.…`, sources `src.…`.
- **Moments in time** (`instantTz`, for example `startedAt`, `performedAt`): `{ "epochMs": <milliseconds since 1970-01-01T00:00:00Z>, "offsetMin": <offset from UTC in minutes, −1080…1080>, "zone": "<IANA zone, for example Europe/Zurich>" }`. The offset and zone are those of the device when it happened, so the local time can be shown as the user saw it.
- **Calendar days** (`localDate`, `startDate`, …): `YYYY-MM-DD` in the user's local time; it must be a real date.
- **Weights** (`mass`): `{ "value": <number>, "unit": "kg" | "lb" }`, stored in the unit the user entered (never converted). Converted to kg, a load lies between −500 and 2,000; a negative load is assistance (an assisted pull-up). Bodyweights and training maxes are positive.
- **Effort:** RIR (reps in reserve), 0–10 in steps of 0.5; `null` when not entered. The app can show it as RPE (10 − RIR), but it always stores RIR.
- **Text a user typed** (notes, names): notes ≤ 2,000 characters, names ≤ 120.
- **Version stamps** (`versions`): `{ "engine", "rules", "content" }`, the versions that produced a session or plan.

### 4.2 The tables

Every table of dataVersion 2, in file order. The JSON Schema of each lists every field, type, range and allowed value.

| Table (`data/….json`) | Key | Since | What a record is |
|---|---|---|---|
| `meta` | `key` | 1 | A small app value under a name, for example `lastBackup` (time, counts and size of the last export), `backupReminder`, `calendarExport`, `legalAck` (which health and privacy notice versions were acknowledged), `onboardingDraft`, `persistence`. `value` is any JSON (section 8.3) |
| `settings` | `id` (`"me"`) | 1 | The app settings: `theme` (`light`, `dark`, `system`), and since dataVersion 2 optional groups `session` (rest timer and logging preferences, per-exercise choices), `weekStart`, `overrides` (the user's own values of rules parameters: `paramId`, a JSON `value`, optionally an `exerciseId`), `insights`, `backup` (reminder cadence 7, 14 or 30 days, or `null` for off), `training` (RIR or RPE, chips or decimal entry, warm-ups), `display` (larger controls, celebrations) and `alerts` (sound, volume 0–1, vibration, pre-alert, countdown, notifications, keep screen on). An absent group means the app's defaults |
| `sessions` | `id` | 1 | A workout: `localDate`, `startedAt`, `endedAt` (absent while active), `status` (`active`, `finished`, `partial`, `discarded`; at most one `active`), `origin` (`planned`, `freestyle`, `repeat`), its `exercises` (each with a unique `key`, the `exerciseId`, its planned sets and rest), supersets and circuits (`groups`), the logging `cursor`, the running `timer`, the readiness result, the changes POWR suggested and the user accepted (`changes`), a `revision` counter and `undo` (the last undoable step: a copy of the workout and of the sets it would restore or remove) |
| `sets` | `id` | 1 | One logged set: `sessionId`, `exerciseId`, `index` (the order of the exercise's sets within the workout: 0, 1, …), `type` (`warmup`, `working`, `top`, `backoff`, `amrap`, `timed`), `load` (the external weight, negative for assistance, `null` for pure bodyweight or timed work), `reps` (0–1,000 or `null`), `effort` (`rir` and whether it was `entered`), `state` (`done` or `skipped`), `performedAt`, `localDate`; since dataVersion 2 optionally the workout slot and planned set (`slotKey`, `setKey`), left and right reps of a one-sided set, a duration, flags (failure, failed rep, pain), the rest before it, what was prescribed, a technique and a note |
| `profile` | `id` (`"me"`) | 2 | The onboarding answers: units, sex and the reference set used for strength standards, birth year, height, training style, body phase, experience, the level override, priority muscles, avoided exercises and movement patterns, preferred and hidden exercises, the starting lifts (`baselines`) |
| `equipmentProfiles` | `id` | 2 | An equipment list ("Home gym"): the items, the user's own items, bars and their weights, plate pairs, microplates, collar weight, dumbbells (a list or a range with a step), kettlebells, machine stacks and their steps, bands; at most one `isDefault` |
| `plans` | `id` | 2 | A training plan: template, style, split, periodisation, the equipment profile it uses, the schedule (weekdays, week start, minutes per workout, start times), its blocks (`mesocycles`: weeks, lighter weeks, the training level, the days with their exercises and prescriptions, the weekly set targets per muscle), the dismissed warnings and a `revision`; at most one `active` |
| `plannedSessions` | `id` | 2 | One planned workout of a plan: plan, block and week, the day, its dates (`localDate`, the day it is planned for now; `scheduledDate`, the day the plan first gave it), `status` (`planned`, `done`, `skipped`, `merged`, `onBreak`), the exercises with their prescriptions, the adjustments (lighter week, readiness, return after a break) |
| `breaks` | `id` | 2 | A training break: `startDate`, `endDate` (`null` while it lasts), `reason` (`vacation`, `illness`, `injury`, `life`, `other`), an optional note |
| `meets` | `id` | 2 | A powerlifting competition: date, weigh-in type, weight class, division, federation |
| `bodyweights` | `id` | 2 | A weigh-in: `localDate`, `measuredAt`, `mass`, an optional note |
| `readiness` | `id` | 2 | A readiness check-in before a workout: sleep hours (steps of 0.25), sleep quality, energy, soreness, stress and motivation (1–5 each, or `null`), the Perceived Recovery Status (0 not recovered … 10 fully recovered), sore muscles, and the workout it belongs to |
| `customExercises` | `id` (`cx.…`) | 2 | An exercise the user made: names and synonyms, movement pattern, mechanics, the exercise it varies or was copied from, equipment needed, the muscles it trains (credit 1, 0.5, 0.25 or 0, with the evidence grade and source), load type and curve, default rep ranges, rest class and tempo, its cues, `status` (`active` or `deprecated`, with `replacedBy`) |
| `exerciseUserData` | `exerciseId` | 2 | The user's notes for one exercise: machine setup (seat, pins, …), a note and the training max |
| `measurements` | `id` | 2 | A body measurement: `site` (circumferences such as `waist` in `cm` or `in`; skinfolds such as `skinfoldThigh` in `mm`), `value`, the day and time, an optional note |

Derived data (weekly summaries, estimated maxes, records, trends, the streak) is never in a backup. POWR rebuilds it from these tables after a restore.

## 5. Versions

| Version | Where | What it versions | Changes when |
|---|---|---|---|
| `formatVersion` | manifest | The container: entry names, the manifest's fields, the checksum rules | The layout changes (for example photo parts or encryption) |
| `dataVersion` | manifest | The shape of the records in `data/` | A record shape changes in a way old files do not have; equals the app's database version |
| `app.version`, `app.build` | manifest | The app that wrote the file | Every release and build |
| `rulesVersion`, `contentVersion` | manifest | The rules registry and the exercise library at export | When the rules or the library change |
| `versions` | in sessions and plans | The engine, rules and library that produced a workout or a plan | Per record |

**dataVersion history.**

- **1** (M0–M1): `meta`, `settings`, `sessions` (date, times, status, version stamp), `sets`.
- **2** (M2 onwards): the eleven other tables; workouts gain the workout structure (exercises, planned sets, cursor, timer, readiness, undo); sets, settings and the profile gain optional fields. Version 2 has not been released yet and was amended in place during development (M3a added the workout structure and `readiness`; M4a `customExercises`, `exerciseUserData` and `measurements`; M3t to M5s optional settings and profile fields). Since M3a every amendment added only optional fields or new tables, so every version-2 file written since then stays valid; a version-2 file from an M2 development build that holds workouts would not pass today's schema (no public build wrote one). Once version 2 is released it never changes again: a new shape means dataVersion 3 and a migration (section 9).

**Newer files are refused, older ones are always accepted.**

- An older file (lower `dataVersion`) is migrated on import to the current version, forever (section 9).
- A file with a higher `dataVersion` or a higher `formatVersion` than the app knows is refused before anything else is read, with the message "This backup was made by a newer version of POWR. Update the app first." A `formatVersion` the app does not know that is lower than 1 fails the manifest check instead ("This backup contains invalid data, so it cannot be restored. Nothing was changed.").

## 6. How a restore reads a file

A restore replaces all data on the phone with the backup's. POWR first reads and checks the whole file without writing anything, shows a preview (when it was made, how many workouts and sets, which training days), and asks the user to type a confirmation word. Only then does it save a safety copy of the current data (section 10) and replace every table in one database transaction: it either fully applies or changes nothing. The checks, in order (`decodeBackup` in `packages/formats/src/backup/decode.ts`):

1. The file is at most 200 MiB.
2. The ZIP's central directory, before anything is unpacked: no entry is named `__proto__`, `constructor` or `prototype`; no name appears twice; at most 64 entries; at most 1 GiB unpacked in total; no entry larger than 1 MiB unpacks to more than 200 times its packed size (a "zip bomb"). Then the entries are unpacked and every name must arrive.
3. `manifest.json` exists and is JSON (otherwise the file is "not a POWR backup") without reserved keys or deep nesting (section 8).
4. `format` is `"powr-backup"`; `formatVersion` and `dataVersion` are not newer than the app's (section 5).
5. The manifest matches its schema exactly.
6. The ZIP holds no entry the manifest does not list (only `manifest.json`, `README.txt` and the listed `data/` entries are allowed).
7. `contentDigest` matches the manifest's entries.
8. Every listed entry exists, has exactly `bytes` bytes and the listed `sha256`; its name is a known table.
9. Every data entry is JSON, without reserved keys or deep nesting, and is an array.
10. The records are migrated from the file's `dataVersion` to the app's (section 9).
11. Every record matches its table's schema exactly (section 4).
12. The references hold (section 8.4).

The first failing check decides the message:

| Problem | Error kind (code) | Message in the app |
|---|---|---|
| Not a ZIP, or no readable POWR manifest (step 2, 3, 4) | `notZip`, `notAPowrBackup` | "This is not a POWR backup file. Nothing was changed." |
| Larger than the limits, or an unsafe ZIP (step 1, 2, 6) | `tooLarge`, `unsafeArchive` | "This file is too large or malformed to restore safely. Nothing was changed." |
| Newer app version (step 4) | `newerVersion` | "This backup was made by a newer version of POWR. Update the app first." |
| A checksum or size does not match (step 7, 8) | `checksumMismatch` | "This backup is damaged or was edited, so it cannot be restored. Nothing was changed." |
| A reserved key or a schema error in the manifest, an unknown table, unreadable JSON, a record or reference problem (step 3, 5, 8–12) | `invalidManifest`, `invalidData`, `brokenReference` | "This backup contains invalid data, so it cannot be restored. Nothing was changed." |

## 7. Integrity

- **Per entry:** `entries[].sha256` is the SHA-256 of the entry's exact bytes (the uncompressed JSON), as 64 lower-case hex digits, and `entries[].bytes` its length.
- **Over all entries:** `contentDigest` is the SHA-256 of the UTF-8 text made of one line per manifest entry, `path` + NUL (byte 0) + `sha256` + LF (byte 10), the lines sorted by `path` in character-code order. For two entries: `sha256("data/meta.json\0<hash1>\ndata/sets.json\0<hash2>\n")`.
- **ZIP:** every entry also carries the ZIP's own CRC-32, which the unpacker checks.

The manifest itself is not hashed; editing a hash in it breaks `contentDigest`, and editing both is exactly what someone who wants to tamper would do. **The checksums detect damage and accidental edits, not deliberate changes:** anyone can recompute them. That is why every file is treated as untrusted on import (sections 6 and 8), and why authenticity comes only with encryption (section 11). A backup is also not secret: anyone who has the file can read it.

## 8. Limits and safety rules

### 8.1 Archive

| Limit | Value |
|---|---|
| File size | ≤ 200 MiB (209,715,200 bytes) |
| Entries in the ZIP | ≤ 64; also ≤ 64 entries in `manifest.entries` |
| Unpacked size, all entries | ≤ 1 GiB |
| Compression ratio | ≤ 200 : 1 for any entry larger than 1 MiB unpacked (small JSON may compress better) |
| Entry names | Not `__proto__`, `constructor` or `prototype`; no repeated name; only `manifest.json`, `README.txt` and the listed `data/<letters>.json` |

### 8.2 JSON

- Every JSON file (the manifest and each data file) is read with a plain JSON parser; nothing in a backup is ever run as code, and text from a backup is shown only as text.
- **No reserved keys:** no object, at any depth, has a key `__proto__`, `constructor` or `prototype`. These keys are the path of "prototype pollution" attacks on JavaScript programs; some JSON libraries also drop them silently, which would change restored data without a word.
- **Nesting depth ≤ 32:** arrays and objects nest at most 32 levels (a data file is level 1, a record level 2). Deeper input could overflow the stack of recursive code.
- The export applies the same rules and refuses to write a backup it could not restore (it fails loudly instead).

### 8.3 Records

Strict schemas (section 4, and the JSON Schemas): no unknown field; numbers in range (for example reps 0–1,000, RIR 0–10 in steps of 0.5, loads −500 to 2,000 kg-equivalent, at most 20 sets per exercise prescription); strings of limited length (IDs ≤ 64, names ≤ 120, notes ≤ 2,000). The free-form JSON values (`meta[].value`, `settings.overrides[].value`) may hold any JSON, but get the reserved-key and depth checks before anything else reads them.

### 8.4 References

- Every set belongs to a workout in the file (`sessionId`); a set with `slotKey` belongs to an exercise of that workout, and with `setKey` to one of its planned sets.
- Every exercise a record names (sets, workouts, plans, planned workouts, the user's exercise notes, custom exercises' `variantOf`, `copiedFrom` and `replacedBy`) exists in the app's built-in library or among the file's own `customExercises`. A `cx.` ID never resolves to the library, an `ex.` ID never to a custom exercise.
- Custom exercise IDs and exercise-notes keys do not repeat; a workout's exercise keys do not repeat; a superset or circuit names only exercises of its workout; a readiness check-in names a workout in the file.
- Every plan names an equipment profile in the file; every planned workout names a plan in the file.
- At most one active workout, one active plan and one default equipment profile.

## 9. Migrations and kept fixtures

The same migration chain upgrades the database on the phone and old backups on import (`packages/formats/src/migrations/index.ts`): step *n* takes a record from dataVersion *n* to *n* + 1, one table at a time; a step may drop a record. Changes follow "expand, migrate, contract": a field is never reused for a new meaning.

| Step | What it does |
|---|---|
| 1 → 2 | Every workout (`sessions`) gets the workout structure with empty values (`origin: "freestyle"`, `equipmentProfileId: null`, `exercises: []`, `groups: []`, `cursor: null`, `timer: null`, `readiness: null`, `changes: []`, `revision: 0`, `undo: null`); fields it already has are kept. Every other record passes unchanged; the new tables start empty |

Migration happens before the schema check, so an old file is checked against today's rules. Backups made by every earlier version are kept as test fixtures and restored by every test run, forever (NFR-MNT-03):

| Fixture (`packages/formats/fixtures/backups/`) | Made by | Holds |
|---|---|---|
| `v1/active-session.zip` | M1, dataVersion 1 | Two workouts (one active), three sets, settings, meta |
| `v2/m3-active-session.zip` | M3a, dataVersion 2 | An active workout with a running timer, an undo step, warm-ups, a technique set, a readiness check-in, workout preferences |
| `v2/m4-insights.zip` | M4a, dataVersion 2 | A custom exercise and its sets, setup memory and a training max, measurements, insight settings, hidden exercises |
| `hostile/*.zip` | M6c | 17 files the import must refuse, one per attack in sections 6 and 8: not a ZIP, a ZIP without a manifest, a newer `dataVersion`, a newer `formatVersion`, `__proto__` in the manifest, `__proto__` and `constructor` in records, nesting 40 levels deep, an entry named `__proto__`, a repeated entry, an unlisted entry, 65 entries, a zip bomb, a wrong content digest, an edited entry, an unknown field, a broken reference. `packages/formats/test/hostile-fixtures.test.ts` checks each error; `packages/formats/scripts/hostile-fixtures.ts` describes and writes them |

## 10. Safety copies and rescue copies are ordinary backups

- **Before a restore** POWR saves the current data as a backup in a separate database on the phone (`powr-safety`), so a mistaken restore can be undone. **Before a data update** (a new app version with a higher `dataVersion`) it saves the data at its old `dataVersion` the same way. Settings → Data and backups lists these "safety copies"; each can be saved as a file and restored like any backup. POWR keeps the latest two and any younger than 30 days, but never more than five, and deletes the oldest first (technical concept §8.2.1).
- **The recovery screen** (shown when the database cannot be opened) offers "Save a copy of your data": a backup of the records exactly as stored, at their stored `dataVersion`.
- These copies use this same format. One difference: a rescue or pre-update copy keeps every record as it was, even one that the import would refuse (for example one with a reserved key), because losing data is worse than a copy that needs repair. The ordinary export refuses such data.

## 11. Not in this version

The manifest has fields for two planned features. In formatVersion 1 they have one value only, and a file that uses them is refused:

- **Photos (planned for v1.2, DAT-09):** a backup with photos would be one data part plus photo parts (`powr-backup-…-photos-1of3.zip`) sharing the `backupId`; `part.kind` would be `"photos"`. Today `part` is always `{ "kind": "data", "index": 1, "count": 1 }`.
- **Encryption (planned for v1.3, DAT-10):** an encrypted backup would hold an unencrypted header and an encrypted inner backup; `encrypted` would describe the method. Today `encrypted` is always `false`.

Either will raise `formatVersion` (and possibly `dataVersion`) and be described here before it ships.

## 12. The JSON Schemas

`docs/formats/schemas/` holds JSON Schema (draft 2020-12) documents generated with Zod's `z.toJSONSchema()` from the same schemas the import validates with. **Do not edit them by hand:** run `pnpm formats:schemas` (script `packages/formats/scripts/json-schemas.ts`) after a schema change; `packages/formats/test/json-schemas.test.ts` fails in `pnpm verify` when a file is stale, missing or extra.

| File | Describes |
|---|---|
| `manifest.format-1.schema.json` | `manifest.json` of formatVersion 1 |
| `data-1/<table>.schema.json` | The four tables of dataVersion 1 (`meta`, `settings`, `sessions`, `sets`), as they shipped |
| `data-2/<table>.schema.json` | The 15 tables of dataVersion 2, the current version: exactly what the import checks after migration |

Each data schema describes a whole file: an array of records. Parts that several records share are named under `$defs`: `localDate`, `instantTz`, `mass`, `versionStamp`, `prescription`, `planSlot`, `planDay`, `sessionExercise`, `sessionCore`. Schemas describe the file's content before any conversion (Zod's input side).

**What the JSON Schemas do not say.** A file that passes them can still be refused by the app, because these rules are code, not schema:

- local dates must be real calendar dates (the schemas say `format: "date"`, which many validators do not enforce);
- a weight converted to kg lies between −500 and 2,000; bodyweights, training maxes and the like are positive;
- RIR moves in steps of 0.5 and sleep hours in steps of 0.25;
- every range `[min, max]` or `{ "min", "max" }` has min ≤ max;
- a measurement's unit matches its site (skinfolds in mm, circumferences in cm or in);
- a weekly set target has `full` exactly when its `source` is `timeBudget`;
- muscle and equipment IDs must exist in the app's catalog;
- the reserved keys and the depth limit (section 8.2) apply everywhere, also inside the free-form `value` fields, which the schemas leave open (`{}`);
- the references of section 8.4, the checksums of section 7 and the archive limits of section 8.1.

## 13. For maintainers: changing the format

- **A new optional field** (before the first release, inside dataVersion 2): add it with `exactOptional()` to the record schema in `packages/formats/src/records/v2.ts` and to the domain type; run `pnpm formats:schemas`; add the field to a round-trip test and, if it matters for old data, to a new fixture.
- **Any other record change** (after the release): raise `DATA_VERSION`, keep the old version's schemas in their own module (like `v1.ts`) and list them in `DATA_VERSION_SCHEMAS` (`scripts/json-schemas.ts`), add a migration step, add a fixture `vN/…zip` made by the new version, and run `pnpm formats:schemas`. Never edit a released version's schemas.
- **A container change** (new entries, photos, encryption): raise `BACKUP_FORMAT_VERSION`, update sections 2, 3 and 7 here and the manifest schema.
- Update this document in the same change.
