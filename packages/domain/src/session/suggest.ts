/**
 * Set suggestions in the session (PRG-03…08, WKT-07): every pending set is pre-filled with a
 * load, reps and an effort target, each explained. In order:
 * 1. fixed values: warm-up steps, timed sets, a load the plan fixes or the user set (WKT-09);
 * 2. in the session, after a working set of the slot: back-offs from the top set's e1RM, and in
 *    RPE mode (and during calibration) the next set from the last set's e1RM when its RIR missed
 *    the target (PRG-05 in-session autoregulation); otherwise the last set's load;
 * 3. the first working set from the history: manual mode (last performance), calibration
 *    (PRG-08: RIR 3–4, no load or a load from the first exposure), double progression (PRG-04),
 *    linear with the stall rule (PRG-06) or RPE loading from the current e1RM (PRG-05);
 * 4. deload and return-from-break loads at their percentage of the normal load (PRG-11/13).
 * Every load is rounded to the user's equipment (WKT-07), in the implement's unit.
 */
import { loadForTarget, type LoadTarget } from '../e1rm';
import { explain, explained, type Explained, type Explanation } from '../explain';
import { roundToAchievable, roundingExplanation, type Implement } from '../loading';
import type { ExerciseDef, LoggedSet, PlannedSet, RirRange, SessionExercise } from '../model';
import {
  bodyRegionOf,
  percentLoad,
  suggestBackoff,
  suggestDoubleProgression,
  suggestLinear,
  type LoadSuggestion,
} from '../progression';
import type { RuleSet } from '../rules';
import { toLocalDate, weekStartOf } from '../time';
import { toKg, type Mass } from '../units';
import { calibrationStatus, currentE1rm, type ExerciseState } from './history';
import { doneWorkingSets, isWorking, plannedSetOf, slotOf } from './slots';
import type { ExerciseEquipment, SessionContext, SessionState, SetSuggestion } from './types';

const mid = (range: readonly [number, number]) => (range[0] + range[1]) / 2;
const half = (value: number) => Math.round(value * 2) / 2;

/** The reps a range pre-fills (its middle, rounded). */
export function prefillReps(range: readonly [number, number] | null): number | null {
  return range === null ? null : Math.round(mid(range));
}

/** The RIR a range pre-fills (its middle, in half steps). */
export function prefillRir(range: RirRange | null): number | null {
  return range === null ? null : half(mid(range));
}

/** Exercises the e1RM engine cannot load (bands, timed work, pure bodyweight). */
export function loadless(exercise: ExerciseDef): boolean {
  const { type, bodyweightLoaded } = exercise.load;
  return (
    type === 'band' ||
    type === 'timed' ||
    ((type === 'bodyweightAdded' || type === 'bodyweightAssisted') && !bodyweightLoaded)
  );
}

/** The implement suggestions are rounded to; a plain 0.5 kg step without an equipment profile. */
export function implementOf(equipment: ExerciseEquipment, exercise: ExerciseDef): Implement {
  return (
    equipment.implement ??
    (exercise.load.increment
      ? {
          kind: 'steps',
          unit: exercise.load.increment.unit,
          start: 0,
          step: exercise.load.increment.value,
        }
      : { kind: 'steps', unit: 'kg', start: 0, step: 0.5 })
  );
}

type Model = 'doubleProgression' | 'rpe' | 'linear';

/** How the first working set is loaded: RPE for top/back-off and percent work, else the slot's model. */
function modelOf(slot: SessionExercise): Model {
  const mode = slot.prescription?.mode;
  if (mode === 'topBackoff' || mode === 'percent' || mode === 'rpe') return 'rpe';
  if (slot.progression === 'linear') return 'linear';
  if (slot.progression === 'rpe' || slot.progression === 'apre') return 'rpe';
  return 'doubleProgression';
}

interface Base {
  readonly slotKey: string;
  readonly setKey: string;
  readonly planned: PlannedSet;
}

function suggestion(
  base: Base,
  values: Partial<SetSuggestion> & Pick<SetSuggestion, 'basis'>,
): SetSuggestion {
  const { planned } = base;
  return {
    slotKey: base.slotKey,
    setKey: base.setKey,
    type: planned.type,
    load: null,
    reps: prefillReps(planned.reps),
    repRange: planned.reps,
    rir: prefillRir(planned.rir),
    rirRange: planned.rir,
    durationS: planned.durationS ?? null,
    ...(planned.technique ? { technique: planned.technique } : {}),
    rounding: null,
    ...values,
  };
}

/** The suggestion for one planned set of the session; null for an unknown slot or set. */
export function suggestSet(
  state: SessionState,
  slotKey: string,
  setKey: string,
  ctx: SessionContext,
): Explained<SetSuggestion> | null {
  const slot = slotOf(state.session, slotKey);
  const planned = slot && plannedSetOf(slot, setKey);
  if (!slot || !planned) return null;
  const base: Base = { slotKey, setKey, planned };
  const exercise = ctx.exercise(slot.exerciseId);
  const equipment = ctx.equipment(slot.exerciseId);
  const implement = exercise ? implementOf(equipment, exercise) : null;

  // 1. Fixed values.
  if (planned.type === 'warmup' || planned.durationS !== undefined || planned.load !== null) {
    const rounding =
      planned.load && implement && planned.load.value >= 0
        ? roundToAchievable(planned.load, implement, 'nearestTiesDown')
        : null;
    const kind =
      planned.type === 'warmup' ? 'warmup' : planned.durationS !== undefined ? 'timed' : 'pinned';
    return explained(
      suggestion(base, {
        load: planned.load,
        basis: planned.type === 'warmup' ? 'warmup' : 'fixed',
        rounding: rounding?.exact ? rounding : null,
      }),
      'session.fixed',
      {
        args: {
          kind,
          load: planned.load ? { mass: planned.load } : null,
          durationS: planned.durationS ?? null,
          reps: prefillReps(planned.reps),
        },
      },
    );
  }
  if (!exercise || !implement) {
    return explained(suggestion(base, { basis: 'none' }), 'session.lastTime', {
      args: { mode: 'none' },
    });
  }
  const rules = ctx.rules(slot.exerciseId);
  const history = ctx.history(slot.exerciseId);

  // 2. In the session.
  const done = doneWorkingSets(state, slotKey);
  if (done.length > 0 && isWorking(planned)) {
    const inSession = suggestInSession(
      state,
      slot,
      base,
      exercise,
      rules,
      equipment,
      implement,
      ctx,
      done,
    );
    if (inSession) return inSession;
  }

  // 3. From the history.
  const fromHistory = suggestFromHistory(
    slot,
    base,
    exercise,
    rules,
    equipment,
    implement,
    history,
    ctx,
  );
  return withLoadPct(fromHistory, slot, implement, equipment);
}

function suggestInSession(
  state: SessionState,
  slot: SessionExercise,
  base: Base,
  exercise: ExerciseDef,
  rules: RuleSet,
  equipment: ExerciseEquipment,
  implement: Implement,
  ctx: SessionContext,
  done: readonly LoggedSet[],
): Explained<SetSuggestion> | null {
  const last = done.at(-1)!;
  const targetRir = prefillRir(base.planned.rir);
  const targetReps = prefillReps(base.planned.reps);
  if (loadless(exercise)) {
    return explained(suggestion(base, { load: last.load, basis: 'lastTime' }), 'session.lastTime', {
      args: { mode: 'previousSet', load: last.load ? { mass: last.load } : null },
    });
  }
  const tolerance = { implement, mode: equipment.mode };
  const target = {
    ...tolerance,
    ...(equipment.bodyweight ? { bodyweight: equipment.bodyweight } : {}),
  };
  const model = modelOf(slot);
  const calibrating = calibrationStatus(ctx.history(slot.exerciseId), rules) !== 'calibrated';

  // Back-offs follow the top set's e1RM (PRG-05).
  const top = done.find((set) => set.type === 'top');
  if (base.planned.type === 'backoff' && top && targetReps !== null && targetRir !== null) {
    const backoff = suggestBackoff(
      {
        topSet: top,
        exercise: exercise.load,
        backoff: { reps: targetReps, rir: targetRir },
        bodyweightKg: ctx.bodyweightKg,
      },
      target,
      rules,
    );
    if (backoff.value) return fromLoadSuggestion(base, backoff, 'autoregulated');
  }

  // RPE mode and calibration: the next set from the last set's e1RM when its RIR missed.
  const lastRir = last.effort.source === 'entered' ? last.effort.rir : null;
  const range = calibrating ? calibrationRange(rules) : rangeOfSet(slot, last);
  const nextRir = calibrating ? prefillRir(calibrationRange(rules)) : targetRir;
  const missed = lastRir !== null && range !== null && !withinRange(lastRir, range);
  const autoregulate = (model === 'rpe' && missed) || (calibrating && lastRir !== null);
  if (autoregulate && targetReps !== null && nextRir !== null) {
    const autoregulated = suggestBackoff(
      {
        topSet: last,
        exercise: exercise.load,
        backoff: { reps: targetReps, rir: nextRir },
        bodyweightKg: ctx.bodyweightKg,
      },
      target,
      rules,
    );
    if (autoregulated.value) {
      const result = fromLoadSuggestion(base, autoregulated, 'autoregulated');
      return calibrating
        ? { ...result, value: { ...result.value, rir: nextRir, rirRange: calibrationRange(rules) } }
        : result;
    }
  }
  return explained(
    suggestion(base, {
      load: last.load,
      basis: 'progression',
      ...(model === 'doubleProgression' || model === 'linear' ? { reps: targetReps } : {}),
    }),
    'session.lastTime',
    { args: { mode: 'previousSet', load: last.load ? { mass: last.load } : null } },
  );
}

function calibrationRange(rules: RuleSet): RirRange {
  const { targetRir } = rules['progression.calibration'].value;
  return [targetRir.min, targetRir.max];
}

function rangeOfSet(slot: SessionExercise, set: LoggedSet): RirRange | null {
  return set.setKey === undefined ? null : (plannedSetOf(slot, set.setKey)?.rir ?? null);
}

function withinRange(value: number, range: RirRange): boolean {
  return value >= range[0] && value <= range[1];
}

function suggestFromHistory(
  slot: SessionExercise,
  base: Base,
  exercise: ExerciseDef,
  rules: RuleSet,
  equipment: ExerciseEquipment,
  implement: Implement,
  history: ExerciseState | null,
  ctx: SessionContext,
): Explained<SetSuggestion> {
  const { planned } = base;
  const reps = prefillReps(planned.reps);
  const manual =
    slot.progression === 'manual' ||
    ctx.preferences.exercises.some((entry) => entry.exerciseId === slot.exerciseId && entry.manual);
  const last = history?.last ?? null;
  const position = Math.max(
    0,
    slot.sets.filter(isWorking).findIndex((set) => set.key === base.setKey),
  );
  const lastDone = last?.sets.filter((set) => set.state === 'done') ?? [];
  const lastAt = lastDone[Math.min(position, lastDone.length - 1)];

  // Manual mode and load-less work follow the last performance (PRG-03, A-19).
  if (loadless(exercise) || manual) {
    if (!lastAt) {
      return explained(suggestion(base, { basis: 'none' }), 'session.lastTime', {
        args: { mode: 'none' },
      });
    }
    const top = planned.reps?.[1] ?? null;
    const repsUp =
      loadless(exercise) && !manual && lastAt.reps !== null
        ? top === null
          ? lastAt.reps + 1
          : Math.min(top, Math.max(planned.reps?.[0] ?? 0, lastAt.reps + 1))
        : lastAt.reps;
    return explained(
      suggestion(base, { load: lastAt.load, reps: repsUp, basis: 'lastTime' }),
      'session.lastTime',
      {
        args: {
          mode: manual ? 'manual' : 'repsUp',
          load: lastAt.load ? { mass: lastAt.load } : null,
          reps: repsUp,
          date: last?.localDate ?? null,
        },
      },
    );
  }

  // PRG-04/06 run from the last performance: the first exposure (the user's pick at the
  // calibration RIR) is their calibration.
  const model = modelOf(slot);
  const rir = prefillRir(planned.rir);
  const lastWorking = lastDone.filter((set) => set.type !== 'warmup');

  if (model === 'doubleProgression' && planned.reps && lastWorking.length > 0) {
    const dp = suggestDoubleProgression(
      {
        lastSets: lastWorking.map((set) => ({
          type: set.type,
          state: set.state,
          load: set.load,
          reps: set.reps,
          effort: set.effortKnown
            ? { rir: set.rir, source: 'entered' }
            : { rir: null, source: 'none' },
        })),
        repRange: planned.reps,
        targetRir: planned.rir?.[0] ?? 0,
      },
      { implement, mode: equipment.mode },
      rules,
    );
    if (dp.value) return fromLoadSuggestion(base, dp, 'progression');
  }

  if (model === 'linear' && reps !== null && lastWorking.length > 0) {
    const lastLoad = heaviest(lastWorking);
    if (lastLoad) {
      const sameWeek =
        ctx.level !== 'novice' &&
        last !== null &&
        weekStartOf(last.localDate) === weekStartOf(toLocalDate(ctx.now));
      if (sameWeek) {
        return explained(
          suggestion(base, { load: lastLoad, reps, basis: 'progression' }),
          'progression.linear.weekHold',
          { args: { load: { mass: lastLoad } } },
        );
      }
      const linear = suggestLinear(
        {
          lastLoad,
          reps,
          recentSessions: history?.linear ?? [],
          level: ctx.level,
          region: bodyRegionOf(exercise.pattern),
        },
        { implement, mode: equipment.mode },
        rules,
      );
      return fromLoadSuggestion(base, linear, 'progression');
    }
  }

  const status = calibrationStatus(history, rules);
  const e1rm = currentE1rm(history);
  const calibration = rules['progression.calibration'];
  const target = {
    implement,
    mode: equipment.mode,
    ...(equipment.bodyweight ? { bodyweight: equipment.bodyweight } : {}),
  };

  // PRG-08: calibrate when no reliable e1RM exists.
  if (status !== 'calibrated' || e1rm === null) {
    const rirRange: RirRange = [calibration.value.targetRir.min, calibration.value.targetRir.max];
    const calibrationRir = prefillRir(rirRange);
    const loaded =
      e1rm !== null && reps !== null && calibrationRir !== null
        ? loadForTarget(
            {
              e1rmKg: e1rm,
              reps,
              rir: calibrationRir,
              exercise: exercise.load,
              bodyweightKg: ctx.bodyweightKg,
            },
            target,
            rules,
          )
        : null;
    return explained(
      suggestion(base, {
        load: loaded?.value?.load ?? null,
        rir: calibrationRir,
        rirRange,
        basis: 'calibration',
        rounding: loaded?.value?.rounding ?? null,
      }),
      'session.calibration',
      {
        args: {
          status,
          exposures: history?.exposures ?? 0,
          exposuresMin: calibration.value.exposures.min,
          exposuresMax: calibration.value.exposures.max,
          rirMin: calibration.value.targetRir.min,
          rirMax: calibration.value.targetRir.max,
          load: loaded?.value ? { mass: loaded.value.load } : null,
        },
        params: [calibration, rules['progression.calibration.reliableSetWeight']],
        children: loaded ? [loaded.why] : [],
      },
    );
  }

  // PRG-05: load from the current e1RM (also the fallback without a usable last exposure).
  if (slot.prescription?.mode === 'percent' && reps !== null) {
    const percent = percentLoad(
      { baseKg: e1rm, pct: slot.prescription.pct, reps },
      { implement, mode: equipment.mode },
    );
    return fromLoadSuggestion(base, percent, 'progression');
  }
  const targetReps = model === 'doubleProgression' && planned.reps ? planned.reps[0] : reps;
  if (targetReps === null || rir === null) {
    return explained(suggestion(base, { basis: 'none' }), 'session.lastTime', {
      args: { mode: 'none' },
    });
  }
  const loaded = loadForTarget(
    {
      e1rmKg: e1rm,
      reps: targetReps,
      rir,
      exercise: exercise.load,
      bodyweightKg: ctx.bodyweightKg,
    },
    target,
    rules,
  );
  return fromTarget(base, loaded, targetReps, rir);
}

function heaviest(sets: readonly { readonly load: Mass | null }[]): Mass | null {
  let best: Mass | null = null;
  for (const set of sets) {
    if (set.load && (best === null || toKg(set.load) > toKg(best))) best = set.load;
  }
  return best;
}

function fromLoadSuggestion(
  base: Base,
  explainedSuggestion: Explained<LoadSuggestion | null>,
  basis: SetSuggestion['basis'],
): Explained<SetSuggestion> {
  const value = explainedSuggestion.value;
  return {
    value: suggestion(base, {
      load: value?.load ?? null,
      reps: value?.reps ?? prefillReps(base.planned.reps),
      basis: value ? basis : 'none',
      rounding: value?.rounding ?? null,
    }),
    why: explainedSuggestion.why,
  };
}

function fromTarget(
  base: Base,
  target: Explained<LoadTarget | null>,
  reps: number,
  rir: number,
): Explained<SetSuggestion> {
  return explained(
    suggestion(base, {
      load: target.value?.load ?? null,
      reps,
      rir,
      basis: target.value ? 'progression' : 'none',
      rounding: target.value?.rounding ?? null,
    }),
    'progression.rpe.load',
    {
      args: { reps, rir, load: target.value ? { mass: target.value.load } : null },
      children: [target.why],
    },
  );
}

/** PRG-11/13: the load at the slot's percentage of the normal load (the range's middle). */
function withLoadPct(
  suggested: Explained<SetSuggestion>,
  slot: SessionExercise,
  implement: Implement,
  equipment: ExerciseEquipment,
): Explained<SetSuggestion> {
  const { value } = suggested;
  if (!slot.loadPct || !value.load || value.load.value <= 0) return suggested;
  if (value.basis !== 'progression' && value.basis !== 'lastTime') return suggested;
  const pct = mid([slot.loadPct.min, slot.loadPct.max]);
  const target = { value: (value.load.value * pct) / 100, unit: value.load.unit };
  const rounding = roundToAchievable(target, implement, equipment.mode);
  const load: Mass = { value: rounding.chosen?.load ?? rounding.target, unit: rounding.unit };
  const why: Explanation = explain('session.adjustment.load', {
    args: {
      pct,
      pctMin: slot.loadPct.min,
      pctMax: slot.loadPct.max,
      from: { mass: value.load },
      load: { mass: load },
    },
    children: [suggested.why, roundingExplanation(rounding)],
  });
  return { value: { ...value, load, rounding }, why };
}
