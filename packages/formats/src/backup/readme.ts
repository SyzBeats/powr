export const BACKUP_README = `POWR backup
===========

This file is a standard ZIP archive created by the POWR training app.

- manifest.json describes the backup: format and data versions, app version, creation time,
  record counts and a SHA-256 checksum of every data file.
- data/<table>.json holds the records of one table as a JSON array, sorted by ID.

You can open the files with any text editor. To restore, open POWR and choose
Settings > Data > Restore from backup. Editing a file makes the checksum fail and the app
will refuse to import it.
`;
