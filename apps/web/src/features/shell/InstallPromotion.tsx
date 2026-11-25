import { Plural, Trans } from '@lingui/react/macro';
import { Menu, MonitorSmartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '#ui/button';
import { Card } from '#ui/screen';

import { INSTALL_SNOOZE_DAYS, useInstall } from '../../hooks/use-device';
import { useActiveSession } from '../../hooks/use-session';

/**
 * Install promotion (PWA-02): a card, never a dialog, at meaningful moments (Home after
 * onboarding, the summary of a finished workout). Never on the first visit, never during a
 * workout, never when installed, and not again for 14 days after "Not now". Chrome gets its own
 * install dialog (the deferred `beforeinstallprompt`); Samsung Internet, which has no such event,
 * gets the steps of its menu in words.
 */
export function InstallPromotion() {
  const install = useInstall();
  const session = useActiveSession();
  const [closed, setClosed] = useState<'dismissed' | 'installed' | null>(null);
  const confirmation = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (closed) confirmation.current?.focus();
  }, [closed]);

  if (closed) {
    return (
      <p
        ref={confirmation}
        tabIndex={-1}
        data-testid="install-closed"
        className="text-sm text-fg-muted outline-none"
      >
        {closed === 'installed' ? (
          <Trans>POWR is being added to your home screen.</Trans>
        ) : (
          <Plural
            value={INSTALL_SNOOZE_DAYS}
            one="Okay. POWR will not ask again for # day."
            other="Okay. POWR will not ask again for # days."
          />
        )}
      </p>
    );
  }

  const workoutActive = !session.loaded || session.value !== undefined;
  if (install.installed || install.firstVisit || workoutActive || install.snoozed()) return null;
  if (!install.available && !install.samsung) return null;

  const notNow = () => {
    install.dismiss();
    setClosed('dismissed');
  };
  const installNow = async () => {
    const outcome = await install.prompt();
    if (outcome === 'accepted') setClosed('installed');
    else if (outcome === 'dismissed') notNow();
  };

  return (
    <Card>
      <h2 data-testid="install-promotion" className="flex items-center gap-2 text-lg font-bold">
        <MonitorSmartphone aria-hidden="true" />
        <Trans>Install POWR on this phone</Trans>
      </h2>
      <p>
        <Trans>
          It opens from your home screen like any app, full screen and offline, and the browser is
          more likely to protect your data.
        </Trans>
      </p>
      {install.available ? (
        <Button variant="primary" size="lg" onClick={() => void installNow()}>
          <Trans>Install</Trans>
        </Button>
      ) : (
        <ol className="flex list-decimal flex-col gap-2 pl-6">
          <li>
            <Trans>
              Tap the menu button <Menu aria-hidden="true" className="inline size-5" /> at the
              bottom of Samsung Internet.
            </Trans>
          </li>
          <li>
            <Trans>Tap “Add page to”, then “Home screen”.</Trans>
          </li>
          <li>
            <Trans>Open POWR from the new icon.</Trans>
          </li>
        </ol>
      )}
      {install.available ? null : (
        <p className="text-sm text-fg-muted">
          <Trans>
            If the address bar shows an install icon, tapping it does the same. Menus differ between
            versions.
          </Trans>
        </p>
      )}
      <Button size="lg" onClick={notNow}>
        <Trans>Not now</Trans>
      </Button>
    </Card>
  );
}
