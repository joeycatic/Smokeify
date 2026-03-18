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

export type PlantAnalyzerProductSuggestion = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string;
  price: { amount: string; currencyCode: "EUR" } | null;
  reason: string;
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
  productSuggestions?: PlantAnalyzerProductSuggestion[];
  guideSuggestions?: PlantAnalyzerGuideSuggestion[];
  usedFallback?: boolean;
};
