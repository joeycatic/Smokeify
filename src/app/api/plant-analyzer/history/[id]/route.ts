import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { attachServerTiming, getNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import {
  getPlantAnalyzerGuideSuggestions,
  getPlantAnalyzerProductSuggestions,
} from "@/lib/plantAnalyzerRecommendations";

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

  const output = (row.outputJson ?? {}) as {
    recommendations?: string[];
  };
  const issues = row.issues.map((issue) => ({
    id: issue.sourceIssueId ?? issue.id,
    label: issue.label,
    confidence: issue.confidence,
    severity: toHealthStatus(issue.severity),
  }));
  const primaryIssues = issues.slice(0, 2);
  const productSuggestions =
    await getPlantAnalyzerProductSuggestions(primaryIssues);
  const guideSuggestions = getPlantAnalyzerGuideSuggestions(primaryIssues);

  return attachServerTiming(
    NextResponse.json({
      id: row.id,
      imageUri: row.imageUri ?? "",
      diagnosis: {
        healthStatus: toHealthStatus(row.healthStatus),
        species: row.species,
        confidence: row.confidence,
        issues,
        recommendations: Array.isArray(output.recommendations)
          ? output.recommendations
          : [],
      },
      productSuggestions,
      guideSuggestions,
    }),
    [{ name: "analyzer_detail", durationMs: getNow() - startedAt, description: "history-detail" }],
  );
}
