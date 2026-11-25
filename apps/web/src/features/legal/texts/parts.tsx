import { Trans } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';

import { Card } from '#ui/screen';

import { isPlaceholder, type LegalDetails } from '../publisher';

/*
 * Building blocks of the legal texts (M5s). Everything in `texts/` is the lazy `legal` catalog
 * (lingui.config.ts): rendered as React elements, never as HTML strings (Trusted Types).
 */

/** One titled part of a legal text, a level-2 heading under the screen's h1. */
export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  const generated = useId();
  const headingId = id ? `${id}-title` : generated;
  return (
    <Card>
      <section aria-labelledby={headingId} className="flex flex-col gap-2">
        <h2 id={headingId} className="text-lg font-bold">
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

/** A plain bulleted list. */
export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>;
}

/** The publisher's e-mail as a mail link (the visible address is the link text). */
export function EmailLink({ details }: { details: LegalDetails }) {
  return (
    <a
      href={`mailto:${details.email}`}
      className="font-semibold break-all text-info underline underline-offset-4"
    >
      {details.email}
    </a>
  );
}

/** The postal address lines, or the placeholder in words while it is missing. */
function PostalAddress({ details }: { details: LegalDetails }) {
  const address = details.postalAddress;
  if (isPlaceholder(address))
    return (
      <span data-testid="address-placeholder" className="font-semibold">
        <Trans>Postal address: to be added before the public release.</Trans>
      </span>
    );
  return (
    <span className="flex flex-col">
      {address.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </span>
  );
}

/** The publisher block of the privacy notice and the imprint (LEG-09). */
export function PublisherBlock({ details }: { details: LegalDetails }) {
  const { person, business, country } = details;
  return (
    <address className="flex flex-col gap-1 not-italic">
      <span className="font-semibold">{person}</span>
      <span>{business}</span>
      <PostalAddress details={details} />
      <span>{country}</span>
      <span>
        <Trans>
          E-mail: <EmailLink details={details} />
        </Trans>
      </span>
    </address>
  );
}
