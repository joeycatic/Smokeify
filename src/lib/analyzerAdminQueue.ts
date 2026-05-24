export type AnalyzerAdminRun = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  provider: string;
  model: string;
  latencyMs?: number | null;
  confidence: number;
  confidenceBand?: "low" | "medium" | "high";
  needsHumanReview?: boolean;
  healthStatus: string;
  species: string;
  reviewStatus: string;
  reviewNotes: string | null;
  safetyFlags: string[];
  imageUri: string | null;
  createdAt: string;
  priority: number;
  publicationStatus?: string | null;
  publicationEligible?: boolean;
  feedbackCount?: number;
  incorrectFeedbackCount?: number;
  lastFeedback?: {
    id: string;
    createdAt: string;
    isCorrect: boolean;
    label: string | null;
    comment: string | null;
    source: string;
  } | null;
  issues: Array<{
    id: string;
    label: string;
    confidence: number;
    severity: string;
    position?: number;
  }>;
};

const PUBLICATION_RESTRICTED_REVIEW_STATUSES = new Set([
  "UNREVIEWED",
  "REVIEWED_UNSAFE",
  "NEEDS_PROMPT_FIX",
  "NEEDS_RECOMMENDATION_FIX",
  "PRIVACY_REVIEW",
]);

const PUBLICATION_BLOCKING_FLAGS = new Set([
  "PRIVACY_SENSITIVE_IMAGE",
  "UNSAFE_ACTION",
  "MEDICAL_OR_LEGAL_CLAIM",
]);

const PUBLICATION_STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "REJECTED",
  "PUBLISHED",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function getStoredPublicationRequestStatus(outputJson: unknown) {
  if (!isRecord(outputJson)) return null;
  const request = outputJson.publicationRequest;
  if (!isRecord(request)) return null;
  const status = request.status;
  return typeof status === "string" && PUBLICATION_STATUSES.has(status)
    ? status
    : null;
}

export function canPublishAnalyzerRunFromReviewState(input: {
  reviewStatus: string;
  safetyFlags: string[];
}) {
  if (PUBLICATION_RESTRICTED_REVIEW_STATUSES.has(input.reviewStatus)) {
    return false;
  }

  return input.safetyFlags.every((flag) => !PUBLICATION_BLOCKING_FLAGS.has(flag));
}

export function mergeAnalyzerAdminFeeds(
  localRuns: AnalyzerAdminRun[],
  bridgedRuns: AnalyzerAdminRun[],
) {
  if (bridgedRuns.length === 0) return localRuns;
  const bridgedIds = new Set(bridgedRuns.map((run) => run.id));
  return [...localRuns.filter((run) => !bridgedIds.has(run.id)), ...bridgedRuns];
}
