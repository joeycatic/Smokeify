import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  getPlantAnalysisReviewPriority,
} from "@/lib/adminPlantAnalysis";
import {
  canPublishAnalyzerRunFromReviewState,
  getStoredPublicationRequestStatus,
} from "@/lib/analyzerAdminQueue";
import { prisma } from "@/lib/prisma";
import AdminAnalyzerClient, {
  type AdminAnalyzerInitialQueue,
} from "./AdminAnalyzerClient";

async function getInitialSmokeifyAnalyzerQueue(): Promise<AdminAnalyzerInitialQueue> {
  const runs = await prisma.plantAnalysisRun.findMany({
    where: { reviewStatus: { not: "REVIEWED_OK" } },
    orderBy: { createdAt: "desc" },
    take: 250,
    include: {
      user: { select: { email: true } },
      assignedReviewer: { select: { email: true } },
      issues: { orderBy: { position: "asc" } },
      feedback: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { feedback: true } },
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

  const serializedRuns = runs.map((run) => {
    const incorrectFeedbackCount = incorrectFeedbackCounts.get(run.id) ?? 0;
    const publicationStatus = getStoredPublicationRequestStatus(run.outputJson);
    const publicationEligible = canPublishAnalyzerRunFromReviewState({
      reviewStatus: run.reviewStatus,
      safetyFlags: run.safetyFlags,
    });

    return {
      id: run.id,
      userId: run.userId,
      userEmail: run.user?.email ?? null,
      provider: run.provider,
      model: run.model,
      latencyMs: run.latencyMs,
      confidence: run.confidence,
      confidenceBand:
        run.confidence < 0.45 ? "low" as const : run.confidence < 0.75 ? "medium" as const : "high" as const,
      needsHumanReview:
        run.confidence < 0.65 ||
        run.safetyFlags.length > 0 ||
        incorrectFeedbackCount > 0,
      healthStatus: run.healthStatus,
      species: run.species,
      reviewStatus: run.reviewStatus,
      reviewNotes: run.reviewNotes,
      assignedReviewerId: run.assignedReviewerId,
      assignedReviewerEmail: run.assignedReviewer?.email ?? null,
      assignedAt: run.assignedAt?.toISOString() ?? null,
      reviewDueAt: run.reviewDueAt?.toISOString() ?? null,
      overdue:
        Boolean(run.reviewDueAt) &&
        run.reviewDueAt!.getTime() < Date.now() &&
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
      })),
      publicationStatus,
      publicationEligible,
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
    };
  });

  return {
    source: "smokeify",
    runs: serializedRuns,
    summary: {
      total: serializedRuns.length,
      unresolved: serializedRuns.filter((run) => run.reviewStatus !== "REVIEWED_OK").length,
      disputed: serializedRuns.filter((run) => (run.incorrectFeedbackCount ?? 0) > 0).length,
      lowConfidence: serializedRuns.filter((run) => run.confidence < 0.65).length,
      critical: serializedRuns.filter((run) => run.healthStatus === "CRITICAL").length,
      submitted: serializedRuns.filter((run) => run.publicationStatus === "SUBMITTED").length,
      unassigned: serializedRuns.filter((run) => !run.assignedReviewerId).length,
      dueToday: serializedRuns.filter((run) => {
        if (!run.reviewDueAt || run.reviewStatus === "REVIEWED_OK") return false;
        return new Date(run.reviewDueAt).toDateString() === new Date().toDateString();
      }).length,
      overdue: serializedRuns.filter((run) => run.overdue).length,
      publicationEligible: serializedRuns.filter((run) => run.publicationEligible).length,
    },
  };
}

export default async function AdminAnalyzerPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();
  const initialQueue = await getInitialSmokeifyAnalyzerQueue();

  return (
    <div className="w-full text-stone-800">
      <AdminAnalyzerClient initialQueue={initialQueue} />
    </div>
  );
}
