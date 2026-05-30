import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPlantAnalyzerCachedRemediationPlan,
  getPlantAnalyzerCachedSuggestions,
  getPlantAnalyzerDecisionSupport,
  getPlantAnalyzerReviewedCase,
  getPlantAnalyzerStoredContext,
  getPlantAnalyzerStoredFeedback,
  getPlantAnalyzerStoredOutput,
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
  const output = getPlantAnalyzerStoredOutput(run.outputJson);
  const detail = {
    id: run.id,
    imageUri: run.imageDeletedAt ? "" : run.imageUri,
    diagnosis: {
      healthStatus: toHealthStatus(run.healthStatus),
      species: run.species,
      confidence: run.confidence,
      issues: run.issues.map((issue) => ({
        id: issue.sourceIssueId ?? issue.id,
        label: issue.label,
        confidence: issue.confidence,
        severity: toHealthStatus(issue.severity),
      })),
      recommendations: output.recommendations ?? [],
    },
    summary: support?.summary ?? run.notes ?? "Analyse gespeichert",
    observedSymptoms: support?.observedSymptoms ?? [],
    possibleCauses: support?.possibleCauses ?? [],
    verificationChecks: support?.verificationChecks ?? [],
    immediateActions: support?.immediateActions ?? [],
    deferActions: support?.deferActions ?? [],
    environmentConsiderations: support?.environmentConsiderations ?? [],
    uncertaintyNote: support?.uncertaintyNote ?? "",
    confidenceBand: output.confidenceBand ?? "medium",
    needsHumanReview: output.needsHumanReview ?? false,
    analysisContext: getPlantAnalyzerStoredContext(run.outputJson),
    consideredInputs: [],
    influenceNotes: [],
    contextUsed: output.contextUsed ?? false,
    promptVersion: output.promptVersion ?? null,
    reasoningVersion: output.reasoningVersion ?? null,
    followUp: {
      recommendedRecheckWindowHoursMin:
        output.recommendedRecheckWindowHoursMin ?? null,
      recommendedRecheckWindowHoursMax:
        output.recommendedRecheckWindowHoursMax ?? null,
      followUpStatus: output.followUpStatus ?? null,
      followUpRecordedAt: output.followUpRecordedAt ?? null,
      previousAnalysisId: output.previousAnalysisId ?? null,
      trendSummary: getPlantAnalyzerStoredTrendSummary(run.outputJson),
    },
    productSuggestions: suggestions?.productSuggestions ?? [],
    guideSuggestions: suggestions?.guideSuggestions ?? [],
    remediation: remediationPlan,
    lastFeedback: getPlantAnalyzerStoredFeedback(run.outputJson),
    reviewedCase: getPlantAnalyzerReviewedCase(run.outputJson),
    publication: null,
  };

  return NextResponse.json({
    ...detail,
    item: detail,
  });
}
