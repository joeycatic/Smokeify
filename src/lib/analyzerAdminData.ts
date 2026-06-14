import "server-only";

import {
  getPlantAnalysisReviewPriority,
  normalizePlantAnalysisReviewStatus,
} from "@/lib/adminPlantAnalysis";
import {
  canPublishAnalyzerRunFromReviewState,
  getStoredPublicationRequestStatus,
  type AnalyzerAdminRun,
} from "@/lib/analyzerAdminQueue";
import { prisma } from "@/lib/prisma";

export type AnalyzerQueueFilters = {
  assignedReviewerId: string | null;
  assignedOnly: boolean;
  overdueOnly: boolean;
  publicationEligibleOnly: boolean;
  disputedOnly: boolean;
  lowConfidenceOnly: boolean;
};

export const emptyAnalyzerQueueFilters: AnalyzerQueueFilters = {
  assignedReviewerId: null,
  assignedOnly: false,
  overdueOnly: false,
  publicationEligibleOnly: false,
  disputedOnly: false,
  lowConfidenceOnly: false,
};

export const getAnalyzerQueueFilters = (searchParams: URLSearchParams): AnalyzerQueueFilters => ({
  assignedReviewerId: searchParams.get("assignedReviewerId")?.trim() || null,
  assignedOnly: searchParams.get("assignedOnly") === "true",
  overdueOnly: searchParams.get("overdueOnly") === "true",
  publicationEligibleOnly: searchParams.get("publicationEligibleOnly") === "true",
  disputedOnly: searchParams.get("disputedOnly") === "true",
  lowConfidenceOnly: searchParams.get("lowConfidenceOnly") === "true",
});

const buildCandidateTake = (limit: number) => Math.min(Math.max(limit * 4, limit), 250);

async function hasAnalyzerAssignmentColumns() {
  try {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'PlantAnalysisRun'
        AND column_name IN ('assignedReviewerId', 'assignedAt', 'reviewDueAt')
    `;
    return columns.length === 3;
  } catch {
    return false;
  }
}

export async function loadPlantAnalysisAdminRuns({
  limit,
  reviewStatus,
  includeResolved,
  filters = emptyAnalyzerQueueFilters,
  publicationSubmittedOnly = false,
}: {
  limit: number;
  reviewStatus: string | null;
  includeResolved: boolean;
  filters?: AnalyzerQueueFilters;
  publicationSubmittedOnly?: boolean;
}): Promise<AnalyzerAdminRun[]> {
  const normalizedReviewStatus = reviewStatus
    ? normalizePlantAnalysisReviewStatus(reviewStatus)
    : null;
  const candidateTake = buildCandidateTake(limit);
  const hasAssignmentColumns = await hasAnalyzerAssignmentColumns();

  const runs = await prisma.plantAnalysisRun.findMany({
    where: {
      ...(normalizedReviewStatus
        ? { reviewStatus: normalizedReviewStatus }
        : includeResolved
          ? {}
          : { reviewStatus: { not: "REVIEWED_OK" } }),
      ...(hasAssignmentColumns && filters.assignedReviewerId
        ? { assignedReviewerId: filters.assignedReviewerId }
        : hasAssignmentColumns && filters.assignedOnly
          ? { assignedReviewerId: { not: null } }
          : {}),
      ...(hasAssignmentColumns && filters.overdueOnly
        ? {
            reviewDueAt: { lt: new Date() },
            reviewStatus: { not: "REVIEWED_OK" },
          }
        : {}),
      ...(filters.lowConfidenceOnly ? { confidence: { lt: 0.65 } } : {}),
      ...(filters.disputedOnly ? { feedback: { some: { isCorrect: false } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: candidateTake,
    select: {
      id: true,
      userId: true,
      provider: true,
      model: true,
      latencyMs: true,
      confidence: true,
      healthStatus: true,
      species: true,
      reviewStatus: true,
      reviewNotes: true,
      safetyFlags: true,
      imageUri: true,
      imageDeletedAt: true,
      outputJson: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
      issues: { orderBy: { position: "asc" } },
      feedback: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { feedback: true } },
      ...(hasAssignmentColumns
        ? {
            assignedReviewerId: true,
            assignedAt: true,
            reviewDueAt: true,
            assignedReviewer: { select: { id: true, email: true, name: true } },
          }
        : {}),
    },
  });

  const incorrectFeedbackCounts = new Map(
    runs.length === 0
      ? []
      : (
          await prisma.plantAnalysisFeedback.groupBy({
            by: ["analysisId"],
            where: {
              analysisId: { in: runs.map((run) => run.id) },
              isCorrect: false,
            },
            _count: { _all: true },
          })
        ).map((entry) => [entry.analysisId, entry._count._all]),
  );

  return runs
    .map((run) => {
      const assignment = run as typeof run & {
        assignedReviewerId?: string | null;
        assignedReviewer?: { id: string; email: string | null; name: string | null } | null;
        assignedAt?: Date | null;
        reviewDueAt?: Date | null;
      };
      const incorrectFeedbackCount = incorrectFeedbackCounts.get(run.id) ?? 0;
      const publicationStatus = getStoredPublicationRequestStatus(run.outputJson);
      return {
        id: run.id,
        userId: run.userId,
        userEmail: run.user?.email ?? null,
        provider: run.provider,
        model: run.model,
        latencyMs: run.latencyMs,
        confidence: run.confidence,
        confidenceBand:
          run.confidence < 0.45 ? "low" : run.confidence < 0.75 ? "medium" : "high",
        needsHumanReview:
          run.confidence < 0.65 ||
          run.safetyFlags.length > 0 ||
          incorrectFeedbackCount > 0,
        healthStatus: run.healthStatus,
        species: run.species,
        reviewStatus: run.reviewStatus,
        reviewNotes: run.reviewNotes,
        assignedReviewerId: assignment.assignedReviewerId ?? null,
        assignedReviewerEmail: assignment.assignedReviewer?.email ?? null,
        assignedAt: assignment.assignedAt?.toISOString() ?? null,
        reviewDueAt: assignment.reviewDueAt?.toISOString() ?? null,
        overdue:
          Boolean(assignment.reviewDueAt) &&
          assignment.reviewDueAt!.getTime() < Date.now() &&
          run.reviewStatus !== "REVIEWED_OK",
        safetyFlags: run.safetyFlags,
        imageUri: run.imageDeletedAt ? null : run.imageUri,
        createdAt: run.createdAt.toISOString(),
        priority: getPlantAnalysisReviewPriority({
          confidence: run.confidence,
          healthStatus: run.healthStatus,
          reviewStatus: run.reviewStatus,
          safetyFlags: run.safetyFlags,
          createdAt: run.createdAt,
          feedback: incorrectFeedbackCount > 0 ? [{ isCorrect: false }] : [],
        }),
        issues: run.issues.map((issue) => ({
          id: issue.id,
          label: issue.label,
          confidence: issue.confidence,
          severity: issue.severity,
          position: issue.position,
        })),
        publicationStatus,
        publicationEligible: canPublishAnalyzerRunFromReviewState({
          reviewStatus: run.reviewStatus,
          safetyFlags: run.safetyFlags,
        }),
        feedbackCount: run._count.feedback,
        incorrectFeedbackCount,
        lastFeedback: run.feedback[0]
          ? {
              id: run.feedback[0].id,
              createdAt: run.feedback[0].createdAt.toISOString(),
              isCorrect: run.feedback[0].isCorrect,
              label: run.feedback[0].correctLabel ?? run.feedback[0].source,
              comment: run.feedback[0].comment,
              source: run.feedback[0].source,
            }
          : null,
      } satisfies AnalyzerAdminRun;
    })
    .filter((run) => !filters.publicationEligibleOnly || run.publicationEligible)
    .filter((run) => !publicationSubmittedOnly || run.publicationStatus === "SUBMITTED");
}
