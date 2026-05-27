import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  PLANT_ANALYSIS_SAFETY_FLAGS,
  PLANT_ANALYSIS_REVIEW_STATUSES,
  getPlantAnalysisReviewPriority,
  normalizePlantAnalysisReviewStatus,
  type PlantAnalysisSafetyFlag,
} from "@/lib/adminPlantAnalysis";
import {
  canPublishAnalyzerRunFromReviewState,
  getStoredPublicationRequestStatus,
  mergeAnalyzerAdminFeeds,
  type AnalyzerAdminRun as AnalyzerRun,
} from "@/lib/analyzerAdminQueue";
import {
  fetchGrowvaultAnalyzerAdminJson,
  getGrowvaultAnalyzerAdminBridgeTarget,
  hasGrowvaultAnalyzerAdminBridge,
} from "@/lib/growvaultAnalyzerAdminBridge";
import { prisma } from "@/lib/prisma";
import { parseAdminStorefrontScope, type AdminStorefrontScope } from "@/lib/storefronts";

type AnalyzerSummary = {
  total: number;
  unresolved: number;
  disputed: number;
  lowConfidence: number;
  critical: number;
  submitted: number;
  unassigned: number;
  dueToday: number;
  overdue: number;
  publicationEligible: number;
};

type AnalyzerQueueResponse = {
  source: string;
  storefront: AdminStorefrontScope;
  summary: AnalyzerSummary;
  runs: AnalyzerRun[];
  growvaultBridge: {
    ok: boolean;
    targetUrl: string | null;
    status: number | null;
    error: string | null;
  };
};

type QueueFilters = {
  assignedReviewerId: string | null;
  assignedOnly: boolean;
  overdueOnly: boolean;
  publicationEligibleOnly: boolean;
  disputedOnly: boolean;
  lowConfidenceOnly: boolean;
};

const reviewStatusSet = new Set<string>(PLANT_ANALYSIS_REVIEW_STATUSES);
const safetyFlagSet = new Set<string>(PLANT_ANALYSIS_SAFETY_FLAGS);

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
  unassigned: runs.filter((run) => !run.assignedReviewerId).length,
  dueToday: runs.filter((run) => {
    if (!run.reviewDueAt || run.reviewStatus === "REVIEWED_OK") return false;
    return new Date(run.reviewDueAt).toDateString() === new Date().toDateString();
  }).length,
  overdue: runs.filter((run) => run.overdue).length,
  publicationEligible: runs.filter((run) => run.publicationEligible).length,
});

const getQueueFilters = (searchParams: URLSearchParams): QueueFilters => ({
  assignedReviewerId: searchParams.get("assignedReviewerId")?.trim() || null,
  assignedOnly: searchParams.get("assignedOnly") === "true",
  overdueOnly: searchParams.get("overdueOnly") === "true",
  publicationEligibleOnly: searchParams.get("publicationEligibleOnly") === "true",
  disputedOnly: searchParams.get("disputedOnly") === "true",
  lowConfidenceOnly: searchParams.get("lowConfidenceOnly") === "true",
});

const parseSafetyFlags = (value: unknown) => {
  if (typeof value === "undefined") return undefined;
  if (!Array.isArray(value)) return null;
  const flags = Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
        .filter(Boolean),
    ),
  );
  return flags.every((flag) => safetyFlagSet.has(flag))
    ? (flags as PlantAnalysisSafetyFlag[])
    : null;
};

const parseOptionalDate = (value: unknown) => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sortAnalyzerRunsByDate = (left: AnalyzerRun, right: AnalyzerRun) =>
  right.createdAt.localeCompare(left.createdAt) ||
  right.priority - left.priority ||
  right.confidence - left.confidence;

const finalizeAnalyzerQueue = (
  runs: AnalyzerRun[],
  limit: number,
  source: string,
  storefront: AdminStorefrontScope,
  growvaultBridge: AnalyzerQueueResponse["growvaultBridge"],
): AnalyzerQueueResponse => {
  const visibleRuns = [...runs].sort(sortAnalyzerRunsByDate).slice(0, limit);
  return {
    source,
    storefront,
    summary: buildAnalyzerSummary(visibleRuns),
    runs: visibleRuns,
    growvaultBridge,
  };
};

async function loadLocalAnalyzerRuns({
  limit,
  reviewStatus,
  includeResolved,
  filters,
}: {
  limit: number;
  reviewStatus: string | null;
  includeResolved: boolean;
  filters: QueueFilters;
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
      ...(filters.assignedReviewerId
        ? { assignedReviewerId: filters.assignedReviewerId }
        : filters.assignedOnly
          ? { assignedReviewerId: { not: null } }
          : {}),
      ...(filters.overdueOnly
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
    include: {
      user: { select: { id: true, email: true, name: true } },
      assignedReviewer: { select: { id: true, email: true, name: true } },
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
        position: issue.position,
      })),
      publicationStatus: getStoredPublicationRequestStatus(run.outputJson),
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
    } satisfies AnalyzerRun;
  }).filter((run) => !filters.publicationEligibleOnly || run.publicationEligible);
}

async function loadGrowvaultAnalyzerRuns(
  searchParams: URLSearchParams,
): Promise<{
  runs: AnalyzerRun[];
  source: string;
  bridge: AnalyzerQueueResponse["growvaultBridge"];
} | null> {
  const bridgeTarget = getGrowvaultAnalyzerAdminBridgeTarget();
  if (!hasGrowvaultAnalyzerAdminBridge()) {
    return {
      runs: [],
      source: "growvault",
      bridge: {
        ok: false,
        targetUrl: bridgeTarget,
        status: null,
        error: "Growvault bridge is not configured.",
      },
    };
  }

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
      assignedReviewerId?: string | null;
      assignedReviewerEmail?: string | null;
      assignedAt?: string | null;
      reviewDueAt?: string | null;
      overdue?: boolean;
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
    return {
      runs: [],
      source: "growvault",
      bridge: {
        ok: false,
        targetUrl: bridgeTarget,
        status: bridge?.status ?? null,
        error:
          bridge?.payload.error ??
          "Growvault analyzer runs could not be loaded through the shared bridge.",
      },
    };
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
      assignedReviewerId: item.assignedReviewerId ?? null,
      assignedReviewerEmail: item.assignedReviewerEmail ?? null,
      assignedAt: item.assignedAt ?? null,
      reviewDueAt: item.reviewDueAt ?? null,
      overdue: Boolean(item.overdue),
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
    bridge: {
      ok: true,
      targetUrl: bridgeTarget,
      status: bridge.status,
      error: null,
    },
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
  const filters = getQueueFilters(searchParams);

  const localRunsPromise =
    storefront === "GROW"
      ? Promise.resolve<AnalyzerRun[]>([])
      : loadLocalAnalyzerRuns({
          limit,
          reviewStatus,
          includeResolved,
          filters,
        });
  const growvaultRunsPromise =
    storefront === "MAIN"
      ? Promise.resolve<{
          runs: AnalyzerRun[];
          source: string;
          bridge: AnalyzerQueueResponse["growvaultBridge"];
        } | null>(null)
      : loadGrowvaultAnalyzerRuns(searchParams);

  const [localRuns, growvaultRuns] = await Promise.all([
    localRunsPromise,
    growvaultRunsPromise,
  ]);
  const growvaultBridge =
    growvaultRuns?.bridge ??
    ({
      ok: true,
      targetUrl: getGrowvaultAnalyzerAdminBridgeTarget(),
      status: null,
      error: null,
    } satisfies AnalyzerQueueResponse["growvaultBridge"]);

  if (storefront === "GROW") {
    if (!growvaultBridge.ok) {
      return NextResponse.json(
        {
          error: growvaultBridge.error ?? "Growvault analyzer runs are currently unavailable.",
          growvaultBridge,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      finalizeAnalyzerQueue(
        growvaultRuns?.runs ?? [],
        limit,
        growvaultRuns?.source ?? "growvault",
        storefront,
        growvaultBridge,
      ),
    );
  }

  if (storefront === "MAIN") {
    return NextResponse.json(
      finalizeAnalyzerQueue(localRuns, limit, "smokeify", storefront, growvaultBridge),
    );
  }

  const combinedRuns = growvaultBridge.ok
    ? mergeAnalyzerAdminFeeds(localRuns, growvaultRuns?.runs ?? [])
    : localRuns;
  const source = growvaultBridge.ok ? "smokeify + growvault" : "smokeify";

  return NextResponse.json(
    finalizeAnalyzerQueue(combinedRuns, limit, source, storefront, growvaultBridge),
  );
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown;
    reviewStatus?: unknown;
    safetyFlags?: unknown;
    assignedReviewerId?: unknown;
    reviewDueAt?: unknown;
    reviewNotes?: unknown;
  };
  const ids = Array.isArray(body.ids)
    ? Array.from(
        new Set(
          body.ids
            .map((id) => (typeof id === "string" ? id.trim() : ""))
            .filter(Boolean),
        ),
      ).slice(0, 100)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one analyzer run." }, { status: 400 });
  }

  const nextStatus =
    typeof body.reviewStatus === "string" && body.reviewStatus.trim()
      ? normalizePlantAnalysisReviewStatus(body.reviewStatus)
      : undefined;
  if (
    typeof body.reviewStatus === "string" &&
    body.reviewStatus.trim() &&
    !reviewStatusSet.has(body.reviewStatus.trim().toUpperCase())
  ) {
    return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  }

  const safetyFlags = parseSafetyFlags(body.safetyFlags);
  if (safetyFlags === null) {
    return NextResponse.json({ error: "Invalid safety flags." }, { status: 400 });
  }

  const reviewDueAt = parseOptionalDate(body.reviewDueAt);
  if (typeof body.reviewDueAt !== "undefined" && reviewDueAt === null && body.reviewDueAt !== null) {
    return NextResponse.json({ error: "Invalid review due date." }, { status: 400 });
  }

  const assignedReviewerId =
    typeof body.assignedReviewerId === "string"
      ? body.assignedReviewerId.trim() || null
      : body.assignedReviewerId === null
        ? null
        : undefined;
  const reviewNotes =
    typeof body.reviewNotes === "string" ? body.reviewNotes.trim() || null : null;

  const localRuns = await prisma.plantAnalysisRun.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      reviewStatus: true,
      safetyFlags: true,
    },
  });
  const localIds = new Set(localRuns.map((run) => run.id));

  if (localRuns.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const run of localRuns) {
        const nextSafetyFlags = safetyFlags ?? run.safetyFlags;
        const toStatus = nextStatus ?? run.reviewStatus;
        await tx.plantAnalysisRun.update({
          where: { id: run.id },
          data: {
            ...(nextStatus ? { reviewStatus: nextStatus } : {}),
            ...(safetyFlags ? { safetyFlags } : {}),
            ...(typeof assignedReviewerId !== "undefined"
              ? {
                  assignedReviewer: assignedReviewerId
                    ? { connect: { id: assignedReviewerId } }
                    : { disconnect: true },
                  assignedAt: assignedReviewerId ? new Date() : null,
                }
              : {}),
            ...(typeof reviewDueAt !== "undefined" ? { reviewDueAt } : {}),
            ...(nextStatus
              ? {
                  reviewedBy: { connect: { id: session.user.id } },
                  reviewedAt: new Date(),
                  reviewNotes,
                }
              : {}),
          },
        });
        await tx.plantAnalysisReviewEvent.create({
          data: {
            analysisId: run.id,
            actorId: session.user.id,
            actorEmail: session.user.email ?? null,
            fromStatus: run.reviewStatus,
            toStatus,
            safetyFlags: nextSafetyFlags,
            notes: reviewNotes,
            metadata: {
              source: "admin.analyzer.bulk",
              assignedReviewerId,
              reviewDueAt: reviewDueAt?.toISOString() ?? null,
            },
          },
        });
      }
    });
  }

  const bridgedIds = ids.filter((id) => !localIds.has(id));
  let bridgedUpdated = 0;
  for (const id of bridgedIds) {
    const bridge = await fetchGrowvaultAnalyzerAdminJson<{ run?: unknown; error?: string }>(
      `/api/internal/admin/analyzer/runs/${id}`,
      "",
      {
        method: "PATCH",
        actor: { id: session.user.id, email: session.user.email ?? null },
        body: JSON.stringify({
          ...(nextStatus ? { reviewStatus: nextStatus } : {}),
          ...(safetyFlags ? { safetyFlags } : {}),
          ...(typeof assignedReviewerId !== "undefined" ? { assignedReviewerId } : {}),
          ...(typeof reviewDueAt !== "undefined"
            ? { reviewDueAt: reviewDueAt?.toISOString() ?? null }
            : {}),
          reviewNotes,
        }),
      },
    );
    if (bridge?.ok) bridgedUpdated += 1;
  }

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "plant_analysis.review.bulk_update",
    targetType: "plant_analysis_run",
    targetId: ids.join(","),
    summary: `Bulk updated ${localRuns.length + bridgedUpdated} analyzer run(s)`,
    metadata: {
      ids,
      localUpdated: localRuns.length,
      bridgedUpdated,
      reviewStatus: nextStatus ?? null,
      assignedReviewerId: assignedReviewerId ?? null,
      reviewDueAt: reviewDueAt?.toISOString() ?? null,
    },
  });

  return NextResponse.json({
    updated: localRuns.length + bridgedUpdated,
    localUpdated: localRuns.length,
    bridgedUpdated,
  });
}
