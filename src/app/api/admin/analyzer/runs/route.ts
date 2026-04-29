import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import {
  getPlantAnalysisReviewPriority,
  normalizePlantAnalysisReviewStatus,
} from "@/lib/adminPlantAnalysis";
import { fetchGrowvaultAnalyzerAdminJson } from "@/lib/growvaultAnalyzerAdminBridge";
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

  const bridge = await fetchGrowvaultAnalyzerAdminJson<{
    source: string;
    storefront: string;
    items?: Array<{
      id: string;
      userEmail: string | null;
      provider: string;
      model: string;
      confidence: number;
      confidenceBand: "low" | "medium" | "high";
      healthStatus: string;
      species: string;
      reviewStatus: string;
      safetyFlags: string[];
      createdAt: string;
      priority: number;
      imageUri: string;
      needsHumanReview: boolean;
      issueLabels: string[];
      feedbackCount: number;
      incorrectFeedbackCount: number;
      publicationStatus: string | null;
      publicationEligible: boolean;
      lastFeedback: {
        id: string;
        createdAt: string;
        isCorrect: boolean;
        label: string | null;
        comment: string | null;
        source: string;
      } | null;
    }>;
    summary?: {
      total: number;
      unresolved: number;
      disputed: number;
      lowConfidence: number;
      critical: number;
      submitted: number;
    };
    error?: string;
  }>("/api/internal/admin/analyzer/runs", searchParams.toString());

  if (bridge?.ok) {
    const items = bridge.payload.items ?? [];
    return NextResponse.json({
      source: bridge.payload.source ?? "growvault",
      storefront: bridge.payload.storefront ?? "GROW",
      summary:
        bridge.payload.summary ?? {
          total: items.length,
          unresolved: items.filter((item) => item.reviewStatus !== "REVIEWED_OK").length,
          disputed: items.filter((item) => item.incorrectFeedbackCount > 0).length,
          lowConfidence: items.filter((item) => item.confidence < 0.65).length,
          critical: items.filter((item) => item.healthStatus === "CRITICAL").length,
          submitted: items.filter((item) => item.publicationStatus === "SUBMITTED").length,
        },
      runs: items.map((item) => ({
        id: item.id,
        userId: null,
        userEmail: item.userEmail,
        provider: item.provider,
        model: item.model,
        latencyMs: null,
        confidence: item.confidence,
        confidenceBand: item.confidenceBand,
        needsHumanReview: item.needsHumanReview,
        healthStatus: item.healthStatus,
        species: item.species,
        reviewStatus: item.reviewStatus,
        reviewNotes: null,
        safetyFlags: item.safetyFlags,
        imageUri: item.imageUri,
        imageHash: null,
        imageMime: null,
        imageRetentionUntil: null,
        imageDeletedAt: null,
        createdAt: item.createdAt,
        priority: item.priority,
        publicationStatus: item.publicationStatus,
        publicationEligible: item.publicationEligible,
        feedbackCount: item.feedbackCount,
        incorrectFeedbackCount: item.incorrectFeedbackCount,
        lastFeedback: item.lastFeedback,
        issues: item.issueLabels.map((label, index) => ({
          id: `${item.id}:issue:${index}`,
          label,
          confidence: 0,
          severity: item.healthStatus,
          position: index,
        })),
      })),
    });
  }

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
    source: "smokeify",
    storefront: "ALL",
    summary: {
      total: runs.length,
      unresolved: runs.filter((run) => run.reviewStatus !== "REVIEWED_OK").length,
      disputed: runs.filter((run) => run.feedback.some((entry) => !entry.isCorrect)).length,
      lowConfidence: runs.filter((run) => run.confidence < 0.65).length,
      critical: runs.filter((run) => run.healthStatus === "CRITICAL").length,
      submitted: 0,
    },
    runs: runs
      .map((run) => ({
        id: run.id,
        userId: run.userId,
        userEmail: run.user?.email ?? null,
        provider: run.provider,
        model: run.model,
        latencyMs: run.latencyMs,
        confidence: run.confidence,
        confidenceBand:
          run.confidence < 0.45 ? "low" : run.confidence < 0.75 ? "medium" : "high",
        needsHumanReview:
          run.confidence < 0.65 ||
          run.safetyFlags.length > 0 ||
          run.feedback.some((entry) => !entry.isCorrect),
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
        publicationStatus: null,
        publicationEligible: run.safetyFlags.length === 0,
        feedbackCount: run.feedback.length,
        incorrectFeedbackCount: run.feedback.filter((entry) => !entry.isCorrect).length,
        lastFeedback: run.feedback[0]
          ? {
              id: run.feedback[0].id,
              createdAt: run.feedback[0].createdAt.toISOString(),
              isCorrect: run.feedback[0].isCorrect,
              label: run.feedback[0].correctLabel ?? run.feedback[0].source,
              comment: run.feedback[0].comment,
              source: run.feedback[0].source,
            }
          : null,
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

