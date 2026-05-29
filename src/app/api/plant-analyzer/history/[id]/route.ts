import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPlantAnalyzerCachedRemediationPlan,
  getPlantAnalyzerCachedSuggestions,
  getPlantAnalyzerDecisionSupport,
  getPlantAnalyzerStoredContext,
  getPlantAnalyzerStoredTrendSummary,
} from "@/lib/plantAnalyzerOutput";

export const dynamic = "force-dynamic";

const toHealthStatus = (value: "HEALTHY" | "WARNING" | "CRITICAL") => {
  if (value === "HEALTHY") return "healthy";
  if (value === "CRITICAL") return "critical";
  return "warning";
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const run = await prisma.plantAnalysisRun.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      issues: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const support = getPlantAnalyzerDecisionSupport(run.outputJson);
  const suggestions = getPlantAnalyzerCachedSuggestions(run.outputJson);
  const remediationPlan = getPlantAnalyzerCachedRemediationPlan(run.outputJson);

  return NextResponse.json({
    item: {
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      species: run.species,
      confidence: run.confidence,
      healthStatus: toHealthStatus(run.healthStatus),
      notes: run.notes,
      imageUri: run.imageDeletedAt ? null : run.imageUri,
      issues: run.issues.map((issue) => ({
        id: issue.sourceIssueId ?? issue.id,
        label: issue.label,
        confidence: issue.confidence,
        severity: toHealthStatus(issue.severity),
      })),
      support,
      analysisContext: getPlantAnalyzerStoredContext(run.outputJson),
      trendSummary: getPlantAnalyzerStoredTrendSummary(run.outputJson),
      productSuggestions: suggestions?.productSuggestions ?? [],
      guideSuggestions: suggestions?.guideSuggestions ?? [],
      remediationPlan,
    },
  });
}
