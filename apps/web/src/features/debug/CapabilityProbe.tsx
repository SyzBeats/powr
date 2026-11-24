import { useEffect, useState } from 'react';

import type { CapabilityReport } from '@powr/application';

import { APP_INFO, usePlatform } from '../../hooks/use-app';
import { Button } from '../../ui/button';
import { Card, Screen } from '../../ui/screen';

/** `/debug/capabilities`: what this browser supports, for spike S-2 (§8.23). */
export function CapabilityProbe() {
  const platform = usePlatform();
  const [report, setReport] = useState<CapabilityReport | null>(null);
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void platform.capabilities.probe().then(setReport);
  }, [platform, version]);

  const check = async (name: string, action: () => Promise<string> | string) => {
    try {
      const result = await action();
      setChecks((previous) => ({ ...previous, [name]: result }));
    } catch (error) {
      setChecks((previous) => ({ ...previous, [name]: `error: ${String(error)}` }));
    }
    setVersion((current) => current + 1);
  };

  const tryWakeLock = async () => {
    const result = await platform.wakeLock.acquire();
    await platform.wakeLock.release();
    return result;
  };
  const tryBeep = async () => {
    const unlocked = await platform.audio.unlock();
    platform.audio.play('restEnd', 1);
    return String(unlocked);
  };

  const exportReport = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    platform.downloadText(
      `powr-capabilities-${stamp}.txt`,
      JSON.stringify({ probeVersion: 1, app: APP_INFO, report, manualChecks: checks }, null, 2),
    );
  };

  return (
    <Screen title="Capability probe (S-2)">
      <Card>
        <h2 className="text-lg font-semibold">Manual checks (tap to run)</h2>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void check('wakeLock', tryWakeLock)}>Wake lock</Button>
          <Button
            onClick={() =>
              void check('vibrate', () => String(platform.haptics.vibrate([200, 100, 200])))
            }
          >
            Vibrate
          </Button>
          <Button
            onClick={() =>
              void check('notificationPermission', () => platform.notifications.request())
            }
          >
            Notifications
          </Button>
          <Button onClick={() => void check('audio', tryBeep)}>Beep</Button>
        </div>
        <dl data-testid="manual-checks" className="grid grid-cols-2 text-sm tabular">
          {Object.entries(checks).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-fg-muted">{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {report?.groups.map((group) => (
        <Card key={group.name}>
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 text-sm">
            {group.items.map((item) => (
              <div key={item.key} className="contents">
                <dt className="text-fg-muted">{item.key}</dt>
                <dd className="break-words">{String(item.value)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}

      <Button variant="primary" onClick={exportReport}>
        Export report
      </Button>
    </Screen>
  );
}
