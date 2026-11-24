import { useEffect, useRef, useState } from 'react';

import { APP_INFO, useDiagnostics, usePlatform } from '../../hooks/use-app';
import { Button } from '../../ui/button';
import { Card, Screen } from '../../ui/screen';
import { startRun, VARIANTS, type HarnessRun, type Variant } from './alert-harness';

const REST_PRESETS = [
  { label: '10 s', ms: 10_000 },
  { label: '60 s', ms: 60_000 },
  { label: '3 min', ms: 180_000 },
  { label: '5 min', ms: 300_000 },
  { label: '8 min', ms: 480_000 },
];
const RUNS_KEY = 'alertRuns';
const SETTINGS_KEY = 'alertSettings';

interface HarnessSettings {
  device: string;
  variant: Variant;
  restMs: number;
  holdWakeLock: boolean;
  keepAliveGain: number;
}

const DEFAULT_SETTINGS: HarnessSettings = {
  device: '',
  variant: 'C',
  restMs: 60_000,
  holdWakeLock: true,
  keepAliveGain: 0.001,
};

/**
 * `/debug/alerts`: device harness for spike S-1 (§8.8.5). Start a run, lock the screen or switch
 * apps, come back, and export the results file for docs/device-tests/.
 */
export function AlertsHarness() {
  const platform = usePlatform();
  const { log } = useDiagnostics();
  const [settings, setSettings] = useState<HarnessSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(platform.debugStore.load(SETTINGS_KEY) as Partial<HarnessSettings> | null),
  }));
  // A run that is still "running" after a page load cannot continue: the page was reloaded or
  // killed mid-run. It stays in the results, marked as interrupted.
  const [runs, setRuns] = useState<HarnessRun[]>(() =>
    ((platform.debugStore.load(RUNS_KEY) as HarnessRun[] | null) ?? []).map((run) =>
      run.status === 'running' ? { ...run, status: 'interrupted' } : run,
    ),
  );
  const [permission, setPermission] = useState(platform.notifications.permission());
  const [now, setNow] = useState(() => Date.now());
  const stopRef = useRef<(() => void) | null>(null);

  const current = runs.find((run) => run.status === 'running') ?? null;

  useEffect(() => platform.debugStore.save(SETTINGS_KEY, settings), [platform, settings]);
  useEffect(() => platform.debugStore.save(RUNS_KEY, runs), [platform, runs]);
  useEffect(() => {
    if (!current) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [current]);

  const upsert = (run: HarnessRun) =>
    setRuns((previous) => [run, ...previous.filter((existing) => existing.runId !== run.runId)]);

  const start = async () => {
    const handle = await startRun(
      { ...settings, device: settings.device || 'unnamed device' },
      {
        audio: platform.audio,
        haptics: platform.haptics,
        notifications: platform.notifications,
        alerts: platform.alerts,
        wakeLock: platform.wakeLock,
        log: (data) => log('info', 'alerts.event', data),
      },
      upsert,
    );
    stopRef.current = () => handle.stop();
  };

  const exportResults = async () => {
    const capabilities = await platform.capabilities.probe();
    // For interrupted runs, the service worker may still have fired: add what it recorded.
    const exported = await Promise.all(
      runs.map(async (run) => {
        if (run.status !== 'interrupted' || run.firstAlert) return run;
        const fired = await platform.alerts.firedBy(run.runId);
        if (!fired) return run;
        const path = fired.by === 'sw' ? ('sw-timer' as const) : ('page-timeout' as const);
        return { ...run, firstAlert: { path, delayMs: fired.at - run.endsAt } };
      }),
    );
    const payload = {
      harnessVersion: 1,
      exportedAt: new Date().toISOString(),
      device: settings.device || 'unnamed device',
      app: APP_INFO,
      userAgent: navigator.userAgent,
      capabilities,
      runs: exported,
    };
    const slug = (settings.device || 'device').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    platform.downloadText(`powr-alerts-${slug}-${stamp}.txt`, JSON.stringify(payload, null, 2));
  };

  const remainingMs = current ? current.endsAt - now : 0;

  return (
    <Screen title="Timer alert harness (S-1)">
      <Card>
        <label className="flex flex-col gap-1 text-sm">
          Device and browser label
          <input
            value={settings.device}
            onChange={(event) => setSettings({ ...settings, device: event.target.value })}
            placeholder="S22 Chrome PWA"
            className="min-h-target rounded-xl border border-border bg-surface px-3"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Variant</legend>
          {(Object.keys(VARIANTS) as Variant[]).map((variant) => (
            <label key={variant} className="flex min-h-target items-center gap-3">
              <input
                type="radio"
                name="variant"
                checked={settings.variant === variant}
                onChange={() => setSettings({ ...settings, variant })}
                className="size-5"
              />
              {VARIANTS[variant].label}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm font-medium">Rest length</legend>
          {REST_PRESETS.map((preset) => (
            <Button
              key={preset.ms}
              variant={settings.restMs === preset.ms ? 'primary' : 'secondary'}
              onClick={() => setSettings({ ...settings, restMs: preset.ms })}
            >
              {preset.label}
            </Button>
          ))}
          <label className="flex items-center gap-2 text-sm">
            Custom seconds
            <input
              type="number"
              inputMode="numeric"
              min={1}
              data-testid="custom-rest"
              value={Math.round(settings.restMs / 1000)}
              onChange={(event) =>
                setSettings({ ...settings, restMs: Math.max(1, Number(event.target.value)) * 1000 })
              }
              className="min-h-target w-24 rounded-xl border border-border bg-surface px-2"
            />
          </label>
        </fieldset>
        <label className="flex min-h-target items-center gap-3">
          <input
            type="checkbox"
            checked={settings.holdWakeLock}
            onChange={(event) => setSettings({ ...settings, holdWakeLock: event.target.checked })}
            className="size-5"
          />
          Hold the screen wake lock while visible
        </label>
        <label className="flex items-center gap-2 text-sm">
          Keep-alive gain (variant E)
          <input
            type="number"
            step={0.001}
            min={0}
            max={1}
            value={settings.keepAliveGain}
            onChange={(event) =>
              setSettings({ ...settings, keepAliveGain: Number(event.target.value) })
            }
            className="min-h-target w-28 rounded-xl border border-border bg-surface px-2"
          />
        </label>
        <p className="text-sm">
          Notification permission:{' '}
          <strong data-testid="notification-permission">{permission}</strong>
        </p>
        {permission === 'default' ? (
          <Button onClick={() => void platform.notifications.request().then(setPermission)}>
            Allow notifications
          </Button>
        ) : null}
      </Card>

      <Card>
        {current ? (
          <>
            <p data-testid="run-countdown" className="text-4xl font-bold tabular">
              {remainingMs > 0 ? `${Math.ceil(remainingMs / 1000)} s` : 'Rest over'}
            </p>
            <p className="text-sm text-fg-muted">
              Lock the screen or switch apps now, then come back.
            </p>
            <Button variant="danger" onClick={() => stopRef.current?.()}>
              Stop run
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" onClick={() => void start()}>
            Start run
          </Button>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Results ({runs.length})</h2>
          <Button onClick={() => void exportResults()}>Export results</Button>
        </div>
        <table className="w-full text-left text-xs tabular">
          <thead>
            <tr>
              <th>Variant</th>
              <th>Rest</th>
              <th>Path</th>
              <th>Delay</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody data-testid="run-results">
            {runs.map((run) => (
              <tr key={run.runId}>
                <td>{run.variant}</td>
                <td>{Math.round(run.restMs / 1000)} s</td>
                <td>{run.firstAlert?.path ?? '-'}</td>
                <td>{run.firstAlert ? `${(run.firstAlert.delayMs / 1000).toFixed(1)} s` : '-'}</td>
                <td>{run.outcome ?? run.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length > 0 ? (
          <Button variant="ghost" onClick={() => setRuns([])}>
            Clear results
          </Button>
        ) : null}
      </Card>
    </Screen>
  );
}
