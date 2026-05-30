import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPlantAnalyzerCachedRemediationPlan,
  getPlantAnalyzerCachedSuggestions,
  getPlantAnalyzerDecisionSupport,
  getPlantAnalyzerReviewedCase,
  getPlantAnalyzerStoredFeedback,
  getPlantAnalyzerStoredOutput,
} from "@/lib/plantAnalyzerOutput";

export const dynamic = "force-dynamic";

const toHealthStatus = (value: "HEALTHY" | "WARNING" | "CRITICAL") => {
  if (value === "HEALTHY") return "healthy";
  if (value === "CRITICAL") return "critical";
  return "warning";
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? 12);
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(30, Math.floor(limitParam)))
    : 12;

  const runs = await prisma.plantAnalysisRun.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      issues: {
        orderBy: { position: "asc" },
      },
    },
  });

  const items = runs.map((run) => {
    const output = getPlantAnalyzerStoredOutput(run.outputJson);
    const support = getPlantAnalyzerDecisionSupport(run.outputJson);
    const suggestions = getPlantAnalyzerCachedSuggestions(run.outputJson);
    const remediationPlan = getPlantAnalyzerCachedRemediationPlan(run.outputJson);
    return {
      id: run.id,
      imageUri: run.imageDeletedAt ? "" : run.imageUri,
      species: run.species,
      confidence: run.confidence,
      confidenceBand: output.confidenceBand ?? "medium",
      healthStatus: toHealthStatus(run.healthStatus),
      recommendations: output.recommendations ?? [],
      summary: support?.summary ?? `${run.species}: ${run.issues[0]?.label ?? "Analyse gespeichert"}`,
      observedSymptoms: support?.observedSymptoms ?? [],
      needsHumanReview: output.needsHumanReview ?? false,
      analysisContext: output.analysisContext ?? null,
      followUp: {
        recommendedRecheckWindowHoursMin:
          output.recommendedRecheckWindowHoursMin ?? null,
        recommendedRecheckWindowHoursMax:
          output.recommendedRecheckWindowHoursMax ?? null,
        followUpStatus: output.followUpStatus ?? null,
        followUpRecordedAt: output.followUpRecordedAt ?? null,
        previousAnalysisId: output.previousAnalysisId ?? null,
        trendSummary: output.trendSummary ?? null,
      },
      analyzedAt: run.createdAt.toISOString(),
      modelVersion: run.model,
      reviewedCase: getPlantAnalyzerReviewedCase(run.outputJson),
      publication: null,
      issues: run.issues.map((issue) => ({
        id: issue.sourceIssueId ?? issue.id,
        label: issue.label,
        confidence: issue.confidence,
        severity: toHealthStatus(issue.severity),
      })),
      productSuggestions: suggestions?.productSuggestions ?? [],
      guideSuggestions: suggestions?.guideSuggestions ?? [],
      remediationPlan,
      lastFeedback: getPlantAnalyzerStoredFeedback(run.outputJson),
    };
  });

  return NextResponse.json({ analyses: items, items });
}
