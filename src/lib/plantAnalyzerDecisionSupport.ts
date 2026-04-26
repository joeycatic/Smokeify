import type {
  PlantAnalyzerAnalysisContext,
  PlantAnalyzerConfidenceBand,
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerHealthStatus,
  PlantAnalyzerIssue,
  PlantAnalyzerPossibleCause,
  PlantAnalyzerProductSuggestion,
  PlantAnalyzerTrendSummary,
  PlantAnalyzerVerificationCheck,
} from "@/lib/plantAnalyzerTypes";

const MAX_SHORT_TEXT = 120;
const MAX_WATERING_TEXT = 180;

export const PLANT_ANALYZER_PROMPT_VERSION = "smokeify-storefront-v2";
export const PLANT_ANALYZER_REASONING_VERSION = "smokeify-storefront-v2";
export const PLANT_ANALYZER_LOW_CONFIDENCE_THRESHOLD = 0.58;
export const PLANT_ANALYZER_MEDIUM_CONFIDENCE_THRESHOLD = 0.78;

export type PlantAnalyzerFollowUpStatus =
  | "pending"
  | "improved"
  | "unchanged"
  | "worsened";

export type PlantAnalyzerDecisionSupportResult = {
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
  recommendedRecheckWindowHoursMin: number;
  recommendedRecheckWindowHoursMax: number;
};

type DecisionSupportInput = {
  healthStatus: PlantAnalyzerHealthStatus;
  confidence: number;
  summary: string;
  observedSymptoms: string[];
  possibleCauses: PlantAnalyzerPossibleCause[];
  verificationChecks: PlantAnalyzerVerificationCheck[];
  immediateActions: string[];
  deferActions: string[];
  environmentConsiderations: string[];
  uncertaintyNote: string;
};

function sanitizeShortText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function sanitizeNumber(
  value: unknown,
  { min, max }: { min: number; max: number },
) {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizePlantAnalyzerContext(
  value: unknown,
): PlantAnalyzerAnalysisContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const normalized: PlantAnalyzerAnalysisContext = {};

  if (
    record.medium === "soil" ||
    record.medium === "coco" ||
    record.medium === "hydro" ||
    record.medium === "unknown"
  ) {
    normalized.medium = record.medium;
  }

  if (
    record.growthStage === "seedling" ||
    record.growthStage === "veg" ||
    record.growthStage === "early_flower" ||
    record.growthStage === "late_flower" ||
    record.growthStage === "unknown"
  ) {
    normalized.growthStage = record.growthStage;
  }

  const wateringCadence = sanitizeShortText(record.wateringCadence, MAX_WATERING_TEXT);
  if (wateringCadence) normalized.wateringCadence = wateringCadence;

  const lightType = sanitizeShortText(record.lightType, MAX_SHORT_TEXT);
  if (lightType) normalized.lightType = lightType;

  const tentOrRoomSize = sanitizeShortText(record.tentOrRoomSize, MAX_SHORT_TEXT);
  if (tentOrRoomSize) normalized.tentOrRoomSize = tentOrRoomSize;

  const ph = sanitizeNumber(record.ph, { min: 0, max: 14 });
  if (ph !== undefined) normalized.ph = Number(ph.toFixed(2));

  const ec = sanitizeNumber(record.ec, { min: 0, max: 10 });
  if (ec !== undefined) normalized.ec = Number(ec.toFixed(2));

  const temperatureC = sanitizeNumber(record.temperatureC, { min: -5, max: 60 });
  if (temperatureC !== undefined) normalized.temperatureC = Number(temperatureC.toFixed(1));

  const humidityPercent = sanitizeNumber(record.humidityPercent, { min: 0, max: 100 });
  if (humidityPercent !== undefined) {
    normalized.humidityPercent = Number(humidityPercent.toFixed(1));
  }

  const lightDistanceCm = sanitizeNumber(record.lightDistanceCm, { min: 0, max: 500 });
  if (lightDistanceCm !== undefined) {
    normalized.lightDistanceCm = Number(lightDistanceCm.toFixed(1));
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function hasMeaningfulPlantAnalyzerContext(
  value: PlantAnalyzerAnalysisContext | null | undefined,
) {
  return Boolean(value && Object.keys(value).length > 0);
}

export function getPlantAnalyzerConfidenceBand(
  confidence: number,
): PlantAnalyzerConfidenceBand {
  if (confidence < PLANT_ANALYZER_LOW_CONFIDENCE_THRESHOLD) return "low";
  if (confidence < PLANT_ANALYZER_MEDIUM_CONFIDENCE_THRESHOLD) return "medium";
  return "high";
}

export function derivePlantAnalyzerNeedsHumanReview(input: {
  confidenceBand: PlantAnalyzerConfidenceBand;
  healthStatus: PlantAnalyzerHealthStatus;
  possibleCauses: PlantAnalyzerPossibleCause[];
  verificationChecks: PlantAnalyzerVerificationCheck[];
}) {
  if (input.confidenceBand === "low") return true;
  if (input.healthStatus === "critical" && input.confidenceBand !== "high") return true;
  if (input.possibleCauses.length === 0) return true;
  if (input.verificationChecks.length === 0) return true;
  return false;
}

export function buildPlantAnalyzerDecisionSupport(
  input: DecisionSupportInput,
): PlantAnalyzerDecisionSupportResult {
  const confidenceBand = getPlantAnalyzerConfidenceBand(input.confidence);
  const defaultRecheckWindow =
    input.healthStatus === "critical"
      ? { min: 12, max: 24 }
      : confidenceBand === "low"
        ? { min: 24, max: 48 }
        : input.healthStatus === "healthy"
          ? { min: 48, max: 72 }
          : { min: 24, max: 48 };

  return {
    summary: input.summary,
    observedSymptoms: input.observedSymptoms,
    possibleCauses: input.possibleCauses,
    verificationChecks: input.verificationChecks,
    immediateActions: input.immediateActions,
    deferActions: input.deferActions,
    environmentConsiderations: input.environmentConsiderations,
    uncertaintyNote: input.uncertaintyNote,
    confidenceBand,
    needsHumanReview: derivePlantAnalyzerNeedsHumanReview({
      confidenceBand,
      healthStatus: input.healthStatus,
      possibleCauses: input.possibleCauses,
      verificationChecks: input.verificationChecks,
    }),
    recommendedRecheckWindowHoursMin: defaultRecheckWindow.min,
    recommendedRecheckWindowHoursMax: defaultRecheckWindow.max,
  };
}

function looksLikeSetupHelper(product: PlantAnalyzerProductSuggestion) {
  const haystack = `${product.title} ${product.handle} ${product.reason}`.toLowerCase();
  return [
    "vent",
    "clip",
    "air",
    "luft",
    "humid",
    "dehumid",
    "meter",
    "mess",
    "ph",
    "ec",
    "thermo",
  ].some((term) => haystack.includes(term));
}

export function classifyPlantAnalyzerProductSuggestion(
  product: PlantAnalyzerProductSuggestion,
): PlantAnalyzerProductSuggestion["classification"] {
  const haystack = `${product.title} ${product.handle} ${product.reason}`.toLowerCase();
  if (looksLikeSetupHelper(product)) return "verify";
  if (
    haystack.includes("calmag") ||
    haystack.includes("grow") ||
    haystack.includes("bloom") ||
    haystack.includes("dünger") ||
    haystack.includes("duenger")
  ) {
    return "treat";
  }
  return "stabilize";
}

export function applyPlantAnalyzerSuggestionGovernance(input: {
  productSuggestions: PlantAnalyzerProductSuggestion[];
  possibleCauses: PlantAnalyzerPossibleCause[];
  confidenceBand: PlantAnalyzerConfidenceBand;
}) {
  const topCause = input.possibleCauses[0]?.label ?? null;
  const decorated = input.productSuggestions.map((product) => ({
    ...product,
    classification: classifyPlantAnalyzerProductSuggestion(product),
    relatedTo: topCause,
  }));

  if (input.confidenceBand !== "low") {
    return decorated;
  }

  return decorated.filter(
    (product) =>
      product.classification === "verify" || product.classification === "stabilize",
  );
}

export function buildPlantAnalyzerTrendSummary(input: {
  previousAnalysisId: string | null;
  previousConfidence: number | null;
  previousIssues: PlantAnalyzerIssue[];
  currentConfidence: number;
  currentIssues: PlantAnalyzerIssue[];
  followUpStatus: PlantAnalyzerFollowUpStatus | null;
}): PlantAnalyzerTrendSummary | null {
  if (!input.previousAnalysisId) return null;

  const previousLabels = new Set(input.previousIssues.map((issue) => issue.label));
  const currentLabels = new Set(input.currentIssues.map((issue) => issue.label));

  return {
    previousAnalysisId: input.previousAnalysisId,
    confidenceDelta:
      input.previousConfidence === null
        ? null
        : Number((input.currentConfidence - input.previousConfidence).toFixed(3)),
    issueLabelsAdded: [...currentLabels].filter((label) => !previousLabels.has(label)),
    issueLabelsRemoved: [...previousLabels].filter((label) => !currentLabels.has(label)),
    followUpStatus: input.followUpStatus,
  };
}

export function mapStoredFollowUpStatus(
  value: string | null | undefined,
): PlantAnalyzerFollowUpStatus | null {
  if (value === "PENDING" || value === "pending") return "pending";
  if (value === "IMPROVED" || value === "improved") return "improved";
  if (value === "UNCHANGED" || value === "unchanged") return "unchanged";
  if (value === "WORSENED" || value === "worsened") return "worsened";
  return null;
}

export function buildPlantAnalyzerContextSummary(
  context: PlantAnalyzerAnalysisContext | null | undefined,
) {
  if (!context) return [];

  const lines: string[] = [];
  if (context.medium && context.medium !== "unknown") {
    lines.push(`Medium: ${context.medium}`);
  }
  if (context.growthStage && context.growthStage !== "unknown") {
    lines.push(`Stage: ${context.growthStage}`);
  }
  if (typeof context.ph === "number") lines.push(`pH: ${context.ph}`);
  if (typeof context.ec === "number") lines.push(`EC: ${context.ec}`);
  if (typeof context.temperatureC === "number") {
    lines.push(`Temp: ${context.temperatureC} C`);
  }
  if (typeof context.humidityPercent === "number") {
    lines.push(`Humidity: ${context.humidityPercent}%`);
  }
  if (typeof context.lightDistanceCm === "number") {
    lines.push(`Light distance: ${context.lightDistanceCm} cm`);
  }
  if (context.lightType) lines.push(`Light: ${context.lightType}`);
  if (context.tentOrRoomSize) lines.push(`Space: ${context.tentOrRoomSize}`);
  if (context.wateringCadence) lines.push(`Watering: ${context.wateringCadence}`);
  return lines;
}

export function mergeAnalyzerGuideLinks(
  suggestions: PlantAnalyzerGuideSuggestion[],
) {
  return suggestions.slice(0, 4);
}
