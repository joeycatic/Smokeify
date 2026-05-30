import type {
  PlantAnalyzerAnalysisContext,
  PlantAnalyzerConsideredInput,
  PlantAnalyzerConfidenceBand,
  PlantAnalyzerDiagnosis,
  PlantAnalyzerFollowUp,
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerHealthStatus,
  PlantAnalyzerInfluenceNote,
  PlantAnalyzerIssue,
  PlantAnalyzerPossibleCause,
  PlantAnalyzerProductSuggestion,
  PlantAnalyzerReviewedCase,
  PlantAnalyzerVerificationCheck,
} from "@/lib/plantAnalyzerTypes";
import type {
  PlantAnalyzerRemediationPlan,
  PlantAnalyzerStoredFeedback,
} from "@/lib/plantAnalyzerRemediationTypes";
import type { PlantAnalysisPublicationOwnerState } from "@/lib/plantAnalysisPublication";

export type Locale = "de" | "en";

export type AnalyzerResponse = {
  analysisId: string | null;
  storageWarning?: string | null;
  diagnosis: PlantAnalyzerDiagnosis;
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
  analysisContext: PlantAnalyzerAnalysisContext | null;
  consideredInputs: PlantAnalyzerConsideredInput[];
  influenceNotes: PlantAnalyzerInfluenceNote[];
  contextUsed: boolean;
  promptVersion: string | null;
  reasoningVersion: string | null;
  followUp: PlantAnalyzerFollowUp;
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
  remediation: PlantAnalyzerRemediationPlan;
  lastFeedback: PlantAnalyzerStoredFeedback | null;
  reviewedCase: PlantAnalyzerReviewedCase | null;
  publication: PlantAnalysisPublicationOwnerState | null;
};

export type AnalysisHistoryEntry = {
  id: string;
  imageUri: string;
  species: string;
  confidence: number;
  confidenceBand: PlantAnalyzerConfidenceBand;
  healthStatus: PlantAnalyzerHealthStatus;
  issues: PlantAnalyzerIssue[];
  recommendations: string[];
  summary: string;
  observedSymptoms: string[];
  needsHumanReview: boolean;
  analysisContext: PlantAnalyzerAnalysisContext | null;
  followUp: PlantAnalyzerFollowUp;
  analyzedAt: string;
  modelVersion: string;
  reviewedCase: PlantAnalyzerReviewedCase | null;
  publication: PlantAnalysisPublicationOwnerState | null;
};

export type HistoryReportDetail = {
  id: string;
  imageUri: string;
  diagnosis: PlantAnalyzerDiagnosis;
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
  analysisContext: PlantAnalyzerAnalysisContext | null;
  consideredInputs: PlantAnalyzerConsideredInput[];
  influenceNotes: PlantAnalyzerInfluenceNote[];
  contextUsed: boolean;
  promptVersion: string | null;
  reasoningVersion: string | null;
  followUp: PlantAnalyzerFollowUp;
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
  remediation: PlantAnalyzerRemediationPlan;
  lastFeedback: PlantAnalyzerStoredFeedback | null;
  reviewedCase: PlantAnalyzerReviewedCase | null;
  publication: PlantAnalysisPublicationOwnerState | null;
};

export type AnalyzerStatus = "idle" | "loading" | "success" | "error";

export type AsyncStatus = "idle" | "loading" | "error";

export type AnalyzerSessionStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated";

export type LoadingStep = {
  title: string;
  detail: string;
  color: string;
};
