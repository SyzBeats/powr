/* oxlint-disable lingui/no-unlocalized-strings -- names, addresses and the release report are data */
/**
 * Every publisher and legal detail in one place (LEG-02, LEG-09, PRD §8.2 and §8.6; product-owner
 * decision 2026-11-25). The privacy notice, the imprint, the health notice and About read from
 * here. A detail still to be provided is a `Placeholder`: while one remains, the legal screens
 * show a visible "Draft" marker and `pnpm release:check` (run by the production deploy, not by
 * `pnpm verify`) fails, so nothing reaches production with a placeholder.
 *
 * No imports and only erasable TypeScript: `scripts/release-check.ts` loads this file with plain
 * Node. The public website address is not configured here (no domain is invented); a legal text
 * that needs it takes it from the app's public-URL setting.
 */

/** A detail to be provided before the public release; `what` says what is missing. */
export interface Placeholder {
  readonly placeholder: string;
}

function toBeProvided(what: string): Placeholder {
  return { placeholder: what };
}

export interface LegalDetails {
  /** The publisher as a person and trading name (LEG-09, PRD §8.6). */
  readonly person: string;
  readonly business: string;
  readonly country: string;
  readonly email: string;
  /** Postal address lines (LEG-09: "a postal contact address and e-mail"). */
  readonly postalAddress: readonly string[] | Placeholder;
  /** Hosting as the privacy notice must name it (technical concept §7.2, §7.4). */
  readonly hosting: {
    readonly provider: string;
    readonly location: string;
  };
  /** The date ('YYYY-MM-DD') the legal review approved the texts (PRD V-05, V-06). */
  readonly legalReview: string | Placeholder;
}

export const LEGAL_DETAILS: LegalDetails = {
  person: 'Simeon Zimmermann',
  business: 'SZ WEB DEVELOPMENT',
  country: 'Switzerland',
  email: 'tools@sz-development.com',
  postalAddress: toBeProvided('the postal address of the publisher (LEG-09)'),
  hosting: { provider: 'Hetzner Online GmbH', location: 'Germany' },
  legalReview: toBeProvided(
    'the date of the legal review of the privacy notice, health notice and imprint (PRD V-05, V-06)',
  ),
};

export function isPlaceholder(value: unknown): value is Placeholder {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { placeholder?: unknown }).placeholder === 'string'
  );
}

/** What is still to be provided, in words (empty when the legal details are complete). */
export function legalPlaceholders(details: LegalDetails = LEGAL_DETAILS): string[] {
  const found: string[] = [];
  const visit = (value: unknown): void => {
    if (isPlaceholder(value)) found.push(value.placeholder);
    else if (typeof value === 'object' && value !== null && !Array.isArray(value))
      for (const entry of Object.values(value)) visit(entry);
  };
  visit(details);
  return found;
}

/** The release gate's verdict: the report it prints and whether production may be deployed. */
export function releaseCheck(details: LegalDetails = LEGAL_DETAILS): {
  readonly ok: boolean;
  readonly report: string;
} {
  const missing = legalPlaceholders(details);
  if (missing.length === 0)
    return { ok: true, report: 'Release check passed: no legal placeholder remains.' };
  return {
    ok: false,
    report: [
      `Release check FAILED: ${missing.length} legal placeholder(s) remain in apps/web/src/features/legal/publisher.ts:`,
      ...missing.map((what) => `  ✗ ${what}`),
      'Fill them in (and bump the legal text versions in versions.ts) before a production deploy.',
    ].join('\n'),
  };
}
