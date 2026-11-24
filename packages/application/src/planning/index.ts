/**
 * `@powr/application/planning`: the onboarding, equipment and planning use cases (M2: ONB, EQP,
 * PLN, PRG-10…13). A separate entry that the app loads with `import()`: the plan generator, the
 * rules resolver it calls through `deps.rules` and the content lookups stay off the startup path
 * (§8.19). Every use case takes the composition root's `Deps`; expected failures are `Result`s.
 */
export {
  answersFromProfile,
  traineeLevel,
  type PlanOptions,
  type PlanningAnswers,
} from './context';
export {
  applyEquipmentChange,
  deleteEquipmentProfile,
  equipmentProfileFromPreset,
  listEquipmentPresets,
  newCustomEquipmentItem,
  previewEquipmentChange,
  saveEquipmentProfile,
  setDefaultEquipmentProfile,
  type AffectedSlot,
  type EquipmentProfileError,
  type PresetSummary,
} from './equipment';
export {
  acceptNextMesocycle,
  bringDeloadForward,
  checkReactiveDeload,
  postponeDeload,
  proposeNextMesocycle,
  skipDeload,
  type MesocycleError,
  type NextMesocyclePreview,
  type ReactiveDeloadCheck,
} from './mesocycle';
export {
  LEGAL_ACK_KEY,
  ONBOARDING_DRAFT_KEY,
  acknowledgeLegal,
  completeOnboarding,
  isLegalAcknowledged,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type CompleteOnboardingError,
  type LegalVersions,
  type OnboardingAnswers,
  type OnboardingDraft,
} from './onboarding';
export {
  acceptPlan,
  currentMesocycle,
  generatePlanPreview,
  previewPlanEdit,
  savePlanEdit,
  type AcceptPlanError,
  type EditScope,
  type PlanEditError,
  type PlanEditPreview,
  type PlanPreview,
  type PlanPreviewError,
} from './plan';
export {
  endBreak,
  listMissedSessions,
  moveSession,
  resolveMissedSession,
  startBreak,
  swapSessions,
  type MissedChoice,
  type ScheduleChange,
  type ScheduleError,
} from './schedule';
