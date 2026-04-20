import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  getPlantAnalysisReviewPriority,
  normalizePlantAnalysisReviewStatus,
} from "@/lib/adminPlantAnalysis";
import { prisma } from "@/lib/prisma";

const clampLimit = (value: string | null) => {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
};

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampLimit(searchParams.get("limit"));
  const reviewStatus = searchParams.get("reviewStatus");
  const normalizedReviewStatus = reviewStatus
    ? normalizePlantAnalysisReviewStatus(reviewStatus)
    : null;
  const includeResolved = searchParams.get("includeResolved") === "true";

  const runs = await prisma.plantAnalysisRun.findMany({
    where: {
      ...(normalizedReviewStatus
        ? { reviewStatus: normalizedReviewStatus }
        : includeResolved
          ? {}
          : { reviewStatus: { not: "REVIEWED_OK" } }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      issues: { orderBy: { position: "asc" } },
      feedback: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return NextResponse.json({
    runs: runs
      .map((run) => ({
        id: run.id,
        userId: run.userId,
        userEmail: run.user?.email ?? null,
        provider: run.provider,
        model: run.model,
        latencyMs: run.latencyMs,
        confidence: run.confidence,
        healthStatus: run.healthStatus,
        species: run.species,
        reviewStatus: run.reviewStatus,
        reviewNotes: run.reviewNotes,
        safetyFlags: run.safetyFlags,
        imageUri: run.imageDeletedAt ? null : run.imageUri,
        imageHash: run.imageHash,
        imageMime: run.imageMime,
        imageRetentionUntil: run.imageRetentionUntil?.toISOString() ?? null,
        imageDeletedAt: run.imageDeletedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
        priority: getPlantAnalysisReviewPriority({
          confidence: run.confidence,
          healthStatus: run.healthStatus,
          reviewStatus: run.reviewStatus,
          safetyFlags: run.safetyFlags,
          createdAt: run.createdAt,
          feedback: run.feedback.map((entry) => ({ isCorrect: entry.isCorrect })),
        }),
        issues: run.issues.map((issue) => ({
          id: issue.id,
          label: issue.label,
          confidence: issue.confidence,
          severity: issue.severity,
          position: issue.position,
        })),
        feedback: run.feedback.map((entry) => ({
          id: entry.id,
          isCorrect: entry.isCorrect,
          correctLabel: entry.correctLabel,
          comment: entry.comment,
          source: entry.source,
          createdAt: entry.createdAt.toISOString(),
        })),
      }))
      .sort((left, right) => right.priority - left.priority),
  });
}

