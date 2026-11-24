/**
 * M0 content stub: the three competition lifts, in the full `ExerciseDef` shape, so the "log one
 * set" skeleton has something to log. Muscle credits follow the EB mapping table (§Session ›
 * Mapping) and cite seeded registry sources (packages/rules/data/sources). Muscle and equipment
 * IDs are placeholders until the M1 taxonomy and catalog exist. The YAML library and its build
 * pipeline replace this file in M1 (§8.12).
 */
export const STUB_EXERCISES: readonly unknown[] = [
  {
    id: 'ex.barbell-back-squat',
    name: { en: 'Barbell back squat' },
    synonyms: ['back squat', 'high-bar squat', 'low-bar squat'],
    pattern: 'squat',
    mechanics: 'compound',
    competitionLift: 'squat',
    substitutionGroups: ['sg.squat-pattern'],
    equipment: {
      allOf: ['eq.barbell-olympic', 'eq.plates'],
      anyOf: [['eq.power-rack', 'eq.squat-stand']],
    },
    muscles: [
      { muscle: 'mu.quads.vasti', credit: 1, evidence: 'H', source: 'src.kubo2019' },
      { muscle: 'mu.quads.rectus-femoris', credit: 0, evidence: 'EMG', source: 'src.ema2016' },
      { muscle: 'mu.glutes.max', credit: 0.5, evidence: 'H', source: 'src.plotkin2023' },
      { muscle: 'mu.adductors', credit: 0.5, evidence: 'H', source: 'src.kubo2019' },
      { muscle: 'mu.hamstrings', credit: 0, evidence: 'H', source: 'src.kubo2019' },
    ],
    load: { type: 'barbell', curveClass: 'pooled', unilateral: false, bodyweightLoaded: false },
    defaults: {
      repRange: { hypertrophy: [6, 15], strength: [1, 6] },
      restClass: 'strength',
      tempo: '2-0-X-0',
      fixedRom: true,
      stretchEmphasis: true,
    },
    ranking: { overloadSuitability: 3 },
    cues: [
      { en: 'Brace before you unrack and keep the bar over mid-foot.' },
      { en: 'Sit down between your hips until your hip crease is below the knee.' },
      { en: 'Drive up with intent, chest and hips rising together.' },
    ],
    custom: false,
    status: 'active',
  },
  {
    id: 'ex.barbell-bench-press',
    name: { en: 'Barbell bench press' },
    synonyms: ['bench press', 'flat bench press'],
    pattern: 'horizontalPush',
    mechanics: 'compound',
    competitionLift: 'bench',
    substitutionGroups: ['sg.horizontal-press'],
    equipment: {
      allOf: ['eq.barbell-olympic', 'eq.plates', 'eq.flat-bench'],
      anyOf: [['eq.power-rack', 'eq.squat-stand']],
    },
    muscles: [
      { muscle: 'mu.chest.sternocostal', credit: 1, evidence: 'H', source: 'src.pmid24265879' },
      { muscle: 'mu.triceps', credit: 0.5, evidence: 'H', source: 'src.pmid24265879' },
      { muscle: 'mu.front-delts', credit: 0.5, evidence: 'C', source: 'src.powr-eb-mapping' },
    ],
    load: { type: 'barbell', curveClass: 'benchLike', unilateral: false, bodyweightLoaded: false },
    defaults: {
      repRange: { hypertrophy: [6, 15], strength: [1, 6] },
      restClass: 'strength',
      tempo: '2-0-X-0',
      fixedRom: true,
      stretchEmphasis: false,
    },
    ranking: { overloadSuitability: 3 },
    cues: [
      { en: 'Pull your shoulder blades back and down and keep your feet planted.' },
      { en: 'Lower the bar under control to your lower chest, elbows slightly tucked.' },
      { en: 'Press the bar up and slightly back until your elbows lock out.' },
    ],
    custom: false,
    status: 'active',
  },
  {
    id: 'ex.barbell-deadlift',
    name: { en: 'Barbell deadlift' },
    synonyms: ['deadlift', 'conventional deadlift'],
    pattern: 'hinge',
    mechanics: 'compound',
    competitionLift: 'deadlift',
    substitutionGroups: ['sg.hinge-pattern'],
    equipment: { allOf: ['eq.barbell-olympic', 'eq.plates'], anyOf: [] },
    // The EB rates every deadlift credit as convention (C): no direct hypertrophy data.
    muscles: [
      { muscle: 'mu.glutes', credit: 1, evidence: 'C', source: 'src.powr-eb-mapping' },
      { muscle: 'mu.lower-back', credit: 1, evidence: 'C', source: 'src.powr-eb-mapping' },
      { muscle: 'mu.quads', credit: 0.5, evidence: 'C', source: 'src.powr-eb-mapping' },
      { muscle: 'mu.hamstrings', credit: 0.5, evidence: 'C', source: 'src.powr-eb-mapping' },
      { muscle: 'mu.adductors', credit: 0.5, evidence: 'C', source: 'src.powr-eb-mapping' },
      { muscle: 'mu.upper-traps', credit: 0.25, evidence: 'C', source: 'src.powr-eb-mapping' },
      { muscle: 'mu.forearms', credit: 0.25, evidence: 'C', source: 'src.powr-eb-mapping' },
    ],
    load: { type: 'barbell', curveClass: 'pooled', unilateral: false, bodyweightLoaded: false },
    defaults: {
      repRange: { hypertrophy: [6, 15], strength: [1, 6] },
      restClass: 'strength',
      tempo: '2-0-X-0',
      fixedRom: true,
      stretchEmphasis: false,
    },
    ranking: { overloadSuitability: 3 },
    cues: [
      { en: 'Start with the bar over mid-foot and your shins close to it.' },
      { en: 'Brace, pull the slack out of the bar, then push the floor away.' },
      { en: 'Keep the bar close and finish with hips and knees locked out together.' },
    ],
    custom: false,
    status: 'active',
  },
];
