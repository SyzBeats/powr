import { useState } from 'react';

import { addReferenceHistory } from '@powr/application/reference';

import { Button } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useContainer } from '../../app/container-context';

interface Entry {
  readonly name: string;
  readonly ms: number;
}

/** The paint timings and POWR's own marks and measures of this page load (§8.19). */
function readEntries(): Entry[] {
  const paints = performance
    .getEntriesByType('paint')
    .map((entry) => ({ name: entry.name, ms: entry.startTime }));
  const own = [
    ...performance.getEntriesByType('mark'),
    ...performance.getEntriesByType('measure'),
  ].filter((entry) => entry.name.startsWith('powr-'));
  return [
    ...paints,
    ...own.map((entry) => ({
      name: entry.name,
      ms: entry.entryType === 'measure' ? entry.duration : entry.startTime,
    })),
  ];
}

/**
 * `/debug/perf` (M6a): loads the reference dataset (PRD A-11: about five years, 1,300 workouts,
 * 40,000 sets, 1,800 weigh-ins and a few breaks) into this phone's real database, next to the
 * profile and plan, and shows this page load's paint timings and POWR's marks (`powr-home-
 * interactive`, `powr-set-commit`, the charts' measures). For the opt-in E2E perf spec and the
 * S22 measurements (NFR-PERF-01…08); developer tool, English only.
 */
export function PerfTools() {
  const { deps } = useContainer();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>(readEntries);

  const load = async (options: Parameters<typeof addReferenceHistory>[1]) => {
    setBusy(true);
    setStatus('Adding the history…');
    const started = performance.now();
    try {
      const added = await addReferenceHistory(deps, options);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      setStatus(
        `Added ${added.sessions} workouts, ${added.sets} sets, ${added.bodyweights} weigh-ins and ${added.breaks} breaks in ${seconds} s.`,
      );
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Performance (reference dataset)">
      <Card>
        <h2 className="text-lg font-semibold">Reference dataset</h2>
        <p>
          Adds five years of training (about 1,300 workouts, 40,000 sets, 1,800 weigh-ins and five
          breaks, up to yesterday) to the data on this phone. The profile, plan and settings stay.
          Loading it again replaces the earlier copy. Derived data is rebuilt on first use.
        </p>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => void load({})}>
          Add the reference history
        </Button>
        <p className="text-sm text-fg-muted">
          A short history of the same kind (six weeks with a two-week break: about 20 workouts and
          42 weigh-ins) gives the screens realistic data without the volume (the accessibility
          sweep).
        </p>
        <Button
          size="lg"
          disabled={busy}
          onClick={() => void load({ weeks: 6, weighIns: 42, breaks: 1, prefix: 'short' })}
        >
          Add a short history
        </Button>
        <output data-testid="reference-status" className="block text-sm empty:hidden">
          {status}
        </output>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">This page load</h2>
        <p className="text-sm text-fg-muted">
          Paint timings and POWR&apos;s marks since the app opened. Open Home from a cold start,
          then this page from Settings → Developer tools.
        </p>
        <Button onClick={() => setEntries(readEntries())}>Refresh</Button>
        <ul data-testid="perf-entries" className="text-sm tabular">
          {entries.map((entry, index) => (
            <li key={`${entry.name}-${index}`}>
              {entry.name}: {Math.round(entry.ms)} ms
            </li>
          ))}
        </ul>
      </Card>
    </Screen>
  );
}
