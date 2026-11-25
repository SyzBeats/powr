import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import type { RuleId } from '@powr/domain/explain';

/** English "Why?" texts (TD-28, PRG-09). `simple`: plain-language first for novices (NFR-USE-03). */
export interface WhyMessage {
  readonly full: MessageDescriptor;
  readonly simple?: MessageDescriptor;
}

/*
 * One entry per rule (`args.ts` lists the values each one may use; `format.ts` converts them).
 * Tone (MOT-10, PLN-04): plain and encouraging, "low expected return per extra set" or "consider
 * another day", rest and deloads as part of training; no medical claims (LEG-07). Validation
 * texts state the problem so that the fixes shown below them read as the answer (NFR-USE-04).
 * Messages that several producers share (deload.week, break.return.*, schedule.missed.merge,
 * deload.reactive.propose, plan.mesocycle) only use the values all of them pass, or select on one.
 */
export const WHY_MESSAGES: { readonly [K in RuleId]: WhyMessage } = {
  // --- Loads and e1RM ------------------------------------------------------------------------
  'loading.round': {
    full: msg({
      id: 'why.loading.round',
      message:
        "{reason, select, exact {{target} can be loaded exactly with your equipment.} notLoadable {{target} can't be loaded exactly with your equipment. The nearest loads are {below} and {above}, so the suggestion uses {chosen}.} belowMin {{target} is below the lightest load your equipment allows, so the suggestion uses {chosen}.} aboveMax {{target} is above the heaviest load your equipment allows, so the suggestion uses {chosen}.} nothingLoadable {Your equipment profile has no load that fits this exercise. Check its plates, dumbbells or machine steps.} other {The suggestion uses {chosen}, the load closest to {target} that your equipment allows.}}{mixedUnits, select, yes { Your bar and plates use different units, so the total was converted.} other {}}",
    }),
    simple: msg({
      id: 'why.loading.round.simple',
      message:
        "{reason, select, exact {You can set up exactly {target}.} notLoadable {You can't make exactly {target} with your equipment, so we picked {chosen}, the closest you can load.} belowMin {{target} is lighter than anything your equipment allows, so start with {chosen}.} aboveMax {{target} is heavier than your equipment allows, so use {chosen}.} nothingLoadable {Your equipment list has no weights for this exercise. Check your plates, dumbbells or machine settings.} other {We picked {chosen}, the closest load you can set up.}}",
    }),
  },
  'e1rm.set': {
    full: msg({
      id: 'why.e1rm.set',
      message:
        'Estimated 1-rep max (e1RM) from this set: {e1rm}. With {rir, plural, one {# rep} other {# reps}} in reserve (RIR), the set counts like {reff, number} reps to failure, about {pct, number, percent} of your max.',
    }),
  },
  'e1rm.set.unknownEffort': {
    full: msg({
      id: 'why.e1rm.set.unknownEffort',
      message:
        'No reps in reserve (RIR) were logged for this set, so POWR assumed {rir}. Estimated 1-rep max (e1RM): {e1rm}. The set counts less than sets with logged effort, so log RIR when you can.',
    }),
  },
  'e1rm.set.excluded': {
    full: msg({
      id: 'why.e1rm.set.excluded',
      message:
        "{reason, select, skipped {Skipped sets are not used to estimate your 1-rep max (e1RM).} warmup {Warm-up sets are not used to estimate your 1-rep max (e1RM).} timedSet {Timed sets have no load and reps, so they are not used to estimate your 1-rep max (e1RM).} loadType {This exercise's load type can't be used to estimate a 1-rep max (e1RM).} pureBodyweight {Bodyweight-only sets are not used to estimate a 1-rep max (e1RM).} missingValues {This set is missing its load or reps, so it can't be used to estimate a 1-rep max (e1RM).} noBodyweight {This exercise counts your bodyweight, and none is logged yet. Log your bodyweight to include this set.} nonPositiveLoad {The total load of this set is zero or less, so it can't be used to estimate a 1-rep max (e1RM).} undefinedCurve {The reps and reps in reserve of this set are outside the range the estimate covers, so it is not used.} tooManyReps {This set had too many reps (or reps in reserve) for a reliable estimate, so it is not used.} other {This set is not used to estimate your 1-rep max (e1RM).}}",
    }),
  },
  'e1rm.baseline': {
    full: msg({
      id: 'why.e1rm.baseline',
      message:
        '{kind, select, oneRepMax {Your known 1-rep max, {e1rm}, is your starting estimated max (e1RM).} other {This set gives a starting estimated 1-rep max (e1RM) of {e1rm}, worked out like any set you log.}} The loads of your first sessions come from it. {old, select, yes {It was lifted {ageDays, plural, one {# day} other {# days}} ago, so POWR refines it from the sets you log.} other {POWR refines it from the sets you log.}}',
    }),
  },
  'e1rm.baseline.none': {
    full: msg({
      id: 'why.e1rm.baseline.none',
      message:
        'Without a starting point, POWR calibrates: in the first {exposuresMin}–{exposuresMax} sessions with each exercise, you stop with {rirMin}–{rirMax} reps in reserve (RIR) and pick a load you can control. Your estimated max (e1RM) comes from those sets, and the loads follow it from then on.',
    }),
  },
  'e1rm.session': {
    full: msg({
      id: 'why.e1rm.session',
      message:
        '{e1rm, select, none {No set from this session could be used to estimate your 1-rep max (e1RM).} other {Session e1RM: {e1rm}, from the most reliable of {candidates, plural, one {# usable set} other {# usable sets}}. Sets with fewer reps, taken closer to failure, count the most.}}',
    }),
  },
  'e1rm.loadForTarget': {
    full: msg({
      id: 'why.e1rm.loadForTarget',
      message:
        '{load, select, none {No load can be worked out for {targetReps, plural, one {# rep} other {# reps}} with {targetRir, plural, one {# rep} other {# reps}} in reserve (RIR): the target is outside the range the estimate covers, or this bodyweight exercise needs your bodyweight logged.} other {For {targetReps, plural, one {# rep} other {# reps}} with {targetRir, plural, one {# rep} other {# reps}} in reserve (RIR), you can lift about {pct, number, percent} of your estimated 1-rep max ({total}), so the load is {load}.}}',
    }),
  },

  // --- Strength trend ------------------------------------------------------------------------
  'trend.series': {
    full: msg({
      id: 'why.trend.series',
      message:
        "Your strength trend combines {observations, plural, one {# session estimate} other {# session estimates}}, smoothed so one good or bad day doesn't swing it. How quickly it follows changes is set for {level} lifters.",
    }),
  },
  'trend.change.insufficientData': {
    full: msg({
      id: 'why.trend.change.insufficientData',
      message:
        'Not enough data yet to say whether your strength has changed. A few more sessions of this lift will show the trend.',
    }),
  },
  'trend.change.none': {
    full: msg({
      id: 'why.trend.change.none',
      message:
        "Since {referenceDate}, your estimated max changed by {deltaPct, number}%. {reason, select, unconfirmed {That's more than normal day-to-day variation (about {typicalErrorPct, number}%), but it isn't a confirmed change yet. POWR calls it real once the trend is clear enough and the change holds over a few sessions in a row.} other {That's within normal day-to-day variation (about {typicalErrorPct, number}%), so there's no real change yet.}}",
    }),
  },
  'trend.change.likely': {
    full: msg({
      id: 'why.trend.change.likely',
      message:
        "Since {referenceDate}, your estimated max changed by {deltaPct, number}%, in the same direction over several sessions. {direction, select, down {That's likely a real dip, not day-to-day noise. Dips happen; extra rest or a lighter week often helps.} other {That's likely real progress, beyond day-to-day variation (about {typicalErrorPct, number}%).}}",
    }),
  },
  'trend.change.veryLikely': {
    full: msg({
      id: 'why.trend.change.veryLikely',
      message:
        'Since {referenceDate}, your estimated max changed by {deltaPct, number}%, clearly more than day-to-day variation (about {typicalErrorPct, number}%). {direction, select, down {This is very likely a real dip. Dips happen; extra rest or a lighter week often helps.} other {This is very likely real progress.}}',
    }),
  },

  // --- Progression ---------------------------------------------------------------------------
  'progression.double.topReached': {
    full: msg({
      id: 'why.progression.double.topReached',
      message:
        '{atMaxLoad, select, yes {Every set reached the top of the rep range with at least {targetRir, plural, one {# rep} other {# reps}} in reserve (RIR), but {from} is the heaviest load your equipment allows. Stay at {from} and aim for {reps, plural, one {# rep} other {# reps}}.} other {Every set reached the top of the rep range with at least {targetRir, plural, one {# rep} other {# reps}} in reserve (RIR), so the load goes up from {from} to {to}, the smallest step your equipment allows, and the reps start again at {reps}.}}',
    }),
    simple: msg({
      id: 'why.progression.double.topReached.simple',
      message:
        '{atMaxLoad, select, yes {You hit the top of the rep range on every set. {from} is the heaviest you can load, so stay there and aim for {reps, plural, one {# rep} other {# reps}}.} other {You hit the top of the rep range on every set with reps to spare, so go up to {to} and start again at {reps, plural, one {# rep} other {# reps}}.}}',
    }),
  },
  'progression.double.repsUp': {
    full: msg({
      id: 'why.progression.double.repsUp',
      message:
        'Not every set reached {top, plural, one {# rep} other {# reps}} with {targetRir, plural, one {# rep} other {# reps}} in reserve (RIR) yet. Stay at {load} and aim for {reps, plural, one {# rep} other {# reps}}; once every set reaches {top}, the load goes up.',
    }),
    simple: msg({
      id: 'why.progression.double.repsUp.simple',
      message:
        'Stay at {load} and aim for {reps, plural, one {# rep} other {# reps}}. Once you get {top, plural, one {# rep} other {# reps}} on every set, the weight goes up.',
    }),
  },
  'progression.double.noHistory': {
    full: msg({
      id: 'why.progression.double.noHistory',
      message:
        'No earlier sets with a load for this exercise yet. Choose a load you can lift for the bottom of the rep range with a few reps in reserve (RIR); next time POWR builds on it.',
    }),
    simple: msg({
      id: 'why.progression.double.noHistory.simple',
      message:
        "First time with this exercise. Pick a weight that leaves a few reps in the tank; next time we'll build on it.",
    }),
  },
  'progression.rpe.load': {
    full: msg({
      id: 'why.progression.rpe.load',
      message:
        '{load, select, none {No load can be suggested for {reps, plural, one {# rep} other {# reps}} with {rir, plural, one {# rep} other {# reps}} in reserve (RIR) yet. Choose a load yourself; your logged sets will refine the estimate.} other {{load} for {reps, plural, one {# rep} other {# reps}} should leave about {rir, plural, one {# rep} other {# reps}} in reserve (RIR), based on your estimated 1-rep max (e1RM).}}',
    }),
  },
  'progression.rpe.backoff': {
    full: msg({
      id: 'why.progression.rpe.backoff',
      message:
        "{reason, select, noEffort {Log the reps in reserve (RIR) of your top set to adjust the back-off sets; until then they stay as planned.} noEstimate {Today's top set can't be used for an estimate, so the back-off sets stay as planned.} other {Your top set today, with {topSetRir, plural, one {# rep} other {# reps}} in reserve, puts your estimated 1-rep max at {todayE1rm}. The back-off sets use it: {reps, plural, one {# rep} other {# reps}} with {rir, plural, one {# rep} other {# reps}} in reserve (RIR).}}",
    }),
  },
  'progression.apre.session': {
    full: msg({
      id: 'why.progression.apre.session',
      message:
        'APRE: ramp-up sets at lighter percentages of your 6-rep max ({sixRm}), then as many reps as you can at {sixRm}. Your reps on that set decide the load of the last set.',
    }),
  },
  'progression.apre.adjust': {
    full: msg({
      id: 'why.progression.apre.adjust',
      message:
        'You did {amrapReps, plural, one {# rep} other {# reps}} on the all-out set, so your 6-rep max moves from {from} to {to}.',
    }),
  },
  'progression.linear.increase': {
    full: msg({
      id: 'why.progression.linear.increase',
      message:
        'Last session went as planned, so the load goes up by {increment}, from {from} to {to}: the usual step for {level} lifters, rounded up to a load you can set up.',
    }),
    simple: msg({
      id: 'why.progression.linear.increase.simple',
      message: 'You got all your reps last time, so add {increment}: {to} today.',
    }),
  },
  'progression.linear.retry': {
    full: msg({
      id: 'why.progression.linear.retry',
      message:
        "Not all reps were reached last session, so repeat {load} and try again. That's a normal part of progressing.",
    }),
    simple: msg({
      id: 'why.progression.linear.retry.simple',
      message: 'Not all reps last time. That happens: try {load} again today.',
    }),
  },
  'progression.linear.stallReset': {
    full: msg({
      id: 'why.progression.linear.stallReset',
      message:
        '{failedSessions, plural, one {# session} other {# sessions in a row}} missed the target reps at this load, so it resets by {resetPct, number}%, from {from} to {to}, and builds up again from there.',
    }),
    simple: msg({
      id: 'why.progression.linear.stallReset.simple',
      message:
        'A few tough sessions in a row: step back to {to} and build up again. That is a normal part of getting stronger.',
    }),
  },
  'progression.linear.advancedHold': {
    full: msg({
      id: 'why.progression.linear.advancedHold',
      message:
        'At the advanced level, the load stays the same from session to session. Progress comes from changes in reps, sets and effort across the block.',
    }),
  },
  'progression.percent.load': {
    full: msg({
      id: 'why.progression.percent.load',
      message: '{pct, number}% of {base}, rounded to a load you can set up.',
    }),
  },
  'progression.level.trainingAge': {
    full: msg({
      id: 'why.progression.level.trainingAge',
      message:
        "Your level comes from how long you've trained regularly (about {trainingAgeMonths, plural, one {# month} other {# months}}). Once enough weeks are logged, your actual rate of progress takes over. You can change your level if it doesn't fit.",
    }),
    simple: msg({
      id: 'why.progression.level.trainingAge.simple',
      message:
        "We set your level from how long you've been training. It updates as you log workouts, and you can change it any time.",
    }),
  },
  'progression.level.slope': {
    full: msg({
      id: 'why.progression.level.slope',
      message:
        "Your level comes from how fast your main lifts improve: about {slopePctPerWeek, number}% per week over the last {weeksOfData, plural, one {# week} other {# weeks}}. Fast gains suit simple progression; slower gains need more structure. You can change your level if it doesn't fit.",
    }),
    simple: msg({
      id: 'why.progression.level.slope.simple',
      message:
        "Your level comes from how quickly your main lifts have gone up lately (about {slopePctPerWeek, number}% a week). You can change it if it doesn't feel right.",
    }),
  },

  // --- Warm-up and rest ----------------------------------------------------------------------
  'warmup.heavy': {
    full: msg({
      id: 'why.warmup.heavy',
      message:
        'Heavy work today ({workingLoad} for {workingReps, plural, one {# rep} other {# reps}}), so you ramp up in {steps, plural, one {# warm-up set} other {# warm-up sets}} with few reps each: ready for the heavy sets without tiring yourself.',
    }),
    simple: msg({
      id: 'why.warmup.heavy.simple',
      message:
        'Heavy sets today, so build up in {steps, plural, one {# step} other {# steps}} with only a few reps each. That gets you ready without tiring you out.',
    }),
  },
  'warmup.compound': {
    full: msg({
      id: 'why.warmup.compound',
      message:
        '{steps, plural, one {# warm-up set} other {# warm-up sets}} before {workingLoad}: enough to practise the movement and ramp up for this multi-joint exercise.',
    }),
    simple: msg({
      id: 'why.warmup.compound.simple',
      message:
        'Do {steps, plural, one {# lighter set} other {# lighter sets}} first to practise the movement before {workingLoad}.',
    }),
  },
  'warmup.isolation': {
    full: msg({
      id: 'why.warmup.isolation',
      message:
        '{steps, plural, one {One light set} other {# light sets}} before {workingLoad} to groove the movement; single-joint exercises need little warm-up.',
    }),
    simple: msg({
      id: 'why.warmup.isolation.simple',
      message:
        '{steps, plural, one {One light set} other {# light sets}} first to get the feel of the movement.',
    }),
  },
  'warmup.feeder': {
    full: msg({
      id: 'why.warmup.feeder',
      message:
        "You've already warmed up this movement today, so {steps, plural, one {one quick feeder set is} other {# quick feeder sets are}} enough before {workingLoad}.",
    }),
    simple: msg({
      id: 'why.warmup.feeder.simple',
      message:
        "You're already warm from a similar exercise, so {steps, plural, one {one quick light set is} other {# quick light sets are}} enough.",
    }),
  },
  'warmup.none': {
    full: msg({
      id: 'why.warmup.none',
      message:
        'No warm-up sets needed: {workingLoad} is light enough to start with, or your equipment has no lighter steps.',
    }),
    simple: msg({
      id: 'why.warmup.none.simple',
      message: 'No warm-up needed: you can start right away with {workingLoad}.',
    }),
  },
  'rest.default': {
    full: msg({
      id: 'why.rest.default',
      message:
        '{restClass, select, strength {Rest {seconds, number} seconds: heavy strength sets need longer breaks so you can repeat your best effort.} hypertrophyCompound {{timeSaver, select, yes {Time-saver mode: rest {seconds, number} seconds. You save time and may manage a rep or so less per set.} other {Rest {seconds, number} seconds: enough to recover between hard sets of a multi-joint exercise.}}} hypertrophyIsolation {{timeSaver, select, yes {Time-saver mode: rest {seconds, number} seconds. You save time and may manage a rep or so less per set.} other {Rest {seconds, number} seconds: smaller muscles recover quickly between sets.}}} other {Rest {seconds, number} seconds between working sets.}}',
    }),
    simple: msg({
      id: 'why.rest.default.simple',
      message:
        "Rest about {seconds, number} seconds before your next set. {restClass, select, strength {Heavy sets need longer breaks.} other {That's enough to be ready for another hard set.}}",
    }),
  },

  // --- Volume --------------------------------------------------------------------------------
  'volume.setCredit': {
    full: msg({
      id: 'why.volume.setCredit',
      message:
        '{technique, select, drop {This drop set counts as {credit, plural, one {# set} other {# sets}}: each drop adds part of a set.} restPause {This rest-pause set counts as {credit, plural, one {# set} other {# sets}}: each mini-set adds part of a set.} myoReps {This myo-reps set counts as {credit, plural, one {# set} other {# sets}}: each mini-set adds part of a set.} cluster {A cluster set counts as {credit, plural, one {# set} other {# sets}}: the short breaks inside it add no extra credit.} lengthenedPartials {Lengthened partials count as {credit, plural, one {# set} other {# sets}}.} partialExtension {Partial reps added after the full reps make this set count as {credit, plural, one {# set} other {# sets}}.} other {A hard set: it ended close enough to failure, so it counts as one set toward your weekly volume.}}',
    }),
  },
  'volume.notHardSet': {
    full: msg({
      id: 'why.volume.notHardSet',
      message:
        "{type, select, warmup {Warm-up sets don't count toward your weekly sets.} other {{rir, select, none {This set doesn't count as a hard set: it was skipped or has no effort logged.} other {This set doesn't count as a hard set: with {rir, plural, one {# rep} other {# reps}} in reserve (RIR), it stopped too far from failure.}}}}",
    }),
    simple: msg({
      id: 'why.volume.notHardSet.simple',
      message:
        "{type, select, warmup {Warm-up sets get you ready; they don't count toward your weekly sets.} other {{rir, select, none {This set doesn't count toward your weekly sets: it was skipped or has no effort logged.} other {With {rir, plural, one {# rep} other {# reps}} left in the tank, this set doesn't count as a hard set (a set that ends close to failure). It's still useful practice.}}}}",
    }),
  },
  'volume.muscles': {
    full: msg({
      id: 'why.volume.muscles',
      message:
        "Counted {counted, plural, one {# hard set} other {# hard sets}}. A set counts fully for the muscles an exercise trains directly and partly for the muscles that assist.{unmapped, plural, =0 {} one { # set of an exercise without muscle data isn't counted.} other { # sets of exercises without muscle data aren't counted.}}",
    }),
  },
  'volume.band.belowFloor': {
    full: msg({
      id: 'why.volume.band.belowFloor',
      message:
        '{sets, plural, one {# weekly set} other {# weekly sets}} is below the minimum where muscle growth is reliably seen. A few more sets a week would make the biggest difference.',
    }),
    simple: msg({
      id: 'why.volume.band.belowFloor.simple',
      message:
        '{sets, plural, one {# hard set} other {# hard sets}} a week is too little for this muscle to grow well. Hard sets are sets that end with only a few reps left in the tank. A few more each week would help most.',
    }),
  },
  'volume.band.low': {
    full: msg({
      id: 'why.volume.band.low',
      message:
        '{sets, plural, one {# weekly set} other {# weekly sets}}: enough to progress, but below the usual range for muscle growth. More sets usually bring more growth, up to a point.',
    }),
    simple: msg({
      id: 'why.volume.band.low.simple',
      message:
        '{sets, plural, one {# hard set} other {# hard sets}} a week. That works, and a few more would likely help this muscle grow.',
    }),
  },
  'volume.band.default': {
    full: msg({
      id: 'why.volume.band.default',
      message:
        '{sets, plural, one {# weekly set} other {# weekly sets}}: in the usual range for muscle growth.',
    }),
    simple: msg({
      id: 'why.volume.band.default.simple',
      message:
        '{sets, plural, one {# hard set} other {# hard sets}} a week: a solid amount for growth.',
    }),
  },
  'volume.band.high': {
    full: msg({
      id: 'why.volume.band.high',
      message:
        '{sets, plural, one {# weekly set} other {# weekly sets}}: above the usual range. This can work for experienced lifters, with lower expected return per extra set; watch your recovery.',
    }),
    simple: msg({
      id: 'why.volume.band.high.simple',
      message:
        '{sets, plural, one {# hard set} other {# hard sets}} a week is a lot. Each extra set adds less, so keep an eye on how you recover.',
    }),
  },
  'volume.band.softWarning': {
    full: msg({
      id: 'why.volume.band.softWarning',
      message:
        '{sets, plural, one {# weekly set} other {# weekly sets}}: research shows no clear extra benefit at this volume, so expect low return per extra set. Consider fewer sets for this muscle.',
    }),
    simple: msg({
      id: 'why.volume.band.softWarning.simple',
      message:
        '{sets, plural, one {# hard set} other {# hard sets}} a week is more than research shows a benefit for. Fewer sets would likely work just as well.',
    }),
  },
  'volume.band.hardWarning': {
    full: msg({
      id: 'why.volume.band.hardWarning',
      message:
        '{sets, plural, one {# weekly set} other {# weekly sets}}: beyond the range research has data for. Consider fewer sets for this muscle.',
    }),
    simple: msg({
      id: 'why.volume.band.hardWarning.simple',
      message:
        '{sets, plural, one {# hard set} other {# hard sets}} a week is far beyond what studies have tested. Fewer sets would likely work just as well and leave more energy for recovery.',
    }),
  },
  'volume.sessionCap.within': {
    full: msg({
      id: 'why.volume.sessionCap.within',
      message:
        '{fractional, number} sets for this muscle in one session, counting partial credit ({direct, number} direct): within the range where each set still pays off well.',
    }),
    simple: msg({
      id: 'why.volume.sessionCap.within.simple',
      message:
        '{fractional, number} sets for this muscle in this session: a good amount for one day.',
    }),
  },
  'volume.sessionCap.exceeded': {
    full: msg({
      id: 'why.volume.sessionCap.exceeded',
      message:
        '{fractional, number} sets for this muscle in one session, counting partial credit ({direct, number} direct): above the per-session soft cap, so expect low return per extra set. Consider moving some to another day.',
    }),
    simple: msg({
      id: 'why.volume.sessionCap.exceeded.simple',
      message:
        "That's a lot of sets for one muscle in one session ({fractional, number}). Extra sets add little here; consider another day for some of them.",
    }),
  },

  // --- Scores and bodyweight -----------------------------------------------------------------
  'scoring.wilks': {
    full: msg({
      id: 'why.scoring.wilks',
      message:
        "Wilks score: {value, number}. Your lift times a bodyweight factor ({coefficient, number}), so lifters of different sizes can be compared.{clamped, select, yes { Your bodyweight is outside the formula's range, so the nearest end of the range was used.} other {}}{informal, select, yes { Made for totals; for a single lift it's only a rough guide.} other {}}",
    }),
  },
  'scoring.wilks2020': {
    full: msg({
      id: 'why.scoring.wilks2020',
      message:
        "Wilks2020 score: {value, number}. Your lift times a bodyweight factor ({coefficient, number}), so lifters of different sizes can be compared.{clamped, select, yes { Your bodyweight is outside the formula's range, so the nearest end of the range was used.} other {}}{informal, select, yes { Made for totals; for a single lift it's only a rough guide.} other {}}",
    }),
  },
  'scoring.dots': {
    full: msg({
      id: 'why.scoring.dots',
      message:
        "DOTS score: {value, number}. Your lift times a bodyweight factor ({coefficient, number}), so lifters of different sizes can be compared.{clamped, select, yes { Your bodyweight is outside the formula's range, so the nearest end of the range was used.} other {}}{informal, select, yes { Made for totals; for a single lift it's only a rough guide.} other {}}",
    }),
  },
  'scoring.ipfPoints': {
    full: msg({
      id: 'why.scoring.ipfPoints',
      message:
        '{unsupportedLift, select, squat {IPF Points exist only for the total and the bench press, not for the squat alone.} deadlift {IPF Points exist only for the total and the bench press, not for the deadlift alone.} other {IPF Points: {value, number}. The IPF formula compares lifters across bodyweights and divisions.}}',
    }),
  },
  'scoring.ipfGl': {
    full: msg({
      id: 'why.scoring.ipfGl',
      message:
        '{unsupportedLift, select, squat {IPF GL points exist only for the total and the bench press, not for the squat alone.} deadlift {IPF GL points exist only for the total and the bench press, not for the deadlift alone.} other {IPF GL points: {value, number}. The IPF formula compares lifters across bodyweights and divisions.}}',
    }),
  },
  'scoring.allometric': {
    full: msg({
      id: 'why.scoring.allometric',
      message:
        'Allometric score: {value, number}. Your lift divided by your bodyweight to the power of {exponent, number}, which compares lifters of different sizes more fairly than a simple ratio.',
    }),
  },
  'bodyweight.trend': {
    full: msg({
      id: 'why.bodyweight.trend',
      message:
        "{trend, select, none {Log a few more weigh-ins to start your trend.} other {Your trend smooths the daily ups and downs from water and food across {days, plural, one {# day} other {# days}} of weigh-ins.}}{winsorized, plural, =0 {} one { # unusual reading was capped so it doesn't pull the trend too far.} other { # unusual readings were capped so they don't pull the trend too far.}}",
    }),
  },
  'bodyweight.rate': {
    full: msg({
      id: 'why.bodyweight.rate',
      message:
        'Your weight is changing by about {pctPerWeek, number}% of bodyweight per week, from your weigh-ins over the last {spanDays, plural, one {# day} other {# days}}.',
    }),
  },
  'bodyweight.rate.insufficientData': {
    full: msg({
      id: 'why.bodyweight.rate.insufficientData',
      message:
        'Not enough weigh-ins yet for a weekly rate: {readings, plural, one {# reading} other {# readings}} over {spanDays, plural, one {# day} other {# days}}. A few more over the coming days will show it.',
    }),
  },

  // --- Equipment and exercise ranking --------------------------------------------------------
  'equipment.availability': {
    full: msg({
      id: 'why.equipment.availability',
      message:
        "{available, select, yes {Your equipment covers {exercise}.} other {For {exercise} you need equipment that isn't in your profile: {missing}.}}",
    }),
    simple: msg({
      id: 'why.equipment.availability.simple',
      message:
        "{available, select, yes {You have what you need for {exercise}.} other {For {exercise} you need {missing}, which isn't in your equipment list.}}",
    }),
  },
  'ranking.effectiveness': {
    full: msg({
      id: 'why.ranking.effectiveness',
      message:
        "{exercise} scores {score, number, percent} for {muscle}: how directly it trains the muscle, the strength of the evidence{evidence, select, H { (muscle-growth studies)} EMG { (muscle-activation studies only)} C { (coaching convention)} other {}}, stretch under load, how easily you can add weight over time, and coverage of the muscle's regions.",
    }),
    simple: msg({
      id: 'why.ranking.effectiveness.simple',
      message:
        'How well {exercise} suits {muscle}: {score, number, percent}. It counts how directly it works the muscle, the research behind it and how easy it is to keep progressing.',
    }),
  },
  'ranking.factor.credit': {
    full: msg({
      id: 'why.ranking.factor.credit',
      message:
        'How directly it trains the muscle: {value, number} (1 = directly, 0.5 = assisting). Weighted {weight, number, percent}, it adds {contribution, number, percent} to the score.',
    }),
    simple: msg({
      id: 'why.ranking.factor.credit.simple',
      message: 'Adds {contribution, number, percent}: how directly this exercise works the muscle.',
    }),
  },
  'ranking.factor.evidence': {
    full: msg({
      id: 'why.ranking.factor.evidence',
      message:
        'Strength of the research behind this exercise for this muscle: {value, number, percent} (muscle-growth studies rate highest). Weighted {weight, number, percent}, it adds {contribution, number, percent} to the score.',
    }),
    simple: msg({
      id: 'why.ranking.factor.evidence.simple',
      message:
        'Adds {contribution, number, percent}: how strong the research is that it grows this muscle.',
    }),
  },
  'ranking.factor.stretch': {
    full: msg({
      id: 'why.ranking.factor.stretch',
      message:
        'Loads the muscle in a stretched position: {value, select, 1 {yes} other {no}}. Weighted {weight, number, percent}, it adds {contribution, number, percent} to the score.',
    }),
    simple: msg({
      id: 'why.ranking.factor.stretch.simple',
      message:
        "Adds {contribution, number, percent}: {value, select, 1 {it works the muscle while stretched, which research suggests helps growth.} other {it doesn't focus on the stretched position.}}",
    }),
  },
  'ranking.factor.overload': {
    full: msg({
      id: 'why.ranking.factor.overload',
      message:
        'How easily you can add weight over time: {value, number, percent}. Weighted {weight, number, percent}, it adds {contribution, number, percent} to the score.',
    }),
    simple: msg({
      id: 'why.ranking.factor.overload.simple',
      message: 'Adds {contribution, number, percent}: how easy it is to keep adding weight.',
    }),
  },
  'ranking.factor.subRegion': {
    full: msg({
      id: 'why.ranking.factor.subRegion',
      message:
        'Covers the targeted region of the muscle: {value, select, 1 {yes} other {no}}. Weighted {weight, number, percent}, it adds {contribution, number, percent} to the score.',
    }),
    simple: msg({
      id: 'why.ranking.factor.subRegion.simple',
      message:
        "Adds {contribution, number, percent}: {value, select, 1 {it covers the part of the muscle this slot is for.} other {it doesn't target a specific part of the muscle.}}",
    }),
  },

  // --- Plan generation -----------------------------------------------------------------------
  'plan.template.default': {
    full: msg({
      id: 'why.plan.template.default',
      message:
        '{template} is the standard {style} plan for {days, plural, one {# training day} other {# training days}} a week at your level ({level}).{split, select, fullBody { Each session trains the whole body.} upperLower { Sessions alternate between upper and lower body.} upperLowerPpl { It combines upper and lower body days with push, pull and legs days.} pushPullLegs { Sessions are split into push, pull and legs.} sbd { Every session is built around the squat, bench press and deadlift.} other {}}',
    }),
    simple: msg({
      id: 'why.plan.template.default.simple',
      message:
        'We picked {template} because it fits {days, plural, one {# training day} other {# training days}} a week, your style and your level. You can choose a different plan.',
    }),
  },
  'plan.template.chosen': {
    full: msg({
      id: 'why.plan.template.chosen',
      message:
        'You chose {template}. It fits {days, plural, one {# training day} other {# training days}} a week, {style} training and your level ({level}).',
    }),
    simple: msg({
      id: 'why.plan.template.chosen.simple',
      message:
        'You picked {template}, and it fits your {days, plural, one {# training day} other {# training days}} a week.',
    }),
  },
  'plan.template.none': {
    full: msg({
      id: 'why.plan.template.none',
      message:
        "{reason, select, mismatch {{template} is made for a different style or number of training days, so it can't be used with these settings. Pick a plan for {days, plural, one {# day} other {# days}} a week, or change your training days.} unknown {The chosen plan no longer exists. Pick another plan.} other {There's no {style} plan for {days, plural, one {# training day} other {# training days}} a week at the {level} level yet. Try a different number of days or another style.}}",
    }),
    simple: msg({
      id: 'why.plan.template.none.simple',
      message:
        "{reason, select, mismatch {{template} doesn't match your training days or style. Pick another plan or change your days.} unknown {That plan isn't available any more. Please pick another one.} other {We don't have a {style} plan for {days, plural, one {# day} other {# days}} a week at your level yet. Try a different number of days or another style.}}",
    }),
  },
  'plan.template.levelMismatch': {
    full: msg({
      id: 'why.plan.template.levelMismatch',
      message:
        "{template} is made for other experience levels, not {level}. Pick a plan for your level, or change your level if it doesn't fit.",
    }),
    simple: msg({
      id: 'why.plan.template.levelMismatch.simple',
      message:
        "{template} is meant for lifters at a different stage. Choose another plan, or adjust your level if it's wrong.",
    }),
  },
  'plan.level': {
    full: msg({
      id: 'why.plan.level',
      message:
        'Your plan is set up for your level ({level}): it decides how many sets you start with and how your loads go up.',
    }),
    simple: msg({
      id: 'why.plan.level.simple',
      message: 'Your plan is set for your level ({level}). You can change it any time.',
    }),
  },
  'plan.lift.unavailable': {
    full: msg({
      id: 'why.plan.lift.unavailable',
      message:
        "{avoided, select, yes {This plan is built around the {lift}, but it's on your avoid list, so no plan was made. Remove it from the avoid list or choose another training style.} other {This plan is built around the {lift}, but your equipment doesn't allow it, so no plan was made. Add the missing equipment to your profile or choose another training style.}}",
    }),
    simple: msg({
      id: 'why.plan.lift.unavailable.simple',
      message:
        "{avoided, select, yes {This plan is built around the {lift}, which you chose to avoid. Remove it from your avoid list or pick a different style.} other {This plan is built around the {lift}, but your equipment doesn't allow it. Add the equipment you have or pick a different style.}}",
    }),
  },
  'plan.slot.exercise': {
    full: msg({
      id: 'why.plan.slot.exercise',
      message:
        '{variety, select, yes {Variety mode picked {exercise} from the top choices for this {pattern} slot (number {rank} of {candidates}).} other {{exercise} is the best fit of {candidates, plural, one {# suitable exercise} other {# suitable exercises}} for this {pattern} slot: it trains the target muscles well and works with your equipment.}}',
    }),
    simple: msg({
      id: 'why.plan.slot.exercise.simple',
      message:
        '{exercise} was picked because it works the target muscles well with the equipment you have.',
    }),
  },
  'plan.slot.preferred': {
    full: msg({
      id: 'why.plan.slot.preferred',
      message:
        '{exercise} is one of your favourites and fits this {pattern} slot, so it comes first.',
    }),
    simple: msg({
      id: 'why.plan.slot.preferred.simple',
      message: 'You marked {exercise} as a favourite, and it fits here.',
    }),
  },
  'plan.slot.substituted': {
    full: msg({
      id: 'why.plan.slot.substituted',
      message:
        'Your equipment allows no {pattern} exercise for this slot, so {exercise} stands in: it trains the same target muscles directly.',
    }),
    simple: msg({
      id: 'why.plan.slot.substituted.simple',
      message:
        'No {pattern} exercise works with your equipment, so {exercise} trains the same muscles instead.',
    }),
  },
  'plan.slot.dropped': {
    full: msg({
      id: 'why.plan.slot.dropped',
      message:
        "{reason, select, noviceLimit {{slot} was left out of {dayKey} to keep the day to a manageable number of exercises while you're starting out.} noCandidate {An exercise slot on {dayKey} was left out: no exercise for it fits your equipment and avoid list.} other {An exercise slot on {dayKey} was left out.}}",
    }),
    simple: msg({
      id: 'why.plan.slot.dropped.simple',
      message:
        '{reason, select, noviceLimit {{slot} was left out of {dayKey} so the day stays short and easy to learn.} noCandidate {One exercise was left out of {dayKey} because nothing fits your equipment and avoid list.} other {One exercise was left out of {dayKey}.}}',
    }),
  },
  'plan.slot.rotated': {
    full: msg({
      id: 'why.plan.slot.rotated',
      message:
        '{reason, select, unavailable {{from} no longer fits your equipment or avoid list, so {to} replaces it.} other {New block: {to} replaces {from} for variety and trains the same muscles. Main lifts and locked exercises stay.}}',
    }),
    simple: msg({
      id: 'why.plan.slot.rotated.simple',
      message:
        "{reason, select, unavailable {You can't do {from} with your current setup, so {to} takes its place.} other {Something new for this block: {to} instead of {from}, for the same muscles.}}",
    }),
  },
  'plan.slot.kept': {
    full: msg({
      id: 'why.plan.slot.kept',
      message:
        '{locked, select, yes {{exercise} stays because you locked it.} other {{exercise} stays: main lifts carry over from block to block so you can track your progress.}}',
    }),
    simple: msg({
      id: 'why.plan.slot.kept.simple',
      message:
        '{locked, select, yes {{exercise} stays, as you asked.} other {{exercise} stays, so you can keep building on it.}}',
    }),
  },
  'plan.volume.target': {
    full: msg({
      id: 'why.plan.volume.target',
      message:
        "{source, select, priority {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, high in the usual range because it's one of your priorities.} maintenance {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, enough to maintain it, because only optional exercises in this plan train it.} recent {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, starting near your recent {recent, number} and moving gradually toward the usual range.} logged {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, based on what you logged in the last block.} user {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, as you set it.} timeBudget {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, lowered so the plan fits your session time.} other {{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, a starting point in the usual range for {level} lifters.}}",
    }),
    simple: msg({
      id: 'why.plan.volume.target.simple',
      message:
        "{source, select, priority {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week. It's a priority for you, so it gets more.} maintenance {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, enough to keep what you have.} recent {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, close to what you've been doing, then building up slowly.} logged {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, based on what you did last block.} user {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, as you chose.} timeBudget {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, so your workouts fit your time.} other {{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week (sets that end with only a few reps left in the tank), a good start for your level.}}",
    }),
  },
  'plan.volume.liftTarget': {
    full: msg({
      id: 'why.plan.volume.liftTarget',
      message:
        'Weekly heavy sets for the {lift}: {heavySets} (low reps with a heavy load), the starting point for {level} lifters.',
    }),
    simple: msg({
      id: 'why.plan.volume.liftTarget.simple',
      message:
        'The {lift} gets {heavySets, plural, one {# heavy set} other {# heavy sets}} a week. Heavy sets are low-rep sets with a heavy weight, the ones that build strength most directly.',
    }),
  },
  'plan.volume.sets': {
    full: msg({
      id: 'why.plan.volume.sets',
      message:
        'Sets were added one at a time where they close the biggest gap to the weekly targets ({added, plural, one {# set} other {# sets}} added), within the per-session limits and your session time. {deficit, plural, =0 {Every weekly target is met.} other {Some muscles stay below their target; their warnings say why.}}',
    }),
    simple: msg({
      id: 'why.plan.volume.sets.simple',
      message:
        'We spread your sets over the week so each muscle gets close to its weekly goal, without overloading any session or running over your time.',
    }),
  },
  'plan.volume.budget': {
    full: msg({
      id: 'why.plan.volume.budget',
      message:
        "Your session time doesn't fit every muscle's full weekly target, so {lowered, plural, one {# muscle was} other {# muscles were}} set lower, toward the minimum effective dose. {emphasis, select, priorities {Your priority muscles keep their full target.} other {The plan's main muscles keep their full target.}} {minutes, select, none {To fit every full target, choose 90+ min sessions or add a training day.} other {Sessions of {minutes} min would fit every full target.}}",
    }),
    simple: msg({
      id: 'why.plan.volume.budget.simple',
      message:
        "Your workouts are too short to give every muscle its full amount, so {lowered, plural, one {# muscle gets} other {# muscles get}} a bit less. {emphasis, select, priorities {Your priority muscles still get their full amount.} other {The plan's main muscles still get their full amount.}} {minutes, select, none {Longer workouts (90+ minutes) or another training day would fit everything.} other {About {minutes} minutes per workout would fit everything.}}",
    }),
  },
  'plan.prescription': {
    full: msg({
      id: 'why.plan.prescription',
      message:
        '{mode, select, topBackoff {One top set, then back-off sets: {reps} reps with {rir} reps in reserve (RIR).} rpe {{reps} reps with {rir} reps in reserve (RIR); the load comes from your estimated max.} other {{reps} reps with {rir} reps in reserve (RIR). When every set reaches the top of the range, the load goes up.}} {fromTemplate, select, yes {The plan sets these numbers for this exercise.} other {These are the standard targets for this exercise and goal.}}',
    }),
    simple: msg({
      id: 'why.plan.prescription.simple',
      message:
        '{reps} reps per set, stopping with {rir} reps left in the tank. {mode, select, topBackoff {Start with one heavier set, then a few lighter ones.} rpe {The weight is set from how strong you are right now.} other {When you reach the top of the range on every set, add a little weight.}}',
    }),
  },
  'plan.duration': {
    full: msg({
      id: 'why.plan.duration',
      message:
        '{dayKey} takes about {minutes} min: working sets, rest, warm-up sets and moving between exercises.',
    }),
    simple: msg({
      id: 'why.plan.duration.simple',
      message: '{dayKey} takes about {minutes} minutes, including warm-ups and rest.',
    }),
  },
  'plan.time.trimmed': {
    full: msg({
      id: 'why.plan.time.trimmed',
      message:
        '{action, select, removed {{slot} was left out of {dayKey} to fit your {budget} min sessions.} fewerSets {{slot} on {dayKey} drops to {sets, plural, one {# heavy set} other {# heavy sets}} to fit your {budget} min sessions.} removedForVolume {{slot} was left out of {dayKey} so its time goes to sets for muscles that were short of their weekly target.} other {{dayKey} was shortened to fit your session time.}}',
    }),
    simple: msg({
      id: 'why.plan.time.trimmed.simple',
      message:
        '{action, select, removed {{slot} was left out of {dayKey} so the workout fits your {budget} minutes.} fewerSets {{slot} on {dayKey} has fewer sets so the workout fits your {budget} minutes.} removedForVolume {{slot} was left out of {dayKey} to make time for muscles that needed more sets.} other {{dayKey} was shortened to fit your time.}}',
    }),
  },
  'plan.schedule.weekdays': {
    full: msg({
      id: 'why.plan.schedule.weekdays',
      message:
        'The days are placed on your training weekdays so that sessions for the same muscles or lifts get enough recovery time in between. {conflicts, plural, =0 {No sessions are too close together.} one {One pair of sessions is closer together than ideal.} other {# pairs of sessions are closer together than ideal.}}',
    }),
    simple: msg({
      id: 'why.plan.schedule.weekdays.simple',
      message:
        'We arranged your workouts so the same muscles get time to recover in between.{conflicts, plural, =0 {} other { With these weekdays, some workouts are closer together than ideal.}}',
    }),
  },
  'plan.mesocycle': {
    full: msg({
      id: 'why.plan.mesocycle',
      message:
        "{valid, select, yes {Each block has {accumulationWeeks, plural, one {# training week} other {# training weeks}}, then {deloadWeeks, plural, one {# lighter (deload) week} other {# lighter (deload) weeks}} to recover before the next block.{chosen, select, yes { You chose this length; the plan's default is {defaultWeeks, plural, one {# week} other {# weeks}}.} no { This is the plan's default, in line with how often strength athletes and coaches report taking a lighter week.} other {}}} no {{accumulationWeeks, plural, one {# training week} other {# training weeks}} per block is outside the allowed range, so no plan was made. Choose a different block length.} other {Your next block is ready: {rotations, plural, =0 {the same exercises carry over} one {# exercise rotates for variety} other {# exercises rotate for variety}}, and the targets are set for your current level ({level}).}}",
    }),
    simple: msg({
      id: 'why.plan.mesocycle.simple',
      message:
        "{valid, select, yes {You train for {accumulationWeeks, plural, one {# week} other {# weeks}}, then have {deloadWeeks, plural, one {# lighter week} other {# lighter weeks}} to recover. Then the next block starts.{chosen, select, yes { You picked this; the plan's usual length is {defaultWeeks, plural, one {# week} other {# weeks}}.} no { That's the usual length.} other {}}} no {{accumulationWeeks, plural, one {# week} other {# weeks}} per block doesn't work. Please choose a different number of weeks.} other {Your next block is ready{rotations, plural, =0 {, with the same exercises.} one {, with # new exercise for variety.} other {, with # new exercises for variety.}}}}",
    }),
  },
  'plan.next.volume': {
    full: msg({
      id: 'why.plan.next.volume',
      message:
        '{muscle}: you logged about {logged, number} of {planned, number} planned weekly sets, so the next block starts at {next, number} sets and builds from what you actually did.',
    }),
    simple: msg({
      id: 'why.plan.next.volume.simple',
      message:
        "{muscle}: the next block starts at {next, number} sets a week, closer to what you've been doing ({logged, number}). It builds up from there.",
    }),
  },

  // --- Plan validation (PLN-01): the fixes are shown below these texts -------------------------
  'validate.equipment.unavailable': {
    full: msg({
      id: 'why.validate.equipment.unavailable',
      message:
        "{exercise} needs equipment that isn't in your current profile. Swap it for an exercise you can do.",
    }),
    simple: msg({
      id: 'why.validate.equipment.unavailable.simple',
      message: "You don't have the equipment for {exercise}. Swap it for something you can do.",
    }),
  },
  'validate.avoided': {
    full: msg({
      id: 'why.validate.avoided',
      message:
        '{exercise} is on your avoid list. Swap it for another exercise, or remove it from the avoid list.',
    }),
    simple: msg({
      id: 'why.validate.avoided.simple',
      message: 'You asked to avoid {exercise}. Swap it for something else.',
    }),
  },
  'validate.volume.belowFloor': {
    full: msg({
      id: 'why.validate.volume.belowFloor',
      message:
        "{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, below the minimum where muscle growth is reliably seen (target {target, number}). Add a set where there's room.",
    }),
    simple: msg({
      id: 'why.validate.volume.belowFloor.simple',
      message:
        '{muscle}: only {sets, plural, one {# hard set} other {# hard sets}} a week, too few to grow well (goal: {target, number}). Adding a set or two would help.',
    }),
  },
  'validate.volume.low': {
    full: msg({
      id: 'why.validate.volume.low',
      message:
        "{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, below the target of {target, number}. Add a set where there's room.",
    }),
    simple: msg({
      id: 'why.validate.volume.low.simple',
      message:
        '{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, a bit under the goal of {target, number}. One or two more sets would close the gap.',
    }),
  },
  'validate.volume.high': {
    full: msg({
      id: 'why.validate.volume.high',
      message:
        '{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, above the target of {target, number} and the usual range. Extra sets bring low expected return; consider removing a set or two.',
    }),
    simple: msg({
      id: 'why.validate.volume.high.simple',
      message:
        '{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week, more than planned ({target, number}). Extra sets add little; you could drop one or two.',
    }),
  },
  'validate.volume.veryHigh': {
    full: msg({
      id: 'why.validate.volume.veryHigh',
      message:
        '{muscle}: {sets, plural, one {# weekly set} other {# weekly sets}}, well above the range research supports (target {target, number}), with low expected return per extra set. Consider fewer sets for this muscle.',
    }),
    simple: msg({
      id: 'why.validate.volume.veryHigh.simple',
      message:
        "{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week. That's far more than needed; fewer sets would likely work just as well.",
    }),
  },
  'validate.volume.targetOutsideBand': {
    full: msg({
      id: 'why.validate.volume.targetOutsideBand',
      message:
        "Your target for {muscle} ({target, number} weekly sets) is outside the range research supports. It's your choice; consider a target within the usual range.",
    }),
    simple: msg({
      id: 'why.validate.volume.targetOutsideBand.simple',
      message:
        'The goal you set for {muscle} ({target, number} sets a week) is unusual. You can keep it, or pick a number closer to the usual range.',
    }),
  },
  'validate.volume.timeBudget': {
    full: msg({
      id: 'why.validate.volume.timeBudget',
      message:
        '{muscle}: target lowered from {full, number} to {target, number} weekly sets so the plan fits your session time; {sets, plural, one {# set is} other {# sets are}} planned. Longer sessions or another training day would allow the full target.',
    }),
    simple: msg({
      id: 'why.validate.volume.timeBudget.simple',
      message:
        '{muscle}: {sets, plural, one {# hard set} other {# hard sets}} a week instead of {full, number}, so your workouts fit your time. Longer workouts or another training day would give it the full amount.',
    }),
  },
  'validate.frequency.muscle': {
    full: msg({
      id: 'why.validate.frequency.muscle',
      message:
        '{muscle}: trained on {sessions, plural, one {# day} other {# days}} a week; training on at least {required, plural, one {# day} other {# days}} usually works better. Spread its sets over more days.',
    }),
    simple: msg({
      id: 'why.validate.frequency.muscle.simple',
      message:
        '{muscle}: trained on {sessions, plural, one {# day} other {# days}} a week. Splitting the sets over {required} or more days usually works better.',
    }),
  },
  'validate.frequency.lift': {
    full: msg({
      id: 'why.validate.frequency.lift',
      message:
        'The {lift} is trained on {sessions, plural, one {# day} other {# days}} a week; {min}–{max} days a week usually works best for strength.',
    }),
    simple: msg({
      id: 'why.validate.frequency.lift.simple',
      message:
        'You do the {lift} on {sessions, plural, one {# day} other {# days}} a week. For getting stronger, {min} to {max} days a week works best.',
    }),
  },
  'validate.sessionCap.muscle': {
    full: msg({
      id: 'why.validate.sessionCap.muscle',
      message:
        '{muscle}: {fractional, number} sets in this session ({direct, number} direct), above the per-session soft cap. Extra sets here bring low expected return; consider moving some to another day.',
    }),
    simple: msg({
      id: 'why.validate.sessionCap.muscle.simple',
      message:
        "That's a lot of {muscle} work for one session. Moving some sets to another day would make them count more.",
    }),
  },
  'validate.sessionCap.lift': {
    full: msg({
      id: 'why.validate.sessionCap.lift',
      message:
        '{sets, plural, one {# heavy set} other {# heavy sets}} of the {lift} in one session, more than the usual {max}. Extra heavy sets here bring low expected return; consider moving some to another day.',
    }),
    simple: msg({
      id: 'why.validate.sessionCap.lift.simple',
      message:
        "That's a lot of heavy {lift} sets for one day. Spreading them over another day works better.",
    }),
  },
  'validate.strength.belowMinimum': {
    full: msg({
      id: 'why.validate.strength.belowMinimum',
      message:
        "The {lift} gets {heavySets, plural, one {# heavy set} other {# heavy sets}} a week, below the practical minimum for strength; the usual range is {min}–{max}. Add a heavy set where there's room.",
    }),
    simple: msg({
      id: 'why.validate.strength.belowMinimum.simple',
      message:
        'The {lift} gets only {heavySets, plural, one {# heavy set} other {# heavy sets}} a week, too few to build strength well. Aim for {min} to {max}.',
    }),
  },
  'validate.strength.weeklyLow': {
    full: msg({
      id: 'why.validate.strength.weeklyLow',
      message:
        'The {lift} gets {heavySets, plural, one {# heavy set} other {# heavy sets}} a week, below the usual {min}–{max}. Consider adding a heavy set.',
    }),
    simple: msg({
      id: 'why.validate.strength.weeklyLow.simple',
      message:
        'The {lift} gets {heavySets, plural, one {# heavy set} other {# heavy sets}} a week, a little under the usual {min} to {max}. One more would help.',
    }),
  },
  'validate.strength.weeklyHigh': {
    full: msg({
      id: 'why.validate.strength.weeklyHigh',
      message:
        'The {lift} gets {heavySets, plural, one {# heavy set} other {# heavy sets}} a week, above the usual {min}–{max}, with low expected return per extra set. Consider removing one.',
    }),
    simple: msg({
      id: 'why.validate.strength.weeklyHigh.simple',
      message:
        'The {lift} gets {heavySets, plural, one {# heavy set} other {# heavy sets}} a week, more than the usual {min} to {max}. You could do fewer and still progress.',
    }),
  },
  'validate.lift.missing': {
    full: msg({
      id: 'why.validate.lift.missing',
      message:
        'This plan has no {lift}. Strength plans train each competition lift every week; add the {lift} to at least one day.',
    }),
    simple: msg({
      id: 'why.validate.lift.missing.simple',
      message: 'Your plan has no {lift}. Add it to at least one day to keep practising it.',
    }),
  },
  'validate.time.overBudget': {
    full: msg({
      id: 'why.validate.time.overBudget',
      message:
        'This day takes about {minutes} min, more than your {budget} min session time. Fewer sets, a superset or shorter rests can bring it down.',
    }),
    simple: msg({
      id: 'why.validate.time.overBudget.simple',
      message:
        'This workout takes about {minutes} minutes, longer than your {budget} minutes. You can shorten it with fewer sets, pairing exercises, or shorter rests.',
    }),
  },
  'validate.spacing': {
    full: msg({
      id: 'why.validate.spacing',
      message:
        '{subject}: trained hard on {fromDay} and {toDay}, only {gapHours} h apart; recovery usually needs at least {requiredHours} h. Consider another day for one of them.',
    }),
    simple: msg({
      id: 'why.validate.spacing.simple',
      message:
        '{fromDay} and {toDay} both work {subject} hard with little rest in between. Moving one to another day gives it time to recover.',
    }),
  },
  'validate.order.lift': {
    full: msg({
      id: 'why.validate.order.lift',
      message:
        "{before} comes before the {lift} on this day and works the same muscles, so they'd already be tired for the main lift. Move the {lift} first.",
    }),
    simple: msg({
      id: 'why.validate.order.lift.simple',
      message: 'Do the {lift} first: {before} tires the same muscles when it comes before.',
    }),
  },
  'validate.deload.missing': {
    full: msg({
      id: 'why.validate.deload.missing',
      message:
        'Each block should end with a lighter (deload) week after a set number of training weeks; it is part of training. Add the deload week, or set the block length within the usual range.',
    }),
    simple: msg({
      id: 'why.validate.deload.missing.simple',
      message:
        'Your plan needs a lighter week after a few weeks of training, so you can recover. Add one, or change how many weeks come before it.',
    }),
  },
  'validate.prescription.reps': {
    full: msg({
      id: 'why.validate.prescription.reps',
      message:
        'The rep range for {exercise} is outside the usual range for {goal} training. Consider a range within it.',
    }),
    simple: msg({
      id: 'why.validate.prescription.reps.simple',
      message:
        'The number of reps for {exercise} is unusually high or low for your goal. Adjusting it usually works better.',
    }),
  },
  'validate.prescription.effort': {
    full: msg({
      id: 'why.validate.prescription.effort',
      message:
        '{tooEasy, select, yes {The effort target for {exercise} leaves too many reps in reserve (RIR) for the sets to count as hard sets.} other {{failureOnCompound, select, yes {The effort target for {exercise} goes to failure (0 RIR); on multi-joint exercises, stopping a rep or two short usually works just as well with less fatigue.} other {{liftFailure, select, yes {The effort target for {exercise} is too close to failure; main lifts work best with at least a rep in reserve.} other {The effort target for {exercise} is outside the usual range.}}}}}} Adjust its reps in reserve.',
    }),
    simple: msg({
      id: 'why.validate.prescription.effort.simple',
      message:
        "{tooEasy, select, yes {{exercise} sets stop with too many reps left in the tank to count as hard sets. Aim to stop a bit closer to failure.} other {{failureOnCompound, select, yes {Going all the way to failure on {exercise} isn't needed. Stop with a rep or two left in the tank.} other {{liftFailure, select, yes {Main lifts like {exercise} work best with at least a rep left in the tank.} other {The effort for {exercise} is unusual for this exercise. Adjust how many reps you leave in the tank.}}}}}}",
    }),
  },
  'validate.novice.exercises': {
    full: msg({
      id: 'why.validate.novice.exercises',
      message:
        "This day has {exercises} exercises; while you're starting out, up to {max} a day is easier to learn and recover from. Consider removing one.",
    }),
    simple: msg({
      id: 'why.validate.novice.exercises.simple',
      message:
        "This day has {exercises} exercises. While you're learning, {max} or fewer is easier to manage.",
    }),
  },
  'validate.coverage': {
    full: msg({
      id: 'why.validate.coverage',
      message:
        '{rule, select, squatPlusExtension {Best coverage for {muscle}: a squat or lunge plus a knee extension. {part, select, 0 {Add a squat or lunge.} other {Add a knee extension, such as a leg extension.}}} hingePlusCurl {Best coverage for {muscle}: a hip hinge plus a leg curl. {part, select, 0 {Add a hip hinge, such as a Romanian deadlift.} other {Add a leg curl.}}} overheadPlusPressdown {Best coverage for {muscle}: an overhead extension plus a pressdown or press. {part, select, 0 {Add an overhead triceps extension.} other {Add a pressdown or a press.}}} curl {Best coverage for {muscle}: at least one curl. Add a curl.} deepSquatOrHipThrust {Best coverage for {muscle}: a deep squat or a hip thrust. Add one of them.} other {One exercise is missing for full coverage of {muscle}.}}',
    }),
    simple: msg({
      id: 'why.validate.coverage.simple',
      message:
        '{rule, select, squatPlusExtension {{part, select, 0 {Add a squat or lunge for full coverage of {muscle}.} other {Add a leg extension for full coverage of {muscle}.}}} hingePlusCurl {{part, select, 0 {Add a hip hinge, like a Romanian deadlift, for full coverage of {muscle}.} other {Add a leg curl for full coverage of {muscle}.}}} overheadPlusPressdown {{part, select, 0 {Add an overhead triceps extension for full coverage of {muscle}.} other {Add a pressdown or a press for full coverage of {muscle}.}}} curl {Add a curl for direct {muscle} work.} deepSquatOrHipThrust {Add a deep squat or a hip thrust for full coverage of {muscle}.} other {Add one more exercise for full coverage of {muscle}.}}',
    }),
  },

  // --- Deloads, breaks and rescheduling ------------------------------------------------------
  'deload.week': {
    full: msg({
      id: 'why.deload.week',
      message:
        'Lighter (deload) week: the same exercises and days with fewer sets, loads held or slightly lower, and {rirAdd, plural, one {# more rep} other {# more reps}} in reserve (RIR) per set. It lets fatigue fade so the next block starts fresh; deloads are part of training.',
    }),
    simple: msg({
      id: 'why.deload.week.simple',
      message:
        'This is a lighter week: the same exercises with fewer sets, and you stop each set with {rirAdd, plural, one {# more rep} other {# more reps}} left in the tank. Easier weeks like this are part of getting stronger.',
    }),
  },
  'deload.reactive.propose': {
    full: msg({
      id: 'why.deload.reactive.propose',
      message:
        'Signs of building fatigue showed up, such as a main lift dipping over several sessions, low readiness or pain flags, so the lighter (deload) week moves to now. It replaces the planned one rather than adding another.',
    }),
    simple: msg({
      id: 'why.deload.reactive.propose.simple',
      message:
        'Your recent training shows signs you could use a lighter week, so we suggest taking it now instead of later. It replaces the planned one.',
    }),
  },
  'deload.reactive.none': {
    full: msg({
      id: 'why.deload.reactive.none',
      message:
        'Fewer than {required} signs of building fatigue showed up, so the lighter (deload) week stays where it is planned.',
    }),
    simple: msg({
      id: 'why.deload.reactive.none.simple',
      message: 'Your training looks on track, so the lighter week stays as planned.',
    }),
  },
  'deload.postponed': {
    full: msg({
      id: 'why.deload.postponed',
      message:
        '{allowed, select, yes {The lighter (deload) week moves back by {weeks, plural, one {# week} other {# weeks}}; you train your regular sessions until then. This works once per block.} other {The lighter (deload) week can be postponed only once per block, and it has already been moved or skipped in this block.}}',
    }),
    simple: msg({
      id: 'why.deload.postponed.simple',
      message:
        "{allowed, select, yes {Your lighter week moves {weeks, plural, one {a week} other {# weeks}} later. You can do this once per block.} other {The lighter week has already been moved or skipped in this block, so it can't move again.}}",
    }),
  },
  'deload.skipped': {
    full: msg({
      id: 'why.deload.skipped',
      message:
        'The lighter (deload) week is skipped: its {sessions, plural, one {# session is} other {# sessions are}} back to regular training. Fine now and then; the next block plans a lighter week again.',
    }),
    simple: msg({
      id: 'why.deload.skipped.simple',
      message:
        "You skipped the lighter week, so these sessions are regular ones. That's okay; the next block has one again.",
    }),
  },
  'break.return.resume': {
    full: msg({
      id: 'why.break.return.resume',
      message:
        'After {daysOff, plural, one {# day} other {# days}} off, pick up where you left off. Let your first top set show how today feels and adjust from there.',
    }),
    simple: msg({
      id: 'why.break.return.resume.simple',
      message:
        'Only {daysOff, plural, one {# day} other {# days}} off, so carry on as planned. If the first heavy set feels hard, go a little lighter.',
    }),
  },
  'break.return.reduce': {
    full: msg({
      id: 'why.break.return.reduce',
      message:
        'After {daysOff, plural, one {# day} other {# days}} off, the first sessions back use lighter loads, and sometimes fewer sets or more reps in reserve (RIR), building back to your normal over the next weeks.',
    }),
    simple: msg({
      id: 'why.break.return.reduce.simple',
      message:
        'Welcome back! After {daysOff, plural, one {# day} other {# days}} off, you start a little lighter and build back up over the next weeks.',
    }),
  },
  'break.return.reentry': {
    full: msg({
      id: 'why.break.return.reentry',
      message:
        'After {daysOff, plural, one {# day} other {# days}} off, you ease back in over {weeks, plural, one {# week} other {# weeks}}: lighter loads and fewer sets at first, then back to normal.',
    }),
    simple: msg({
      id: 'why.break.return.reentry.simple',
      message:
        'Welcome back! After {daysOff, plural, one {# day} other {# days}} off, you ease in over {weeks, plural, one {# week} other {# weeks}} with lighter weights and fewer sets.',
    }),
  },
  'break.return.recalibrate': {
    full: msg({
      id: 'why.break.return.recalibrate',
      message:
        'After {daysOff, plural, one {# day} other {# days}} off, your old numbers may no longer fit. The first sessions measure your strength again with a few reps in reserve (RIR), and the plan builds from there.',
    }),
    simple: msg({
      id: 'why.break.return.recalibrate.simple',
      message:
        'Welcome back! After a long break, the first sessions find your new starting weights. Stop each set with a few reps left in the tank.',
    }),
  },
  'schedule.missed.doToday': {
    full: msg({
      id: 'why.schedule.missed.doToday',
      message:
        "Life happens. The session from {from} moves to today{shifted, plural, =0 {, and the rest of the week stays as planned.} one {, and # later session moves a day later so you don't train twice on one day.} other {, and # later sessions move later so you don't train twice on one day.}}",
    }),
    simple: msg({
      id: 'why.schedule.missed.doToday.simple',
      message:
        "No problem: the workout from {from} moves to today.{shifted, plural, =0 {} other { The rest of the week shifts a little so you don't do two workouts on one day.}}",
    }),
  },
  'schedule.missed.skip': {
    full: msg({
      id: 'why.schedule.missed.skip',
      message:
        'The session on {date} is marked as skipped, not deleted, so your history stays complete. The plan continues as normal.',
    }),
    simple: msg({
      id: 'why.schedule.missed.skip.simple',
      message: 'No problem: the workout on {date} is marked as skipped, and your plan carries on.',
    }),
  },
  'schedule.missed.merge': {
    full: msg({
      id: 'why.schedule.missed.merge',
      message:
        "{target, select, none {There's no later session in this plan to merge the missed work into. Do it today or skip it.} other {The key exercises of a missed session were added to this one, as far as the per-session limits allow; anything that would overload the day is left out.}}",
    }),
    simple: msg({
      id: 'why.schedule.missed.merge.simple',
      message:
        "{target, select, none {There's no later workout to add the missed work to. You can do it today or skip it.} other {The most important exercises from a missed workout were added here, without overloading the day.}}",
    }),
  },
  'schedule.moved': {
    full: msg({
      id: 'why.schedule.moved',
      message:
        'This session moved from {from} to {to}. If that brings hard sessions for the same muscles close together, a spacing note shows it.',
    }),
    simple: msg({
      id: 'why.schedule.moved.simple',
      message: 'Moved from {from} to {to}.',
    }),
  },
  // --- The workout session (M3a) --------------------------------------------------------------
  'session.calibration': {
    full: msg({
      id: 'why.session.calibration',
      message:
        "{status, select, uncalibrated {POWR doesn't know your strength on this exercise yet, so it calibrates: pick a weight you could lift about 12 times and stop with {rirMin}–{rirMax} reps in reserve (RIR). Your estimated 1-rep max (e1RM) comes from these sets.} calibrating {POWR is still calibrating this exercise: stop with {rirMin}–{rirMax} reps in reserve (RIR).{load, select, none {} other { The load, {load}, comes from your sets so far.}}} other {Stop with {rirMin}–{rirMax} reps in reserve (RIR).{load, select, none {} other { The load is {load}.}}}} After {exposuresMin}–{exposuresMax} sessions with this exercise, the loads follow your progress.",
    }),
  },
  'session.lastTime': {
    full: msg({
      id: 'why.session.lastTime',
      message:
        "{mode, select, manual {Manual mode: the same as last time{load, select, none {} other {, {load}}}, {reps, plural, one {# rep} other {# reps}}, without progression.} repsUp {This exercise progresses by reps: aim for {reps, plural, one {# rep} other {# reps}}, one more than last time.} previousSet {The same load as your last set{load, select, none {} other {: {load}}}.} other {There's nothing to go by yet. Enter what you do, and POWR suggests from there.}}",
    }),
  },
  'session.fixed': {
    full: msg({
      id: 'why.session.fixed',
      message:
        "{kind, select, warmup {A warm-up set{load, select, none {} other { at {load}}}. Warm-ups don't count towards your volume, your estimated max or your PRs.} timed {A timed set of {durationS, plural, one {# second} other {# seconds}}.} other {This set has a set load{load, select, none {} other {: {load}}}, from your plan or a change you made.}}",
    }),
  },
  'session.adjustment.load': {
    full: msg({
      id: 'why.session.adjustment.load',
      message:
        'This session uses {pct}% of your normal working load ({pctMin}–{pctMax}%), so {from} becomes {load}. Lighter days like this are part of training.',
    }),
  },
  'progression.linear.weekHold': {
    full: msg({
      id: 'why.progression.linear.weekHold',
      message:
        'The load stays at {load} this week: at your level the weight goes up once a week, not every session.',
    }),
  },
  'pr.rep': {
    full: msg({
      id: 'why.pr.rep',
      message:
        '{previous, select, none {Rep PR: the first time you did {reps, plural, one {# rep} other {# reps}} or more with {value}.} other {Rep PR: {value} for {reps, plural, one {# rep} other {# reps}}, more than your best of {previous} for at least as many reps.}}',
    }),
  },
  'pr.load': {
    full: msg({
      id: 'why.pr.load',
      message:
        '{previous, select, none {Load PR: {value} is the heaviest you have lifted on {exerciseId}.} other {Load PR: {value} on {exerciseId}, heavier than your best of {previous}.}}',
    }),
  },
  'pr.e1rm': {
    full: msg({
      id: 'why.pr.e1rm',
      message:
        "Estimated 1-rep max (e1RM) PR: {value}{previous, select, none {} other {, up from {previous}}}. It's an estimate from a set with logged effort, not a tested max.",
    }),
  },
  'pr.volume': {
    full: msg({
      id: 'why.pr.volume',
      message:
        '{previous, select, none {Volume PR: {value} lifted in total on {exerciseId} in one session.} other {Volume PR: {value} lifted in total on {exerciseId} in one session, more than your best of {previous}.}}',
    }),
  },
  'pr.firstTime': {
    full: msg({
      id: 'why.pr.firstTime',
      message:
        'The first time you logged {exerciseId}. From your next session with it, POWR tracks your PRs.',
    }),
  },
  'readiness.assessment': {
    full: msg({
      id: 'why.readiness.assessment',
      message:
        "{flag, select, insufficientData {POWR compares your check-in with your usual once it has {minEntries} check-ins from the last weeks; it has {entries} so far.} low {Your check-in is lower than usual for you (score {composite}). A lighter session is an option.} modify {Your check-in is well below your usual{prsLowDays, plural, =0 {} =1 {} other {, and you have felt under-recovered for # days in a row}}. Consider adjusting today's session.} other {Your check-in is within your usual range.}}{shortNights, plural, =0 {} =1 {} other { You have slept short for # nights in a row.}}",
    }),
  },
  'readiness.adjust': {
    full: msg({
      id: 'why.readiness.adjust',
      message:
        "{action, select, capTopSet {Stop your top sets with {rirAdd, plural, one {# more rep} other {# more reps}} in reserve today.} dropBackoff {Leave out {dropSets, plural, one {# back-off set} other {# back-off sets}} per exercise today.} trimVolume {After a short night before an afternoon or evening session, keep the weights and do {dropSets, plural, one {# set} other {# sets}} fewer per exercise.} easeCompounds {After several short nights, stop the multi-joint lifts with {rirAdd, plural, one {# more rep} other {# more reps}} in reserve.} other {A lighter session is an option today.}} It's your call: nothing changes unless you accept.",
    }),
  },
  'guardrail.failure': {
    full: msg({
      id: 'why.guardrail.failure',
      message:
        'Going to failure on heavy squats, deadlifts or bench presses adds about {extraHoursMin}–{extraHoursMax} hours of recovery and gives no extra strength. Stopping a rep or two short works as well.',
    }),
  },
  'guardrail.shortRest': {
    full: msg({
      id: 'why.guardrail.shortRest',
      message:
        'You rested {restSeconds, plural, one {# second} other {# seconds}} between sets of a competition lift. Heavy sets go better after at least {minimum, plural, one {# second} other {# seconds}}.',
    }),
  },
  'guardrail.slowReps': {
    full: msg({
      id: 'why.guardrail.slowReps',
      message:
        'Your reps took about {repSeconds} seconds each. Reps slower than {limit} seconds build no more muscle; lowering under control for 2–4 seconds is enough.',
    }),
  },
  // --- M4a: insight and motivation -------------------------------------------------------
  'streak.week': {
    full: msg({
      id: 'why.streak.week',
      message:
        "{state, select, kept {Week kept: {done} of {target, plural, one {# session} other {# sessions}} done.{deload, select, yes { A deload week counts with its planned sessions.} other {}}} graced {Week kept with your grace: {done} of {target, plural, one {# session} other {# sessions}} done.} missed {{done} of {target, plural, one {# session} other {# sessions}} done that week. Your current streak started again; your best streak stays.} paused {A break week: it pauses your streak without breaking it.} pending {This week so far: {done} of {target, plural, one {# session} other {# sessions}}. There's still time.} other {}}{targetSource, select, freestyle { The target is your weekly session goal.} default { Without a plan or a weekly goal, one session keeps the week.} other {}}{breakDays, plural, =0 {} =7 {} one { One day was a break, so the week asks for fewer sessions.} other { # days were a break, so the week asks for fewer sessions.}}",
    }),
  },
  'streak.current': {
    full: msg({
      id: 'why.streak.current',
      message:
        'Your streak counts weeks in a row in which you did your planned sessions: {current, plural, one {# week} other {# weeks}} now, {best, plural, one {# week} other {# weeks}} at best. Breaks and illness pause it{paused, plural, =0 {} one { (# week so far)} other { (# weeks so far)}}; deload weeks count like any other.{grace, select, yes { With your grace, a week with one session short still counts.} other {}}',
    }),
  },
  'volume.target': {
    full: msg({
      id: 'why.volume.target',
      message:
        "{muscle}: {sets, number} hard sets this week ({direct, number} of them direct). {status, select, under {That's below your target range of {low, number} to {high, number} sets.} over {That's above your target range of {low, number} to {high, number} sets; more sets bring less extra growth each.} other {That's within your target range of {low, number} to {high, number} sets.}}{target, select, none { The range is the usual one for muscle growth.} other { Your plan aims for {target, number} sets.}}",
    }),
  },
  'trend.change.repRange': {
    full: msg({
      id: 'why.trend.change.repRange',
      message:
        "{shifted, select, yes {Your typical reps changed from about {medianBefore, number} to {medianNow, number} at the same time. Estimated maxes from different rep ranges don't always line up, so part of this change may come from the rep range, not from strength.} other {Your typical reps stayed about the same, so the change isn't explained by a new rep range.}}",
    }),
  },
  'progression.pace.switch': {
    full: msg({
      id: 'why.progression.pace.switch',
      message:
        'The plan adds about {planned, number}% a week, but your estimated max rose about {observed, number}% a week over the last {weeks, plural, one {# week} other {# weeks}}. The weight would get ahead of your strength, so the load now comes from your estimated max (or you add reps first) until they line up again.',
    }),
  },
  'progression.pace.ok': {
    full: msg({
      id: 'why.progression.pace.ok',
      message:
        '{insufficient, select, yes {Not enough recent sessions to compare the planned increases with your progress yet ({exposures} so far).} other {Your estimated max keeps up with the planned increases (about {observed, number}% a week against {planned, number}% planned), so the plan keeps adding weight.}}',
    }),
  },
  'bodyweight.rate.band': {
    full: msg({
      id: 'why.bodyweight.rate.band',
      message:
        '{status, select, untracked {Set a phase (bulk, cut or maintain) to compare your weekly rate with a target range.} insufficientData {A few more weigh-ins will show how your trend compares with your {phase, select, bulk {bulking} cut {cutting} other {maintenance}} range.} below {Your trend is changing by {pctPerWeek, number}% a week, below your {phase, select, bulk {bulking} cut {cutting} other {maintenance}} range of {min, number}% to {max, number}%.} above {Your trend is changing by {pctPerWeek, number}% a week, above your {phase, select, bulk {bulking} cut {cutting} other {maintenance}} range of {min, number}% to {max, number}%.} other {Your trend is changing by {pctPerWeek, number}% a week, within your {phase, select, bulk {bulking} cut {cutting} other {maintenance}} range of {min, number}% to {max, number}%.}}{warning, select, fastLoss { You have been losing faster than 1% a week for a while; a slower pace helps keep muscle and strength.} fastGain { You have been gaining faster than your range for a few weeks; a smaller surplus usually adds less fat.} other {}}',
    }),
  },
  'ranking.focus': {
    full: msg({
      id: 'why.ranking.focus',
      message:
        '{exercise} credits {muscle} with {credit, number} of a set, {share, number, percent} of everything it trains. The higher the share, the more the exercise isolates the muscle.',
    }),
    simple: msg({
      id: 'why.ranking.focus.simple',
      message:
        '{share, number, percent} of what {exercise} trains is {muscle}. Higher means it focuses on this muscle.',
    }),
  },
};
