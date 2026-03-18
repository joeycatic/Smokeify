import type {
  PlantAnalyzerDiagnosis,
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerHealthStatus,
  PlantAnalyzerIssue,
  PlantAnalyzerProductSuggestion,
} from "@/lib/plantAnalyzerTypes";

export type Locale = "de" | "en";

export type AnalyzerResponse = {
  diagnosis: PlantAnalyzerDiagnosis;
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
};

export type AnalysisHistoryEntry = {
  id: string;
  imageUri: string;
  species: string;
  confidence: number;
  healthStatus: PlantAnalyzerHealthStatus;
  issues: PlantAnalyzerIssue[];
  recommendations: string[];
  analyzedAt: string;
  modelVersion: string;
};

export type HistoryReportDetail = {
  id: string;
  imageUri: string;
  diagnosis: PlantAnalyzerDiagnosis;
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
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
