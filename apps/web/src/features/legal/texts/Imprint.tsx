import { Trans } from '@lingui/react/macro';

import { LEGAL_DETAILS } from '../publisher';
import { PublisherBlock, Section } from './parts';

/**
 * The publisher identification (imprint, LEG-09, PRD §8.6): person and trading name, postal
 * address (a placeholder until provided), country and e-mail. Available offline. The exact
 * content required in Switzerland and the EU is confirmed in the legal review (V-06).
 */
export function ImprintText() {
  const details = LEGAL_DETAILS;
  const { provider, location } = details.hosting;
  return (
    <>
      <Section title={<Trans>Publisher</Trans>}>
        <p>
          <Trans>POWR is published and run by:</Trans>
        </p>
        <PublisherBlock details={details} />
      </Section>
      <Section title={<Trans>About this app</Trans>}>
        <p>
          <Trans>
            POWR is free to use. It is a general fitness app, not a medical device, and it stores
            your data only on your device.
          </Trans>
        </p>
        <p>
          <Trans>
            The app files are hosted on a server in {location}, rented from {provider}.
          </Trans>
        </p>
        <p>
          <Trans>The fastest way to reach us is by e-mail.</Trans>
        </p>
      </Section>
    </>
  );
}
