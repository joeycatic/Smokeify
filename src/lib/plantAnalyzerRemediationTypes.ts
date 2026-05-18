import type {
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerProductSuggestion,
} from "@/lib/plantAnalyzerTypes";

export type PlantAnalyzerRemediationUrgency = "low" | "medium" | "high";

export type PlantAnalyzerRemediationStepKind =
  | "observe"
  | "adjust"
  | "monitor"
  | "buy_optional";

export type PlantAnalyzerRemediationStep = {
  id: string;
  title: string;
  detail: string;
  kind: PlantAnalyzerRemediationStepKind;
};

export type PlantAnalyzerMonitoringWindow = {
  label: string;
  summary: string;
  hoursMin: number;
  hoursMax: number;
  checkpoints: string[];
};

export type PlantAnalyzerFollowUpPrompt = {
  title: string;
  detail: string;
  comparisonHint: string;
};

export type PlantAnalyzerProductBundle = {
  name: string;
  summary: string;
  mustCheckItems: string[];
  optionalProducts: PlantAnalyzerProductSuggestion[];
  setupHelpers: PlantAnalyzerProductSuggestion[];
};

export type PlantAnalyzerSetupAdjustmentPath = {
  presetSlug: string;
  sizeKey: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export type PlantAnalyzerRemediationPlan = {
  detectedSymptoms: string[];
  urgency: PlantAnalyzerRemediationUrgency;
  careSteps: PlantAnalyzerRemediationStep[];
  monitoringWindow: PlantAnalyzerMonitoringWindow;
  followUpPrompt: PlantAnalyzerFollowUpPrompt;
  productBundle: PlantAnalyzerProductBundle;
  setupAdjustmentPath: PlantAnalyzerSetupAdjustmentPath | null;
  guideLinks: PlantAnalyzerGuideSuggestion[];
  uncertaintyNote: string;
};

export type PlantAnalyzerFeedbackClassification =
  | "helpful"
  | "issue_guess_wrong"
  | "product_suggestion_off"
  | "recommendation_relevant"
  | "follow_up_improved"
  | "follow_up_worsened"
  | "needs_recheck";

export type PlantAnalyzerFeedbackOutcome =
  | "improved"
  | "unchanged"
  | "worsened";

export type PlantAnalyzerStoredFeedback = {
  helpful: boolean;
  classification: PlantAnalyzerFeedbackClassification;
  outcome?: PlantAnalyzerFeedbackOutcome | null;
  comment?: string | null;
  recordedAt: string;
};
