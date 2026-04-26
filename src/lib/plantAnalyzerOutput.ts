import type {
  PlantAnalyzerAnalysisContext,
  PlantAnalyzerConfidenceBand,
  PlantAnalyzerDecisionSupport,
  PlantAnalyzerGuideSuggestion,
  PlantAnalyzerPossibleCause,
  PlantAnalyzerProductSuggestion,
  PlantAnalyzerReviewedCase,
  PlantAnalyzerStoredOutput,
  PlantAnalyzerTrendSummary,
  PlantAnalyzerVerificationCheck,
} from "@/lib/plantAnalyzerTypes";
import type {
  PlantAnalyzerRemediationPlan,
  PlantAnalyzerStoredFeedback,
} from "@/lib/plantAnalyzerRemediationTypes";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPrice = (
  value: unknown,
): value is PlantAnalyzerProductSuggestion["price"] => {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return typeof value.amount === "string" && value.currencyCode === "EUR";
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
    typeof value.reason === "string" &&
    (value.classification === undefined ||
      value.classification === "verify" ||
      value.classification === "stabilize" ||
      value.classification === "treat") &&
    (value.relatedTo === undefined ||
      value.relatedTo === null ||
      typeof value.relatedTo === "string")
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

const isConfidenceBand = (
  value: unknown,
): value is PlantAnalyzerConfidenceBand =>
  value === "low" || value === "medium" || value === "high";

const isPossibleCause = (
  value: unknown,
): value is PlantAnalyzerPossibleCause => {
  if (!isRecord(value)) return false;
  return (
    typeof value.label === "string" &&
    typeof value.confidence === "number" &&
    typeof value.whyThisFits === "string" &&
    typeof value.whatCouldAlsoExplainIt === "string"
  );
};

const isVerificationCheck = (
  value: unknown,
): value is PlantAnalyzerVerificationCheck => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.detail === "string"
  );
};

const isAnalysisContext = (
  value: unknown,
): value is PlantAnalyzerAnalysisContext => {
  if (!isRecord(value)) return false;
  return (
    (value.medium === undefined ||
      value.medium === "soil" ||
      value.medium === "coco" ||
      value.medium === "hydro" ||
      value.medium === "unknown") &&
    (value.growthStage === undefined ||
      value.growthStage === "seedling" ||
      value.growthStage === "veg" ||
      value.growthStage === "early_flower" ||
      value.growthStage === "late_flower" ||
      value.growthStage === "unknown") &&
    (value.wateringCadence === undefined ||
      typeof value.wateringCadence === "string") &&
    (value.ph === undefined || value.ph === null || typeof value.ph === "number") &&
    (value.ec === undefined || value.ec === null || typeof value.ec === "number") &&
    (value.temperatureC === undefined ||
      value.temperatureC === null ||
      typeof value.temperatureC === "number") &&
    (value.humidityPercent === undefined ||
      value.humidityPercent === null ||
      typeof value.humidityPercent === "number") &&
    (value.lightDistanceCm === undefined ||
      value.lightDistanceCm === null ||
      typeof value.lightDistanceCm === "number") &&
    (value.lightType === undefined || typeof value.lightType === "string") &&
    (value.tentOrRoomSize === undefined ||
      typeof value.tentOrRoomSize === "string")
  );
};

const isTrendSummary = (
  value: unknown,
): value is PlantAnalyzerTrendSummary => {
  if (!isRecord(value)) return false;
  return (
    (value.previousAnalysisId === null ||
      typeof value.previousAnalysisId === "string") &&
    (value.confidenceDelta === null ||
      typeof value.confidenceDelta === "number") &&
    isStringArray(value.issueLabelsAdded) &&
    isStringArray(value.issueLabelsRemoved) &&
    (value.followUpStatus === null ||
      value.followUpStatus === "pending" ||
      value.followUpStatus === "improved" ||
      value.followUpStatus === "unchanged" ||
      value.followUpStatus === "worsened")
  );
};

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

const isRemediationPlan = (
  value: unknown,
): value is PlantAnalyzerRemediationPlan => {
  if (!isRecord(value)) return false;
  return (
    isStringArray(value.detectedSymptoms) &&
    (value.urgency === "low" ||
      value.urgency === "medium" ||
      value.urgency === "high") &&
    Array.isArray(value.careSteps) &&
    isRecord(value.monitoringWindow) &&
    typeof value.monitoringWindow.label === "string" &&
    typeof value.monitoringWindow.summary === "string" &&
    typeof value.monitoringWindow.hoursMin === "number" &&
    typeof value.monitoringWindow.hoursMax === "number" &&
    isStringArray(value.monitoringWindow.checkpoints) &&
    isRecord(value.followUpPrompt) &&
    typeof value.followUpPrompt.title === "string" &&
    typeof value.followUpPrompt.detail === "string" &&
    typeof value.followUpPrompt.comparisonHint === "string" &&
    isRecord(value.productBundle) &&
    typeof value.productBundle.name === "string" &&
    typeof value.productBundle.summary === "string" &&
    isStringArray(value.productBundle.mustCheckItems) &&
    Array.isArray(value.productBundle.optionalProducts) &&
    value.productBundle.optionalProducts.every(isProductSuggestion) &&
    Array.isArray(value.productBundle.setupHelpers) &&
    value.productBundle.setupHelpers.every(isProductSuggestion) &&
    (value.setupAdjustmentPath === null ||
      (isRecord(value.setupAdjustmentPath) &&
        typeof value.setupAdjustmentPath.title === "string" &&
        typeof value.setupAdjustmentPath.description === "string" &&
        typeof value.setupAdjustmentPath.href === "string" &&
        typeof value.setupAdjustmentPath.ctaLabel === "string" &&
        typeof value.setupAdjustmentPath.presetSlug === "string" &&
        typeof value.setupAdjustmentPath.sizeKey === "string")) &&
    Array.isArray(value.guideLinks) &&
    value.guideLinks.every(isGuideSuggestion) &&
    typeof value.uncertaintyNote === "string"
  );
};

const isStoredFeedback = (
  value: unknown,
): value is PlantAnalyzerStoredFeedback => {
  if (!isRecord(value)) return false;
  return (
    typeof value.helpful === "boolean" &&
    typeof value.classification === "string" &&
    typeof value.recordedAt === "string" &&
    (value.comment === undefined ||
      value.comment === null ||
      typeof value.comment === "string") &&
    (value.outcome === undefined ||
      value.outcome === null ||
      value.outcome === "improved" ||
      value.outcome === "unchanged" ||
      value.outcome === "worsened")
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

export function getPlantAnalyzerCachedRemediationPlan(
  value: unknown,
): PlantAnalyzerRemediationPlan | null {
  const output = getPlantAnalyzerStoredOutput(value);
  return isRemediationPlan(output.remediationPlan) ? output.remediationPlan : null;
}

export function getPlantAnalyzerDecisionSupport(
  value: unknown,
): PlantAnalyzerDecisionSupport | null {
  const output = getPlantAnalyzerStoredOutput(value);

  if (
    typeof output.summary !== "string" ||
    !isStringArray(output.observedSymptoms) ||
    !Array.isArray(output.possibleCauses) ||
    !output.possibleCauses.every(isPossibleCause) ||
    !Array.isArray(output.verificationChecks) ||
    !output.verificationChecks.every(isVerificationCheck) ||
    !isStringArray(output.immediateActions) ||
    !isStringArray(output.deferActions) ||
    !isStringArray(output.environmentConsiderations) ||
    typeof output.uncertaintyNote !== "string" ||
    !isConfidenceBand(output.confidenceBand) ||
    typeof output.needsHumanReview !== "boolean"
  ) {
    return null;
  }

  return {
    summary: output.summary,
    observedSymptoms: output.observedSymptoms,
    possibleCauses: output.possibleCauses,
    verificationChecks: output.verificationChecks,
    immediateActions: output.immediateActions,
    deferActions: output.deferActions,
    environmentConsiderations: output.environmentConsiderations,
    uncertaintyNote: output.uncertaintyNote,
    confidenceBand: output.confidenceBand,
    needsHumanReview: output.needsHumanReview,
  };
}

export function getPlantAnalyzerStoredContext(
  value: unknown,
): PlantAnalyzerAnalysisContext | null {
  const output = getPlantAnalyzerStoredOutput(value);
  return isAnalysisContext(output.analysisContext) ? output.analysisContext : null;
}

export function getPlantAnalyzerStoredTrendSummary(
  value: unknown,
): PlantAnalyzerTrendSummary | null {
  const output = getPlantAnalyzerStoredOutput(value);
  return isTrendSummary(output.trendSummary) ? output.trendSummary : null;
}

export function getPlantAnalyzerStoredFeedback(
  value: unknown,
): PlantAnalyzerStoredFeedback | null {
  const output = getPlantAnalyzerStoredOutput(value);
  return isStoredFeedback(output.lastFeedback) ? output.lastFeedback : null;
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
