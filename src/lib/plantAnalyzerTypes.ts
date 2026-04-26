import type {
  PlantAnalyzerRemediationPlan,
  PlantAnalyzerStoredFeedback,
} from "@/lib/plantAnalyzerRemediationTypes";

export type PlantAnalyzerIssueSeverity =
  | "healthy"
  | "warning"
  | "critical";

export type PlantAnalyzerHealthStatus =
  | "healthy"
  | "warning"
  | "critical";

export type PlantAnalyzerIssue = {
  id: string;
  label: string;
  confidence: number;
  severity: PlantAnalyzerIssueSeverity;
};

export type PlantAnalyzerConfidenceBand = "low" | "medium" | "high";

export type PlantAnalyzerContextMedium =
  | "soil"
  | "coco"
  | "hydro"
  | "unknown";

export type PlantAnalyzerGrowthStage =
  | "seedling"
  | "veg"
  | "early_flower"
  | "late_flower"
  | "unknown";

export type PlantAnalyzerAnalysisContext = {
  medium?: PlantAnalyzerContextMedium;
  growthStage?: PlantAnalyzerGrowthStage;
  wateringCadence?: string;
  ph?: number | null;
  ec?: number | null;
  temperatureC?: number | null;
  humidityPercent?: number | null;
  lightDistanceCm?: number | null;
  lightType?: string;
  tentOrRoomSize?: string;
};

export type PlantAnalyzerPossibleCause = {
  label: string;
  confidence: number;
  whyThisFits: string;
  whatCouldAlsoExplainIt: string;
};

export type PlantAnalyzerVerificationCheck = {
  id: string;
  title: string;
  detail: string;
};

export type PlantAnalyzerTrendSummary = {
  previousAnalysisId: string | null;
  confidenceDelta: number | null;
  issueLabelsAdded: string[];
  issueLabelsRemoved: string[];
  followUpStatus: "pending" | "improved" | "unchanged" | "worsened" | null;
};

export type PlantAnalyzerFollowUp = {
  recommendedRecheckWindowHoursMin: number | null;
  recommendedRecheckWindowHoursMax: number | null;
  followUpStatus: "pending" | "improved" | "unchanged" | "worsened" | null;
  followUpRecordedAt: string | null;
  previousAnalysisId: string | null;
  trendSummary?: PlantAnalyzerTrendSummary | null;
};

export type PlantAnalyzerProductSuggestion = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string;
  price: { amount: string; currencyCode: "EUR" } | null;
  reason: string;
  classification?: "verify" | "stabilize" | "treat";
  relatedTo?: string | null;
};

export type PlantAnalyzerGuideSuggestion = {
  slug: string;
  title: string;
  description: string;
  href: string;
};

export type PlantAnalyzerDiagnosis = {
  healthStatus: PlantAnalyzerHealthStatus;
  species: string;
  confidence: number;
  issues: PlantAnalyzerIssue[];
  recommendations: string[];
};

export type PlantAnalyzerDecisionSupport = {
  summary: string;
  observedSymptoms: string[];
  possibleCauses: PlantAnalyzerPossibleCause[];
  verificationChecks: PlantAnalyzerVerificationCheck[];
  immediateActions: string[];
  deferActions: string[];
  environmentConsiderations: string[];
  uncertaintyNote: string;
  confidenceBand: PlantAnalyzerConfidenceBand;
  needsHumanReview: boolean;
};

export type PlantAnalyzerReviewOverride = {
  diagnosis?: Partial<PlantAnalyzerDiagnosis> | null;
  productSuggestions?: PlantAnalyzerProductSuggestion[];
  resolutionNote?: string | null;
};

export type PlantAnalyzerReviewedCase = {
  reviewStatus: string;
  queueStatus: "new" | "in_review" | "rerun_requested" | "resolved" | "dismissed";
  reviewedAt: string | null;
  reviewNotes: string | null;
  qualityLabels: string[];
  override?: PlantAnalyzerReviewOverride | null;
};

export type PlantAnalyzerStoredOutput = {
  species?: string;
  confidence?: number;
  healthStatus?: PlantAnalyzerHealthStatus | "unknown";
  plantVisible?: boolean;
  imageUsable?: boolean;
  inputProblem?:
    | "none"
    | "no_plant_visible"
    | "text_only"
    | "not_a_plant_photo"
    | "too_unclear";
  issues?: PlantAnalyzerIssue[];
  recommendations?: string[];
  summary?: string;
  observedSymptoms?: string[];
  possibleCauses?: PlantAnalyzerPossibleCause[];
  verificationChecks?: PlantAnalyzerVerificationCheck[];
  immediateActions?: string[];
  deferActions?: string[];
  environmentConsiderations?: string[];
  confidenceBand?: PlantAnalyzerConfidenceBand;
  needsHumanReview?: boolean;
  uncertaintyNote?: string;
  analysisContext?: PlantAnalyzerAnalysisContext;
  contextUsed?: boolean;
  promptVersion?: string;
  reasoningVersion?: string;
  recommendedRecheckWindowHoursMin?: number;
  recommendedRecheckWindowHoursMax?: number;
  followUpStatus?: "pending" | "improved" | "unchanged" | "worsened" | null;
  followUpRecordedAt?: string | null;
  previousAnalysisId?: string | null;
  trendSummary?: PlantAnalyzerTrendSummary | null;
  productSuggestions?: PlantAnalyzerProductSuggestion[];
  guideSuggestions?: PlantAnalyzerGuideSuggestion[];
  remediationPlan?: PlantAnalyzerRemediationPlan;
  lastFeedback?: PlantAnalyzerStoredFeedback;
  usedFallback?: boolean;
  reviewedCase?: PlantAnalyzerReviewedCase;
};
