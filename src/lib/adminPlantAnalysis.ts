export const PLANT_ANALYSIS_REVIEW_STATUSES = [
  "UNREVIEWED",
  "REVIEWED_OK",
  "REVIEWED_INCORRECT",
  "REVIEWED_UNSAFE",
  "NEEDS_PROMPT_FIX",
  "NEEDS_RECOMMENDATION_FIX",
  "PRIVACY_REVIEW",
] as const;

export type PlantAnalysisReviewStatus =
  (typeof PLANT_ANALYSIS_REVIEW_STATUSES)[number];

export type PlantAnalysisSafetyFlag =
  | "OVERCONFIDENT"
  | "MEDICAL_OR_LEGAL_CLAIM"
  | "UNSAFE_ACTION"
  | "IRRELEVANT_PRODUCT_RECOMMENDATION"
  | "LOW_IMAGE_QUALITY"
  | "USER_DISPUTED"
  | "PRIVACY_SENSITIVE_IMAGE";

export const PLANT_ANALYSIS_SAFETY_FLAGS: PlantAnalysisSafetyFlag[] = [
  "OVERCONFIDENT",
  "MEDICAL_OR_LEGAL_CLAIM",
  "UNSAFE_ACTION",
  "IRRELEVANT_PRODUCT_RECOMMENDATION",
  "LOW_IMAGE_QUALITY",
  "USER_DISPUTED",
  "PRIVACY_SENSITIVE_IMAGE",
];

export type PlantAnalysisQueueInput = {
  confidence: number;
  healthStatus: "HEALTHY" | "WARNING" | "CRITICAL" | string;
  reviewStatus?: PlantAnalysisReviewStatus | null;
  safetyFlags?: PlantAnalysisSafetyFlag[] | null;
  createdAt: Date;
  feedback?: Array<{ isCorrect: boolean }> | null;
};

const UNRESOLVED_REVIEW_STATUSES = new Set<PlantAnalysisReviewStatus>([
  "UNREVIEWED",
  "REVIEWED_INCORRECT",
  "REVIEWED_UNSAFE",
  "NEEDS_PROMPT_FIX",
  "NEEDS_RECOMMENDATION_FIX",
  "PRIVACY_REVIEW",
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizePlantAnalysisReviewStatus(
  value?: string | null,
): PlantAnalysisReviewStatus {
  return PLANT_ANALYSIS_REVIEW_STATUSES.includes(value as PlantAnalysisReviewStatus)
    ? (value as PlantAnalysisReviewStatus)
    : "UNREVIEWED";
}

export function isPlantAnalysisReviewUnresolved(
  value?: string | null,
) {
  return UNRESOLVED_REVIEW_STATUSES.has(normalizePlantAnalysisReviewStatus(value));
}

export function getPlantAnalysisReviewPriority(input: PlantAnalysisQueueInput) {
  let score = 0;
  const status = normalizePlantAnalysisReviewStatus(input.reviewStatus);
  const feedback = input.feedback ?? [];
  const safetyFlags = input.safetyFlags ?? [];
  const ageDays = Math.max(0, Math.floor((Date.now() - input.createdAt.getTime()) / MS_PER_DAY));

  if (feedback.some((entry) => !entry.isCorrect)) score += 100;
  if (status === "REVIEWED_UNSAFE") score += 90;
  if (status === "PRIVACY_REVIEW") score += 85;
  if (status === "NEEDS_PROMPT_FIX") score += 80;
  if (status === "NEEDS_RECOMMENDATION_FIX") score += 75;
  if (status === "REVIEWED_INCORRECT") score += 70;

  if (safetyFlags.includes("UNSAFE_ACTION")) score += 65;
  if (safetyFlags.includes("MEDICAL_OR_LEGAL_CLAIM")) score += 60;
  if (safetyFlags.includes("PRIVACY_SENSITIVE_IMAGE")) score += 55;
  if (safetyFlags.includes("IRRELEVANT_PRODUCT_RECOMMENDATION")) score += 45;
  if (safetyFlags.includes("OVERCONFIDENT")) score += 35;
  if (safetyFlags.includes("LOW_IMAGE_QUALITY")) score += 20;
  if (safetyFlags.includes("USER_DISPUTED")) score += 50;

  if (input.confidence < 0.45) score += 40;
  else if (input.confidence < 0.65) score += 25;

  if (input.healthStatus === "CRITICAL") score += 20;
  if (input.healthStatus === "WARNING") score += 10;
  if (status === "UNREVIEWED") score += 10;

  return score + Math.min(ageDays, 30);
}

export function shouldIncludeInDefaultAnalyzerReviewQueue(
  input: PlantAnalysisQueueInput,
) {
  return (
    isPlantAnalysisReviewUnresolved(input.reviewStatus) &&
    getPlantAnalysisReviewPriority(input) > 0
  );
}

export function buildPlantAnalysisImageRetentionDate(
  createdAt: Date,
  retentionDays: number | null | undefined,
) {
  if (!retentionDays || !Number.isFinite(retentionDays) || retentionDays <= 0) {
    return null;
  }
  return new Date(createdAt.getTime() + Math.floor(retentionDays) * MS_PER_DAY);
}
