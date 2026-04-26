import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPlantAnalyzerCachedRemediationPlan,
  getPlantAnalyzerCachedSuggestions,
  getPlantAnalyzerDecisionSupport,
  getPlantAnalyzerReviewedCase,
  getPlantAnalyzerStoredContext,
  getPlantAnalyzerStoredFeedback,
  getPlantAnalyzerStoredOutput,
  getPlantAnalyzerStoredTrendSummary,
  mergePlantAnalyzerStoredOutput,
} from "@/lib/plantAnalyzerOutput";
import { attachServerTiming, getNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { getPlantAnalyzerSuggestions } from "@/lib/plantAnalyzerRecommendations";
import { buildPlantAnalyzerRemediationPlan } from "@/lib/plantAnalyzerRemediation";

const toHealthStatus = (value: string): "healthy" | "warning" | "critical" => {
  if (value === "HEALTHY") return "healthy";
  if (value === "CRITICAL") return "critical";
  return "warning";
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const startedAt = getNow();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return attachServerTiming(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      [{ name: "analyzer_detail", durationMs: getNow() - startedAt, description: "history-detail" }],
    );
  }

  const { id } = await context.params;
  const row = await prisma.plantAnalysisRun.findFirst({
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

  if (!row) {
    return attachServerTiming(
      NextResponse.json({ error: "Not found" }, { status: 404 }),
      [{ name: "analyzer_detail", durationMs: getNow() - startedAt, description: "history-detail" }],
    );
  }

  const output = row.outputJson ?? {};
  const storedOutput = getPlantAnalyzerStoredOutput(output);
  const decisionSupport = getPlantAnalyzerDecisionSupport(output);
  const analysisContext = getPlantAnalyzerStoredContext(output);
  const reviewedCase = getPlantAnalyzerReviewedCase(output);
  const diagnosisOverride = reviewedCase?.override?.diagnosis;
  const issues = row.issues.map((issue) => ({
    id: issue.sourceIssueId ?? issue.id,
    label: issue.label,
    confidence: issue.confidence,
    severity: toHealthStatus(issue.severity),
  }));
  const cachedSuggestions = getPlantAnalyzerCachedSuggestions(output);
  const suggestions =
    cachedSuggestions ?? (await getPlantAnalyzerSuggestions(issues));
  const productSuggestions =
    reviewedCase?.override?.productSuggestions ?? suggestions.productSuggestions;
  const diagnosis = {
    healthStatus:
      diagnosisOverride?.healthStatus ?? toHealthStatus(row.healthStatus),
    species: diagnosisOverride?.species ?? row.species,
    confidence: diagnosisOverride?.confidence ?? row.confidence,
    issues,
    recommendations:
      diagnosisOverride?.recommendations ??
      (Array.isArray(storedOutput.recommendations)
        ? storedOutput.recommendations
        : []),
  };
  const remediation =
    getPlantAnalyzerCachedRemediationPlan(output) ??
    buildPlantAnalyzerRemediationPlan({
      diagnosis,
      productSuggestions,
      guideSuggestions: suggestions.guideSuggestions,
    });
  const lastFeedback = getPlantAnalyzerStoredFeedback(output);

  if (!cachedSuggestions || !getPlantAnalyzerCachedRemediationPlan(output)) {
    void prisma.plantAnalysisRun
      .update({
        where: { id: row.id },
        data: {
          outputJson: mergePlantAnalyzerStoredOutput(output, {
            productSuggestions: suggestions.productSuggestions,
            guideSuggestions: suggestions.guideSuggestions,
            remediationPlan: remediation,
          }),
        },
      })
      .catch((persistError) => {
        console.error("Failed to backfill analyzer suggestions", persistError);
      });
  }

  return attachServerTiming(
    NextResponse.json({
      id: row.id,
      imageUri: row.imageUri ?? "",
      diagnosis,
      summary: decisionSupport?.summary ?? "Gespeicherte Analyse",
      observedSymptoms: decisionSupport?.observedSymptoms ?? [],
      possibleCauses: decisionSupport?.possibleCauses ?? [],
      verificationChecks: decisionSupport?.verificationChecks ?? [],
      immediateActions:
        decisionSupport?.immediateActions ??
        diagnosis.recommendations.slice(0, 2),
      deferActions: decisionSupport?.deferActions ?? [],
      environmentConsiderations: decisionSupport?.environmentConsiderations ?? [],
      uncertaintyNote:
        decisionSupport?.uncertaintyNote ??
        remediation.uncertaintyNote,
      confidenceBand: decisionSupport?.confidenceBand ?? "medium",
      needsHumanReview: decisionSupport?.needsHumanReview ?? false,
      analysisContext: analysisContext ?? null,
      contextUsed: Boolean(storedOutput.contextUsed),
      promptVersion: storedOutput.promptVersion ?? null,
      reasoningVersion: storedOutput.reasoningVersion ?? null,
      followUp: {
        recommendedRecheckWindowHoursMin:
          storedOutput.recommendedRecheckWindowHoursMin ??
          remediation.monitoringWindow.hoursMin,
        recommendedRecheckWindowHoursMax:
          storedOutput.recommendedRecheckWindowHoursMax ??
          remediation.monitoringWindow.hoursMax,
        followUpStatus: storedOutput.followUpStatus ?? null,
        followUpRecordedAt: storedOutput.followUpRecordedAt ?? null,
        previousAnalysisId: storedOutput.previousAnalysisId ?? null,
        trendSummary: getPlantAnalyzerStoredTrendSummary(output),
      },
      productSuggestions,
      guideSuggestions: suggestions.guideSuggestions,
      remediation,
      lastFeedback,
      reviewedCase,
    }),
    [{ name: "analyzer_detail", durationMs: getNow() - startedAt, description: "history-detail" }],
  );
}
