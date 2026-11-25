import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { Button } from '#ui/button';
import { Card } from '#ui/screen';

import { useDiagnostics } from '../../hooks/use-app';

interface RecentEntry {
  seq?: number;
  ts: number;
  level: string;
  code: string;
}

/** Developer tools behind `?debug=1` (§8.17). English only: not product UI. */
export default function DebugTools() {
  const diagnostics = useDiagnostics();
  const { recent: loadRecent } = diagnostics;
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  useEffect(() => {
    void loadRecent(15).then(setRecent);
  }, [loadRecent]);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Developer tools</h2>
      <div className="flex flex-col gap-2">
        <Link
          to="/debug/alerts"
          className="flex min-h-target items-center font-semibold text-primary"
        >
          Timer alert harness (S-1)
        </Link>
        <Link
          to="/debug/capabilities"
          className="flex min-h-target items-center font-semibold text-primary"
        >
          Capability probe (S-2)
        </Link>
        <Link
          to="/debug/body-map"
          className="flex min-h-target items-center font-semibold text-primary"
        >
          Body map demo (S-5)
        </Link>
        <Link
          to="/debug/charts"
          className="flex min-h-target items-center font-semibold text-primary"
        >
          Charts (S-4)
        </Link>
        <Link
          to="/debug/perf"
          className="flex min-h-target items-center font-semibold text-primary"
        >
          Performance (reference dataset)
        </Link>
        <Button onClick={() => void diagnostics.exportToFile()}>Export diagnostics</Button>
        <Button variant="danger" onClick={() => void diagnostics.resetAppFiles()}>
          Reset app files (keeps data)
        </Button>
      </div>
      <h3 className="font-semibold">Recent diagnostics</h3>
      <ol data-testid="diagnostics-recent" className="text-xs text-fg-muted tabular">
        {recent.map((entry) => (
          <li key={entry.seq}>
            {new Date(entry.ts).toISOString().slice(11, 19)} {entry.level} {entry.code}
          </li>
        ))}
      </ol>
    </Card>
  );
}
