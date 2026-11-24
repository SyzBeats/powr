import { compareStrings } from '../compare';

/** Lower-case hex SHA-256 via Web Crypto (available in browsers, workers and Node). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 over "path\0sha256\n" lines sorted by path (§8.3.2). */
export async function contentDigest(
  entries: readonly { path: string; sha256: string }[],
): Promise<string> {
  const lines = entries
    .toSorted((a, b) => compareStrings(a.path, b.path))
    .map((entry) => `${entry.path}\0${entry.sha256}\n`)
    .join('');
  return sha256Hex(new TextEncoder().encode(lines));
}
