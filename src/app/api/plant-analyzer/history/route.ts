import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPlantAnalyzerDecisionSupport,
  getPlantAnalyzerReviewedCase,
  getPlantAnalyzerStoredContext,
  getPlantAnalyzerStoredOutput,
  getPlantAnalyzerStoredTrendSummary,
} from "@/lib/plantAnalyzerOutput";
import { mapStoredFollowUpStatus } from "@/lib/plantAnalyzerDecisionSupport";
import { prisma } from "@/lib/prisma";

const toHealthStatus = (value: string): "healthy" | "warning" | "critical" => {
  if (value === "HEALTHY") return "healthy";
  if (value === "CRITICAL") return "critical";
  return "warning";
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(30, Math.floor(requestedLimit)))
    : 12;

  const rows = await prisma.plantAnalysisRun.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      issues: {
        orderBy: { position: "asc" },
      },
    },
  });

  return NextResponse.json({
    analyses: rows.map((row) => {
      const output = getPlantAnalyzerStoredOutput(row.outputJson);
      const decisionSupport = getPlantAnalyzerDecisionSupport(row.outputJson);
      const analysisContext = getPlantAnalyzerStoredContext(row.outputJson);
      const followUpStatus = mapStoredFollowUpStatus(output.followUpStatus);
      const reviewedCase = getPlantAnalyzerReviewedCase(row.outputJson);
      const diagnosisOverride = reviewedCase?.override?.diagnosis;
      return {
        id: row.id,
        imageUri: row.imageUri ?? "",
        species: diagnosisOverride?.species ?? row.species,
        confidence: diagnosisOverride?.confidence ?? row.confidence,
        confidenceBand: decisionSupport?.confidenceBand ?? "medium",
        healthStatus:
          diagnosisOverride?.healthStatus ?? toHealthStatus(row.healthStatus),
        issues: row.issues.map((issue) => ({
          id: issue.sourceIssueId ?? issue.id,
          label: issue.label,
          confidence: issue.confidence,
          severity: toHealthStatus(issue.severity),
        })),
        recommendations:
          diagnosisOverride?.recommendations ??
          (Array.isArray(output.recommendations) ? output.recommendations : []),
        summary: decisionSupport?.summary ?? "Gespeicherte Analyse",
        observedSymptoms: decisionSupport?.observedSymptoms ?? [],
        needsHumanReview: decisionSupport?.needsHumanReview ?? false,
        analysisContext: analysisContext ?? null,
        followUp: {
          recommendedRecheckWindowHoursMin:
            output.recommendedRecheckWindowHoursMin ?? null,
          recommendedRecheckWindowHoursMax:
            output.recommendedRecheckWindowHoursMax ?? null,
          followUpStatus: followUpStatus ?? null,
          followUpRecordedAt: output.followUpRecordedAt ?? null,
          previousAnalysisId: output.previousAnalysisId ?? null,
          trendSummary: getPlantAnalyzerStoredTrendSummary(row.outputJson),
        },
        analyzedAt: row.createdAt.toISOString(),
        modelVersion: row.model,
        reviewedCase,
      };
    }),
  });
}
