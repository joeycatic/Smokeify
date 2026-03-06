import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
      const output = (row.outputJson ?? {}) as {
        recommendations?: string[];
      };
      return {
        id: row.id,
        species: row.species,
        confidence: row.confidence,
        healthStatus: toHealthStatus(row.healthStatus),
        issues: row.issues.map((issue) => ({
          id: issue.sourceIssueId ?? issue.id,
          label: issue.label,
          confidence: issue.confidence,
          severity: toHealthStatus(issue.severity),
        })),
        recommendations: Array.isArray(output.recommendations)
          ? output.recommendations
          : [],
        analyzedAt: row.createdAt.toISOString(),
        modelVersion: row.model,
      };
    }),
  });
}
