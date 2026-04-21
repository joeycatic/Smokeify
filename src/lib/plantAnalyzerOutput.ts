import type {
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerProductSuggestion,
  PlantAnalyzerReviewedCase,
  PlantAnalyzerStoredOutput,
} from "@/lib/plantAnalyzerTypes";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPrice = (
  value: unknown,
): value is PlantAnalyzerProductSuggestion["price"] => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    typeof value.amount === "string" &&
    value.currencyCode === "EUR"
  );
};

const isProductSuggestion = (
  value: unknown,
): value is PlantAnalyzerProductSuggestion => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.handle === "string" &&
    (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    typeof value.imageAlt === "string" &&
    isPrice(value.price) &&
    typeof value.reason === "string"
  );
};

const isGuideSuggestion = (
  value: unknown,
): value is PlantAnalyzerGuideSuggestion => {
  if (!isRecord(value)) return false;
  return (
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.href === "string"
  );
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isDiagnosisOverride = (value: unknown) => {
  if (!isRecord(value)) return false;
  return (
    (value.species === undefined || typeof value.species === "string") &&
    (value.confidence === undefined || typeof value.confidence === "number") &&
    (value.healthStatus === undefined ||
      value.healthStatus === "healthy" ||
      value.healthStatus === "warning" ||
      value.healthStatus === "critical") &&
    (value.recommendations === undefined || isStringArray(value.recommendations))
  );
};

const isReviewedCase = (
  value: unknown,
): value is PlantAnalyzerReviewedCase => {
  if (!isRecord(value)) return false;
  return (
    typeof value.reviewStatus === "string" &&
    (value.queueStatus === "new" ||
      value.queueStatus === "in_review" ||
      value.queueStatus === "rerun_requested" ||
      value.queueStatus === "resolved" ||
      value.queueStatus === "dismissed") &&
    (value.reviewedAt === null ||
      value.reviewedAt === undefined ||
      typeof value.reviewedAt === "string") &&
    (value.reviewNotes === null ||
      value.reviewNotes === undefined ||
      typeof value.reviewNotes === "string") &&
    isStringArray(value.qualityLabels) &&
    (value.override === undefined ||
      value.override === null ||
      (isRecord(value.override) &&
        (value.override.diagnosis === undefined ||
          value.override.diagnosis === null ||
          isDiagnosisOverride(value.override.diagnosis)) &&
        (value.override.productSuggestions === undefined ||
          (Array.isArray(value.override.productSuggestions) &&
            value.override.productSuggestions.every(isProductSuggestion))) &&
        (value.override.resolutionNote === undefined ||
          value.override.resolutionNote === null ||
          typeof value.override.resolutionNote === "string")))
  );
};

export function getPlantAnalyzerStoredOutput(
  value: unknown,
): PlantAnalyzerStoredOutput {
  return isRecord(value) ? (value as PlantAnalyzerStoredOutput) : {};
}

export function getPlantAnalyzerCachedSuggestions(value: unknown): {
  productSuggestions: PlantAnalyzerProductSuggestion[];
  guideSuggestions: PlantAnalyzerGuideSuggestion[];
} | null {
  const output = getPlantAnalyzerStoredOutput(value);
  const productSuggestions = Array.isArray(output.productSuggestions)
    ? output.productSuggestions.filter(isProductSuggestion)
    : [];
  const guideSuggestions = Array.isArray(output.guideSuggestions)
    ? output.guideSuggestions.filter(isGuideSuggestion)
    : [];

  if (productSuggestions.length === 0 && guideSuggestions.length === 0) {
    return null;
  }

  return { productSuggestions, guideSuggestions };
}

export function getPlantAnalyzerReviewedCase(
  value: unknown,
): PlantAnalyzerReviewedCase | null {
  const output = getPlantAnalyzerStoredOutput(value);
  return isReviewedCase(output.reviewedCase) ? output.reviewedCase : null;
}

export function mergePlantAnalyzerStoredOutput(
  value: unknown,
  next: Partial<PlantAnalyzerStoredOutput>,
) {
  const output = getPlantAnalyzerStoredOutput(value);
  return {
    ...output,
    ...next,
  };
}
