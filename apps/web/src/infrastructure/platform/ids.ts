import type { IdGenerator } from '@powr/application';

/**
 * UUIDv7 (RFC 9562): 48-bit Unix milliseconds, then random bits. Time-ordered, which keeps
 * IndexedDB inserts local in the primary-key index (§8.1).
 */
export function uuidv7(
  nowMs: number = Date.now(),
  random: Uint8Array = crypto.getRandomValues(new Uint8Array(10)),
): string {
  const bytes = new Uint8Array(16);
  let time = nowMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes.set(random, 6);
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f); // version 7
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f); // variant 10
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const uuidv7Generator: IdGenerator = { next: () => uuidv7() };
