import { useEffect, useRef, useState } from 'react';

import { Button } from '#ui/button';
import { Input } from '#ui/input';
import { Card, Screen } from '#ui/screen';

import { APP_INFO, useDiagnostics, usePlatform } from '../../hooks/use-app';
import { useTimerKit } from '../../hooks/use-timer-kit';
import { useTimerDisplay, type TimerState } from '../../hooks/use-timers';
import { formatClock, formatTime } from '../../i18n/format';
import {
  applyEvent,
  completeInterrupted,
  CONDITIONS,
  newRun,
  optionsFor,
  readBattery,
  VARIANTS,
  type Condition,
  type HarnessRun,
  type RunConfig,
  type Variant,
} from './alert-harness';

const REST_PRESETS = [
  { label: '10 s', ms: 10_000 },
  { label: '60 s', ms: 60_000 },
  { label: '3 min', ms: 180_000 },
  { label: '5 min', ms: 300_000 },
  { label: '8 min', ms: 480_000 },
];
const RUNS_KEY = 'alertRuns';
const SETTINGS_KEY = 'alertSettings';

type HarnessSettings = Omit<RunConfig, 'device'> & { device: string };

const DEFAULT_SETTINGS: HarnessSettings = {
  device: '',
  variant: 'C',
  restMs: 60_000,
  condition: 'locked',
  batterySaver: false,
  holdWakeLock: true,
  keepAliveGain: 0.001,
};

/**
 * `/debug/alerts`: device harness for spike S-1 (§8.8.5), running the production alert
 * scheduler. Choose the condition and variant, start a run, lock the screen or switch apps, come
 * back, and export the results for `tools/capability-matrix` (see IMPLEMENTATION_NOTES.md, M3t).
 */
export function AlertsHarness() {
  const platform = usePlatform();
  const timers = useTimerKit();
  const { restAlerts, screenWake, labs } = timers;
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
  const [labsKeepAlive, setLabsKeepAlive] = useState(() => labs.audioKeepAlive());
  const [timer, setTimer] = useState<TimerState | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const display = useTimerDisplay(timer);

  useEffect(() => platform.debugStore.save(SETTINGS_KEY, settings), [platform, settings]);
  useEffect(() => platform.debugStore.save(RUNS_KEY, runs), [platform, runs]);
  useEffect(() => () => stopRef.current?.(), []);

  const upsert = (run: HarnessRun) =>
    setRuns((previous) => [
      structuredClone(run),
      ...previous.filter((existing) => existing.runId !== run.runId),
    ]);

  const start = async () => {
    const config: RunConfig = { ...settings, device: settings.device || 'unnamed device' };
    // In the tap: the audio context may only start after user activation.
    await timers.audio.unlock();
    const { run, timer: runTimer } = newRun(
      config,
      Date.now(),
      platform.notifications.permission(),
    );
    const record = (data: { event: string; path?: string | null; delayMs?: number | null }) =>
      log('info', 'alerts.event', {
        runId: run.runId,
        variant: run.variant,
        event: data.event,
        path: data.path ?? null,
        delayMs: data.delayMs ?? null,
        visibility: document.visibilityState,
        restMs: run.restMs,
        result: run.outcome,
      });

    let finished = false;
    const finish = async (event: 'end' | 'stopped') => {
      if (finished) return;
      finished = true;
      unsubscribe();
      unwatchWakeLock();
      restAlerts.disarm(run.runId);
      releaseWakeLock?.();
      if (config.holdWakeLock) screenWake.setEnabled(wakeLockWasEnabled);
      run.status = event === 'end' ? 'done' : 'stopped';
      run.events.push({ at: Date.now(), event, visibility: document.visibilityState });
      record({ event });
      run.battery.end = await readBattery();
      upsert(run);
      setTimer(null);
      stopRef.current = null;
    };

    const unsubscribe = restAlerts.subscribe((event) => {
      if (event.type === 'disarmed' || event.timer.id !== run.runId) return;
      const complete = applyEvent(run, event, Date.now(), document.visibilityState);
      const last = run.events.at(-1);
      record({
        event: last?.event ?? event.type,
        path: last?.path ?? null,
        delayMs: last?.delayMs ?? null,
      });
      upsert(run);
      if (complete) void finish('end');
    });
    const wakeLockWasEnabled = screenWake.status().enabled;
    const unwatchWakeLock = screenWake.subscribe(() => {
      const { state, reason } = screenWake.status();
      run.events.push({
        at: Date.now(),
        event: 'wake-lock',
        visibility: document.visibilityState,
        detail: reason ? `${state} (${reason})` : state,
      });
      upsert(run);
    });
    let releaseWakeLock: (() => void) | null = null;
    if (config.holdWakeLock) {
      screenWake.setEnabled(true);
      releaseWakeLock = screenWake.hold();
    }

    const endsAt = formatTime(run.endsAt);
    restAlerts.arm(
      runTimer,
      {
        restOver: { title: 'Rest over', body: `Test rest (${run.variant}) finished` },
        resting: { title: 'Resting', body: `Ends at ${endsAt}` },
      },
      optionsFor(config),
    );
    stopRef.current = () => void finish('stopped');
    setTimer(runTimer);
    upsert(run);
    run.battery.start = await readBattery();
    upsert(run);
  };

  const exportResults = async () => {
    const capabilities = await platform.capabilities.probe();
    // For interrupted runs, the service worker (or the page before it died) may have fired.
    const exported = await Promise.all(
      runs.map(async (run) =>
        completeInterrupted(run, run.key ? await platform.alerts.firedBy(run.key) : undefined),
      ),
    );
    const payload = {
      harnessVersion: 2,
      placeholder: false,
      exportedAt: new Date().toISOString(),
      device: settings.device || 'unnamed device',
      browser: timers.browser(),
      app: APP_INFO,
      userAgent: navigator.userAgent,
      capabilities,
      runs: exported,
    };
    const slug = (settings.device || 'device').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    platform.downloadText(`powr-alerts-${slug}-${stamp}.txt`, JSON.stringify(payload, null, 2));
  };

  const set = (patch: Partial<HarnessSettings>) => setSettings({ ...settings, ...patch });

  return (
    <Screen title="Timer alert harness (S-1)">
      <Card>
        <label className="flex flex-col gap-1 text-sm">
          Device and browser label
          <Input
            value={settings.device}
            onChange={(event) => set({ device: event.target.value })}
            placeholder="S22 One UI 7 Chrome PWA"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Condition</legend>
          {(Object.keys(CONDITIONS) as Condition[]).map((condition) => (
            <label key={condition} className="flex min-h-target items-center gap-3">
              <input
                type="radio"
                name="condition"
                checked={settings.condition === condition}
                onChange={() => set({ condition })}
                className="size-5"
              />
              {CONDITIONS[condition]}
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-target items-center gap-3">
          <input
            type="checkbox"
            checked={settings.batterySaver}
            onChange={(event) => set({ batterySaver: event.target.checked })}
            className="size-5"
          />
          Battery saver is on
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Variant</legend>
          {(Object.keys(VARIANTS) as Variant[]).map((variant) => (
            <label key={variant} className="flex min-h-target items-center gap-3">
              <input
                type="radio"
                name="variant"
                checked={settings.variant === variant}
                onChange={() => set({ variant })}
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
              aria-pressed={settings.restMs === preset.ms}
              variant={settings.restMs === preset.ms ? 'primary' : 'secondary'}
              onClick={() => set({ restMs: preset.ms })}
            >
              {preset.label}
            </Button>
          ))}
          <label className="flex items-center gap-2 text-sm">
            Custom seconds
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              data-testid="custom-rest"
              value={Math.round(settings.restMs / 1000)}
              onChange={(event) => set({ restMs: Math.max(1, Number(event.target.value)) * 1000 })}
              className="w-24 px-2"
            />
          </label>
        </fieldset>
        <label className="flex min-h-target items-center gap-3">
          <input
            type="checkbox"
            checked={settings.holdWakeLock}
            onChange={(event) => set({ holdWakeLock: event.target.checked })}
            className="size-5"
          />
          Hold the screen wake lock while visible
        </label>
        <label className="flex items-center gap-2 text-sm">
          Keep-alive gain (variant E)
          <Input
            type="number"
            step={0.001}
            min={0}
            max={1}
            value={settings.keepAliveGain}
            onChange={(event) => set({ keepAliveGain: Number(event.target.value) })}
            className="w-28 px-2"
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
        {timer ? (
          <>
            <p data-testid="run-countdown" className="text-4xl font-bold tabular">
              {display.done
                ? `Rest over · +${formatClock(display.overMs, 'down')}`
                : formatClock(display.remainingMs)}
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
              <th>Condition</th>
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
                <td>{run.condition ?? '-'}</td>
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

      <Card>
        <h2 className="text-lg font-semibold">Labs (OQ-T3 = B)</h2>
        <label className="flex min-h-target items-center gap-3">
          <input
            type="checkbox"
            checked={labsKeepAlive}
            onChange={(event) => {
              labs.setAudioKeepAlive(event.target.checked);
              setLabsKeepAlive(event.target.checked);
            }}
            className="size-5"
          />
          Audio keep-alive in workout rest timers on this device
        </label>
        <p className="text-sm text-fg-muted">
          Off by default and hidden from users until S-1 shows that it clearly works. For a long
          on-device battery test with real sessions.
        </p>
      </Card>
    </Screen>
  );
}
