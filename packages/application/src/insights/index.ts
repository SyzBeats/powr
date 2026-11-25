/**
 * `@powr/application/insights`: insight and motivation (M4a; ANL-01…07, MAP-04 data, MOT-01…04,
 * BOD-01…03, PRG-07/TD-44). A separate entry that the app loads with `import()`, like the planning
 * and session entries: the analytics engine and the rules resolver stay off the startup path
 * (§8.19). Every use case takes the composition root's `Deps`; expected failures are `Result`s;
 * the `observe*` functions are live queries (Dexie `liveQuery` through `LiveQueries.observe`).
 * `IMPLEMENTATION_NOTES.md` ("M4a analytics core") documents the API and the data shapes.
 */
export {
  bodyweightOverview,
  deleteBodyweight,
  deleteMeasurement,
  editBodyweight,
  editMeasurement,
  logBodyweight,
  logMeasurement,
  measurementsOverview,
  observeBodyweight,
  type BodyweightError,
  type BodyweightView,
  type MeasurementError,
  type MeasurementsView,
} from './body';
export { insightPreferences, type InsightPreferences } from './context';
export { ensureInsights, rebuildInsights, type InsightsReport } from './derived';
export {
  exerciseHistory,
  prHistory,
  sessionHistory,
  trainingCalendar,
  type ExerciseHistoryView,
} from './history';
export {
  homeView,
  observeHome,
  type HomeBodyweight,
  type HomeLastSession,
  type HomeNext,
  type HomeTrendChange,
  type HomeView,
} from './home';
export { scores, type ScoreBoardView } from './scores';
export {
  markWeekAsBreak,
  sessionStreakChange,
  streakView,
  updateInsightPreferences,
  type InsightPreferencesPatch,
  type MarkBreakError,
  type StreakView,
} from './streak';
export { exerciseSummaries, type ExerciseSummary, type SummaryQuery } from './summaries';
export {
  compareTrends,
  exercisePerformance,
  exerciseTrend,
  progressionAdvice,
  type ExerciseTrendView,
  type PerformanceView,
  type ProgressionAdvice,
  type TrendQuery,
} from './trends';
export {
  observeWeeklyVolume,
  volumeHistory,
  weeklyVolume,
  type VolumeMode,
  type VolumeQuery,
  type WeeklyVolumeView,
} from './volume';
