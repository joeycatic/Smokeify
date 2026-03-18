import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPlantAnalyzerCachedSuggestions,
  getPlantAnalyzerStoredOutput,
  mergePlantAnalyzerStoredOutput,
} from "@/lib/plantAnalyzerOutput";
import { attachServerTiming, getNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { getPlantAnalyzerSuggestions } from "@/lib/plantAnalyzerRecommendations";

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
  const issues = row.issues.map((issue) => ({
    id: issue.sourceIssueId ?? issue.id,
    label: issue.label,
    confidence: issue.confidence,
    severity: toHealthStatus(issue.severity),
  }));
  const cachedSuggestions = getPlantAnalyzerCachedSuggestions(output);
  const suggestions =
    cachedSuggestions ?? (await getPlantAnalyzerSuggestions(issues));

  if (!cachedSuggestions) {
    void prisma.plantAnalysisRun
      .update({
        where: { id: row.id },
        data: {
          outputJson: mergePlantAnalyzerStoredOutput(output, {
            productSuggestions: suggestions.productSuggestions,
            guideSuggestions: suggestions.guideSuggestions,
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
      diagnosis: {
        healthStatus: toHealthStatus(row.healthStatus),
        species: row.species,
        confidence: row.confidence,
        issues,
        recommendations: Array.isArray(storedOutput.recommendations)
          ? storedOutput.recommendations
          : [],
      },
      productSuggestions: suggestions.productSuggestions,
      guideSuggestions: suggestions.guideSuggestions,
    }),
    [{ name: "analyzer_detail", durationMs: getNow() - startedAt, description: "history-detail" }],
  );
}
