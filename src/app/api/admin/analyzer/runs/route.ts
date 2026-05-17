import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  getPlantAnalysisReviewPriority,
  normalizePlantAnalysisReviewStatus,
} from "@/lib/adminPlantAnalysis";
import { fetchGrowvaultAnalyzerAdminJson } from "@/lib/growvaultAnalyzerAdminBridge";
import { prisma } from "@/lib/prisma";
import { parseAdminStorefrontScope, type AdminStorefrontScope } from "@/lib/storefronts";

type AnalyzerSummary = {
  total: number;
  unresolved: number;
  disputed: number;
  lowConfidence: number;
  critical: number;
  submitted: number;
};

type AnalyzerRun = {
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

type AnalyzerQueueResponse = {
  source: string;
  storefront: AdminStorefrontScope;
  summary: AnalyzerSummary;
  runs: AnalyzerRun[];
};

const clampLimit = (value: string | null) => {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.floor(parsed), 1), 250);
};

const buildCandidateTake = (limit: number) => Math.min(Math.max(limit * 4, limit), 250);

const buildAnalyzerSummary = (runs: AnalyzerRun[]): AnalyzerSummary => ({
  total: runs.length,
  unresolved: runs.filter((run) => run.reviewStatus !== "REVIEWED_OK").length,
  disputed: runs.filter((run) => (run.incorrectFeedbackCount ?? 0) > 0).length,
  lowConfidence: runs.filter((run) => run.confidence < 0.65).length,
  critical: runs.filter((run) => run.healthStatus === "CRITICAL").length,
  submitted: runs.filter((run) => run.publicationStatus === "SUBMITTED").length,
});

const sortAnalyzerRunsByDate = (left: AnalyzerRun, right: AnalyzerRun) =>
  right.createdAt.localeCompare(left.createdAt) ||
  right.priority - left.priority ||
  right.confidence - left.confidence;

const finalizeAnalyzerQueue = (
  runs: AnalyzerRun[],
  limit: number,
  source: string,
  storefront: AdminStorefrontScope,
): AnalyzerQueueResponse => {
  const visibleRuns = [...runs].sort(sortAnalyzerRunsByDate).slice(0, limit);
  return {
    source,
    storefront,
    summary: buildAnalyzerSummary(visibleRuns),
    runs: visibleRuns,
  };
};

async function loadLocalAnalyzerRuns({
  limit,
  reviewStatus,
  includeResolved,
}: {
  limit: number;
  reviewStatus: string | null;
  includeResolved: boolean;
}) {
  const normalizedReviewStatus = reviewStatus
    ? normalizePlantAnalysisReviewStatus(reviewStatus)
    : null;
  const candidateTake = buildCandidateTake(limit);

  const runs = await prisma.plantAnalysisRun.findMany({
    where: {
      ...(normalizedReviewStatus
        ? { reviewStatus: normalizedReviewStatus }
        : includeResolved
          ? {}
          : { reviewStatus: { not: "REVIEWED_OK" } }),
    },
    orderBy: { createdAt: "desc" },
    take: candidateTake,
    include: {
      user: { select: { id: true, email: true, name: true } },
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

  return runs.map((run) => {
    const incorrectFeedbackCount = incorrectFeedbackCounts.get(run.id) ?? 0;
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
      publicationStatus: null,
      publicationEligible: run.safetyFlags.length === 0,
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
    } satisfies AnalyzerRun;
  });
}

async function loadGrowvaultAnalyzerRuns(
  searchParams: URLSearchParams,
): Promise<{ runs: AnalyzerRun[]; source: string } | null> {
  const bridge = await fetchGrowvaultAnalyzerAdminJson<{
    source: string;
    storefront: string;
    items?: Array<{
      id: string;
      userEmail: string | null;
      provider: string;
      model: string;
      confidence: number;
      confidenceBand: "low" | "medium" | "high";
      healthStatus: string;
      species: string;
      reviewStatus: string;
      safetyFlags: string[];
      createdAt: string;
      priority: number;
      imageUri: string;
      needsHumanReview: boolean;
      issueLabels: string[];
      feedbackCount: number;
      incorrectFeedbackCount: number;
      publicationStatus: string | null;
      publicationEligible: boolean;
      lastFeedback: {
        id: string;
        createdAt: string;
        isCorrect: boolean;
        label: string | null;
        comment: string | null;
        source: string;
      } | null;
    }>;
    error?: string;
  }>("/api/internal/admin/analyzer/runs", searchParams.toString());

  if (!bridge?.ok) {
    return null;
  }

  const items = bridge.payload.items ?? [];
  return {
    source: bridge.payload.source ?? "growvault",
    runs: items.map((item) => ({
      id: item.id,
      userId: null,
      userEmail: item.userEmail,
      provider: item.provider,
      model: item.model,
      latencyMs: null,
      confidence: item.confidence,
      confidenceBand: item.confidenceBand,
      needsHumanReview: item.needsHumanReview,
      healthStatus: item.healthStatus,
      species: item.species,
      reviewStatus: item.reviewStatus,
      reviewNotes: null,
      safetyFlags: item.safetyFlags,
      imageUri: item.imageUri,
      createdAt: item.createdAt,
      priority: item.priority,
      publicationStatus: item.publicationStatus,
      publicationEligible: item.publicationEligible,
      feedbackCount: item.feedbackCount,
      incorrectFeedbackCount: item.incorrectFeedbackCount,
      lastFeedback: item.lastFeedback,
      issues: item.issueLabels.map((label, index) => ({
        id: `${item.id}:issue:${index}`,
        label,
        confidence: 0,
        severity: item.healthStatus,
        position: index,
      })),
    })),
  };
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const includeResolved = searchParams.get("includeResolved") === "true";
  const reviewStatus = searchParams.get("reviewStatus");
  const storefront = parseAdminStorefrontScope(searchParams.get("storefront"));

  const localRunsPromise =
    storefront === "GROW"
      ? Promise.resolve<AnalyzerRun[]>([])
      : loadLocalAnalyzerRuns({
          limit,
          reviewStatus,
          includeResolved,
        });
  const growvaultRunsPromise =
    storefront === "MAIN"
      ? Promise.resolve<{ runs: AnalyzerRun[]; source: string } | null>(null)
      : loadGrowvaultAnalyzerRuns(searchParams);

  const [localRuns, growvaultRuns] = await Promise.all([
    localRunsPromise,
    growvaultRunsPromise,
  ]);

  if (storefront === "GROW") {
    if (!growvaultRuns) {
      return NextResponse.json(
        { error: "Growvault analyzer runs are currently unavailable." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      finalizeAnalyzerQueue(growvaultRuns.runs, limit, growvaultRuns.source, storefront),
    );
  }

  if (storefront === "MAIN") {
    return NextResponse.json(finalizeAnalyzerQueue(localRuns, limit, "smokeify", storefront));
  }

  const combinedRuns = growvaultRuns ? [...localRuns, ...growvaultRuns.runs] : localRuns;
  const source = growvaultRuns ? "smokeify + growvault" : "smokeify";

  return NextResponse.json(finalizeAnalyzerQueue(combinedRuns, limit, source, storefront));
}
