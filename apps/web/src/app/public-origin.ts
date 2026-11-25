/**
 * The app's public origin: ONE configuration value for the calendar UIDs and any public URL
 * (product-owner decision 2026-11-25). The deploy sets it at build time with
 * `VITE_PUBLIC_ORIGIN=https://<host>`; the neutral default `https://powr.invalid` uses the
 * reserved `.invalid` top-level domain (RFC 2606), so no real domain is ever claimed by mistake.
 * A value that is not an http(s) origin falls back to the default.
 */
export const DEFAULT_PUBLIC_ORIGIN = 'https://powr.invalid';

export function publicOrigin(configured: string | undefined): string {
  if (!configured) return DEFAULT_PUBLIC_ORIGIN;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : DEFAULT_PUBLIC_ORIGIN;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

// Exported once public URLs use it (M5s may need it for links); for now only the host is used.
const PUBLIC_ORIGIN = publicOrigin(import.meta.env.VITE_PUBLIC_ORIGIN);

/** The host part, e.g. for calendar UIDs `<planned-session-id>@<host>` (CAL-04). */
export const PUBLIC_HOST = new URL(PUBLIC_ORIGIN).host;
