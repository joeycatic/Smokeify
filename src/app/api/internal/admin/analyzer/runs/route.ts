import { NextResponse } from "next/server";
import {
  getAnalyzerQueueFilters,
  loadPlantAnalysisAdminRuns,
} from "@/lib/analyzerAdminData";
import { isAuthorizedInternalAdminBridgeRequest } from "@/lib/internalAdminBridgeAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const clampLimit = (value: string | null) => {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.floor(parsed), 1), 250);
};

function formatBridgeError(error: unknown) {
  if (error instanceof Error) {
    const prismaError = error as Error & {
      code?: string;
      meta?: { column?: string; modelName?: string; table?: string };
    };
    const detail = [
      prismaError.code,
      prismaError.meta?.modelName,
      prismaError.meta?.table,
      prismaError.meta?.column,
    ]
      .filter(Boolean)
      .join(" ");
    return detail
      ? `GrowVault analyzer bridge failed: ${detail}.`
      : `GrowVault analyzer bridge failed: ${error.message}`;
  }
  return "GrowVault analyzer bridge failed.";
}

export async function GET(request: Request) {
  if (!isAuthorizedInternalAdminBridgeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  let runs: Awaited<ReturnType<typeof loadPlantAnalysisAdminRuns>>;
  try {
    runs = await loadPlantAnalysisAdminRuns({
      limit,
      reviewStatus: searchParams.get("reviewStatus"),
      includeResolved: searchParams.get("includeResolved") === "true",
      filters: getAnalyzerQueueFilters(searchParams),
    });
  } catch (error) {
    console.error("GrowVault analyzer bridge list failed", error);
    return NextResponse.json({ error: formatBridgeError(error) }, { status: 500 });
  }

  return NextResponse.json({
    source: "growvault",
    storefront: "GROW",
    generatedAt: new Date().toISOString(),
    items: runs.map((run) => ({
      id: run.id,
      userEmail: run.userEmail,
      provider: run.provider,
      model: run.model,
      confidence: run.confidence,
      confidenceBand: run.confidenceBand ?? "medium",
      healthStatus: run.healthStatus,
      species: run.species,
      reviewStatus: run.reviewStatus,
      assignedReviewerId: run.assignedReviewerId ?? null,
      assignedReviewerEmail: run.assignedReviewerEmail ?? null,
      assignedAt: run.assignedAt ?? null,
      reviewDueAt: run.reviewDueAt ?? null,
      overdue: Boolean(run.overdue),
      safetyFlags: run.safetyFlags,
      createdAt: run.createdAt,
      priority: run.priority,
      imageUri: run.imageUri,
      needsHumanReview: Boolean(run.needsHumanReview),
      issueLabels: run.issues.map((issue) => issue.label),
      feedbackCount: run.feedbackCount ?? 0,
      incorrectFeedbackCount: run.incorrectFeedbackCount ?? 0,
      publicationStatus: run.publicationStatus ?? null,
      publicationEligible: Boolean(run.publicationEligible),
      lastFeedback: run.lastFeedback ?? null,
    })),
  });
}

export async function OPTIONS(request: Request) {
  if (!isAuthorizedInternalAdminBridgeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
