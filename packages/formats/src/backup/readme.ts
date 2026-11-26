/**
 * `README.txt` in every backup ZIP (M6d text): what the file is, how to restore it in the
 * current app, where the format is described, and that the file is not encrypted. The import
 * ignores this entry (only its name is allowed), so the text may change between versions and
 * older backups with older text import as before. The UI paths and words here must match the
 * app (Settings › Data and backups › Restore from a backup, the REPLACE confirmation, "Replace
 * all data", Safety copies); `test/backup.test.ts` pins them.
 */
export const BACKUP_README = `POWR backup
===========

This ZIP file is a backup of your training data from the POWR app: workouts, sets,
plans, settings and everything else POWR keeps on the phone. manifest.json says when
it was made and by which version of POWR. Keep it somewhere other than the phone, for
example in cloud storage or on a computer.

What is inside
- manifest.json: the format and data versions, the app version, the creation time,
  the number of records per table and a SHA-256 checksum of every data file.
- data/<table>.json: the records of one table as a JSON array, sorted by ID.
- README.txt: this note.

How to restore
1. Open POWR on the phone to restore to. Go to Settings, then Data and backups, then
   Restore from a backup. (On a new phone, Home also offers "Restore from a backup"
   until the first workout is finished.)
2. Choose this file. POWR checks it and shows when it was made and how many workouts
   and sets it holds.
3. Type REPLACE and tap "Replace all data". The backup replaces all POWR data on that
   phone; POWR first keeps a copy of the data it replaces (Data and backups, Safety
   copies).
POWR refuses a file that was edited or damaged (a checksum no longer matches) or that a
newer version of POWR made, and then changes nothing.

The file format
The format is described in full in POWR's documentation, docs/formats/backup-format.md,
with a JSON Schema for every table in docs/formats/schemas/. Every file in this ZIP is
plain JSON text that any text editor opens.

Privacy
This backup is not encrypted. It holds your training data, body weight and anything
else you entered in POWR as plain text: anyone who has the file can read it. Store and
share it as you would other personal health information.
`;
