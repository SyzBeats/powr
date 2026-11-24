/**
 * Compiles S-1 device-test records (the `/debug/alerts` harness export, `harnessVersion` 2) into
 * the capability matrix that the app ships (technical concept §8.8.5, V-01, TMR-06, PWA-13).
 *
 * One matrix cell per browser family and major version, platform, display mode, condition
 * (screen locked or app switched), battery saver and variant (A–E). The status rule of the S-1
 * plan, over the runs with rests of at most 5 minutes in which the page was hidden at the end:
 * - **supported:** at least 3 runs and ≥ 95% of them alerted within 2 s ("on time");
 * - **not-supported:** no run alerted at all;
 * - **limited:** everything in between (some alerted, or alerts were late).
 * A cell holds for its major version plus `versionGrace` later majors (default 2, about two
 * months of Chrome releases); after that the app falls back to "Limited (best effort)" until the
 * protocol runs again. Records marked `placeholder: true` compile into rows that the app ignores.
 */

export type Family = 'chrome' | 'samsung' | 'other';
export type Variant = 'A' | 'B' | 'C' | 'D' | 'E';
export type Level = 'supported' | 'limited' | 'not-supported';

export interface RecordRun {
  readonly variant: Variant;
  readonly restMs: number;
  readonly condition: 'locked' | 'switched' | 'visible';
  readonly batterySaver: boolean;
  readonly status: 'running' | 'done' | 'stopped' | 'interrupted';
  readonly outcome: 'on-time' | 'late' | 'missed' | 'visible' | null;
}

export interface DeviceTestRecord {
  readonly file: string;
  readonly device: string;
  readonly placeholder: boolean;
  readonly browser: {
    readonly family: Family;
    readonly major: number;
    readonly platform: 'android' | 'other';
    readonly displayMode: 'standalone' | 'browser';
  };
  readonly runs: readonly RecordRun[];
}

export interface MatrixEntry {
  readonly family: Family;
  readonly minMajor: number;
  readonly maxMajor: number | null;
  readonly platform: 'android' | 'other';
  readonly displayMode: 'standalone' | 'browser';
  readonly condition: 'locked' | 'switched';
  readonly batterySaver: boolean;
  readonly variant: Variant;
  readonly device: string;
  readonly runs: number;
  readonly onTime: number;
  readonly late: number;
  readonly missed: number;
  readonly status: Level;
  readonly placeholder: boolean;
}

export interface CapabilityMatrix {
  readonly matrixVersion: 1;
  readonly generatedBy: string;
  readonly rule: string;
  readonly versionGrace: number;
  readonly records: readonly string[];
  readonly entries: readonly MatrixEntry[];
}

const MAX_REST_MS = 5 * 60 * 1000;
const SUPPORTED_SHARE = 0.95;
const MIN_RUNS_FOR_SUPPORTED = 3;
const DEFAULT_VERSION_GRACE = 2;

const RULE =
  'Runs with rests ≤ 5 min, hidden at the end. Supported: ≥ 3 runs and ≥ 95% alerted within 2 s. ' +
  'Not supported: no run alerted. Limited: otherwise. Placeholder rows never count.';

/** Validates one harness export (JSON, `.txt` or `.json`); throws with the file name. */
export function parseRecord(file: string, text: string): DeviceTestRecord {
  const fail = (message: string): never => {
    throw new Error(`${file}: ${message}`);
  };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('not JSON (export it with "Export results" on /debug/alerts)');
  }
  if (!isObject(data)) return fail('not an object');
  if (data['harnessVersion'] !== 2) {
    return fail(
      `harnessVersion ${String(data['harnessVersion'])}: only version 2 records carry the ` +
        'condition and battery saver of each run (re-run S-1 with the current harness)',
    );
  }
  const device = data['device'];
  if (typeof device !== 'string' || device.trim() === '') return fail('device label missing');
  const browser = data['browser'];
  if (!isObject(browser)) return fail('browser missing');
  const family = oneOf(browser['family'], ['chrome', 'samsung', 'other'] as const);
  const platform = oneOf(browser['platform'], ['android', 'other'] as const);
  const displayMode = oneOf(browser['displayMode'], ['standalone', 'browser'] as const);
  const major = browser['major'];
  if (!family || !platform || !displayMode) return fail('browser family, platform or mode invalid');
  if (typeof major !== 'number' || !Number.isInteger(major) || major <= 0) {
    return fail('browser major version missing (unknown browsers cannot be keyed)');
  }
  const runs = data['runs'];
  if (!Array.isArray(runs)) return fail('runs missing');
  return {
    file,
    device: device.trim(),
    placeholder: data['placeholder'] === true,
    browser: { family, major, platform, displayMode },
    runs: runs.map((run: unknown, index): RecordRun => {
      const bad = (what: string): never => fail(`run ${index + 1}: ${what}`);
      if (!isObject(run)) return bad('not an object');
      const variant = oneOf(run['variant'], ['A', 'B', 'C', 'D', 'E'] as const);
      const condition = oneOf(run['condition'], ['locked', 'switched', 'visible'] as const);
      const status = oneOf(run['status'], ['running', 'done', 'stopped', 'interrupted'] as const);
      const outcome =
        run['outcome'] === null
          ? null
          : oneOf(run['outcome'], ['on-time', 'late', 'missed', 'visible'] as const);
      const restMs = run['restMs'];
      if (!variant) return bad('variant invalid');
      if (!condition) return bad('condition invalid');
      if (!status) return bad('status invalid');
      if (outcome === undefined) return bad('outcome invalid');
      if (typeof restMs !== 'number' || restMs <= 0) return bad('restMs invalid');
      if (typeof run['batterySaver'] !== 'boolean') return bad('batterySaver missing');
      return { variant, condition, status, outcome, restMs, batterySaver: run['batterySaver'] };
    }),
  };
}

/** The S-1 status rule for one cell's counts. */
export function levelOf(counts: { onTime: number; late: number; missed: number }): Level {
  const runs = counts.onTime + counts.late + counts.missed;
  if (counts.onTime + counts.late === 0) return 'not-supported';
  if (runs >= MIN_RUNS_FOR_SUPPORTED && counts.onTime / runs >= SUPPORTED_SHARE) return 'supported';
  return 'limited';
}

export function compileMatrix(
  records: readonly DeviceTestRecord[],
  versionGrace = DEFAULT_VERSION_GRACE,
): CapabilityMatrix {
  const cells = new Map<
    string,
    {
      key: Omit<MatrixEntry, 'device' | 'runs' | 'onTime' | 'late' | 'missed' | 'status'>;
      devices: Set<string>;
      onTime: number;
      late: number;
      missed: number;
    }
  >();
  for (const record of records) {
    for (const run of record.runs) {
      // Only finished measurements: a stopped run proves nothing, a visible page is no test of
      // a hidden alert, and the 8-minute runs only observe freezing.
      if (run.status !== 'done' && run.status !== 'interrupted') continue;
      if (run.condition === 'visible' || run.outcome === 'visible') continue;
      if (run.restMs > MAX_REST_MS) continue;
      const key = {
        family: record.browser.family,
        minMajor: record.browser.major,
        maxMajor: record.browser.major + versionGrace,
        platform: record.browser.platform,
        displayMode: record.browser.displayMode,
        condition: run.condition,
        batterySaver: run.batterySaver,
        variant: run.variant,
        placeholder: record.placeholder,
      };
      const id = JSON.stringify(key);
      const cell = cells.get(id) ?? { key, devices: new Set(), onTime: 0, late: 0, missed: 0 };
      cell.devices.add(record.device);
      if (run.outcome === 'on-time') cell.onTime++;
      else if (run.outcome === 'late') cell.late++;
      else cell.missed++;
      cells.set(id, cell);
    }
  }
  const entries = [...cells.values()]
    .map((cell): MatrixEntry => ({
      ...cell.key,
      device: [...cell.devices].toSorted().join('; '),
      runs: cell.onTime + cell.late + cell.missed,
      onTime: cell.onTime,
      late: cell.late,
      missed: cell.missed,
      status: levelOf(cell),
    }))
    .toSorted(compareEntries);
  return {
    matrixVersion: 1,
    generatedBy: 'tools/capability-matrix (pnpm capability-matrix)',
    rule: RULE,
    versionGrace,
    records: records.map((record) => record.file).toSorted(),
    entries,
  };
}

function compareEntries(a: MatrixEntry, b: MatrixEntry): number {
  const order = [
    a.family.localeCompare(b.family),
    a.platform.localeCompare(b.platform),
    a.displayMode.localeCompare(b.displayMode),
    a.minMajor - b.minMajor,
    a.condition.localeCompare(b.condition),
    Number(a.batterySaver) - Number(b.batterySaver),
    a.variant.localeCompare(b.variant),
    Number(a.placeholder) - Number(b.placeholder),
  ];
  return order.find((value) => value !== 0) ?? 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  options: T,
): T[number] | undefined {
  return options.find((option) => option === value);
}
