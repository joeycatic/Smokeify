import type {
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerProductSuggestion,
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
