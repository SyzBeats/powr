import { Trans, useLingui } from '@lingui/react/macro';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import type { Mass, RoundingMode } from '@powr/domain';
import {
  barbellTotal,
  implementUnit,
  nextLoadAbove,
  roundToAchievable,
  type Implement,
  type LoadOption,
} from '@powr/domain/loading';

import { Button } from '#ui/button';
import { Sheet } from '#ui/sheet';

import { formatMass } from '../../i18n/format';

/** The implement an exercise's loads are rounded to, and the rounding direction (WKT-07). */
export interface LoadImplement {
  readonly implement: Implement;
  readonly mode: RoundingMode;
}

const FALLBACK_STEP = 2.5;

/**
 * WKT-03 "steppers sized to the exercise's increment (EQP-03)": one step is the next achievable
 * load of the equipment up or down (a 1.25 kg pair, the next dumbbell, the next stack plate).
 * Without equipment data, 2.5 steps.
 */
export function useLoadSteps(
  implement: LoadImplement | null,
  unit: Mass['unit'],
): (direction: -1 | 1, current: number | null) => number | null {
  return (direction, current) => {
    if (!implement) {
      if (current === null) return direction > 0 ? FALLBACK_STEP : null;
      const next = Math.round((current + direction * FALLBACK_STEP) * 100) / 100;
      return next < 0 ? null : next;
    }
    const tool = implement.implement;
    if (direction > 0) {
      if (current === null)
        return roundToAchievable({ value: 0, unit }, tool, 'up').chosen?.load ?? null;
      return nextLoadAbove({ value: current, unit }, tool).chosen?.load ?? null;
    }
    if (current === null || current <= 0) return null;
    const below = roundToAchievable({ value: current - 0.005, unit }, tool, 'down').chosen;
    return below && below.load < current ? below.load : null;
  };
}

/**
 * WKT-07: the plate calculator for the current load: the plates per side, heaviest first; a load
 * the plates cannot make shows the nearest loads below and above to pick from. The reverse mode
 * adds the plates the user put on the bar and gives the total.
 */
export function PlatesButton({
  implement,
  load,
  onUse,
}: {
  implement: LoadImplement;
  load: number;
  onUse: (load: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Trans>Plates</Trans>
      </Button>
      {open ? (
        <PlatesSheet
          implement={implement}
          load={load}
          onClose={() => setOpen(false)}
          onUse={(next) => {
            onUse(next);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function PlatesSheet({
  implement,
  load,
  onClose,
  onUse,
}: {
  implement: LoadImplement;
  load: number;
  onClose: () => void;
  onUse: (load: number) => void;
}) {
  const { t } = useLingui();
  const tool = implement.implement;
  const unit = implementUnit(tool);
  const rounding = roundToAchievable({ value: load, unit }, tool, implement.mode);
  const [reverse, setReverse] = useState<Readonly<Record<string, number>>>({});
  if (tool.kind !== 'barbell') return null;
  const bar = formatMass(tool.bar.weight, tool.bar.unit);
  const target = formatMass(load, unit);
  const total = barbellTotal(
    tool.bar,
    tool.plates,
    tool.plates.plates.flatMap((plate) =>
      Array.from({ length: reverse[String(plate.weight)] ?? 0 }, () => plate.weight),
    ),
    tool.collarWeight ?? 0,
  );
  const option = (entry: LoadOption | null) =>
    entry ? (
      <Button onClick={() => onUse(entry.load)}>
        <Trans>Use {formatMass(entry.load, unit)}</Trans>
      </Button>
    ) : null;
  return (
    <Sheet
      open
      onOpenChange={(isOpen) => (isOpen ? null : onClose())}
      title={t`Plates for ${target}`}
      closeLabel={t`Close`}
    >
      <p className="text-fg-muted">
        <Trans>Bar {bar}. Plates per side, heaviest first.</Trans>
      </p>
      {rounding.exact && rounding.chosen ? (
        <p className="text-xl font-bold" data-testid="plates-per-side">
          {rounding.chosen.perSide && rounding.chosen.perSide.length > 0 ? (
            rounding.chosen.perSide.map((plate) => formatMass(plate, unit)).join(' + ')
          ) : (
            <Trans>Just the bar</Trans>
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-2" data-testid="plates-not-loadable">
          <p className="font-semibold">
            <Trans>{target} cannot be loaded with your plates.</Trans>
          </p>
          <div className="flex flex-wrap gap-2">
            {option(rounding.below)}
            {option(rounding.above)}
          </div>
        </div>
      )}
      <h3 className="text-lg font-semibold">
        <Trans>What is on the bar?</Trans>
      </h3>
      <p className="text-sm text-fg-muted">
        <Trans>Add the plates of one side to get the total.</Trans>
      </p>
      <ul className="flex flex-col gap-2">
        {tool.plates.plates.map((plate) => {
          const key = String(plate.weight);
          const count = reverse[key] ?? 0;
          const name = formatMass(plate.weight, unit);
          return (
            <li key={key} className="flex items-center gap-2">
              <span className="flex-1 font-medium">
                <Trans>
                  {name} × {count}
                </Trans>
              </span>
              <button
                type="button"
                aria-label={t`One ${name} plate less per side`}
                disabled={count === 0}
                onClick={() => setReverse((current) => ({ ...current, [key]: count - 1 }))}
                className="flex size-target items-center justify-center rounded-xl border border-control disabled:opacity-50"
              >
                <Minus aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t`One ${name} plate more per side`}
                disabled={count >= plate.pairs}
                onClick={() => setReverse((current) => ({ ...current, [key]: count + 1 }))}
                className="flex size-target items-center justify-center rounded-xl border border-control disabled:opacity-50"
              >
                <Plus aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-lg font-bold" aria-live="polite">
        <Trans>Total: {formatMass(total, unit)}</Trans>
      </p>
      <Button onClick={() => onUse(total)}>
        <Trans>Use this total</Trans>
      </Button>
    </Sheet>
  );
}
