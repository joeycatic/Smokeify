import { NextResponse } from "next/server";
import {
  PLANT_ANALYSIS_REVIEW_STATUSES,
  PLANT_ANALYSIS_SAFETY_FLAGS,
  normalizePlantAnalysisReviewStatus,
  type PlantAnalysisSafetyFlag,
} from "@/lib/adminPlantAnalysis";
import {
  getInternalAdminBridgeActor,
  isAuthorizedInternalAdminBridgeRequest,
} from "@/lib/internalAdminBridgeAuth";
import { mergePlantAnalyzerStoredOutput } from "@/lib/plantAnalyzerOutput";
import type { PlantAnalyzerReviewedCase } from "@/lib/plantAnalyzerTypes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const safetyFlagSet = new Set<string>(PLANT_ANALYSIS_SAFETY_FLAGS);
const reviewStatusSet = new Set<string>(PLANT_ANALYSIS_REVIEW_STATUSES);

const parseSafetyFlags = (value: unknown): PlantAnalysisSafetyFlag[] | null => {
  if (!Array.isArray(value)) return null;
  const flags = Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
        .filter(Boolean),
    ),
  );
  if (flags.some((flag) => !safetyFlagSet.has(flag))) return null;
  return flags as PlantAnalysisSafetyFlag[];
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAuthorizedInternalAdminBridgeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const run = await prisma.plantAnalysisRun.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      issues: { orderBy: { position: "asc" } },
      feedback: { orderBy: { createdAt: "desc" } },
      reviewEvents: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  return NextResponse.json({
    run: {
      ...run,
      imageUri: run.imageDeletedAt ? null : run.imageUri,
      createdAt: run.createdAt.toISOString(),
      reviewedAt: run.reviewedAt?.toISOString() ?? null,
      imageRetentionUntil: run.imageRetentionUntil?.toISOString() ?? null,
      imageDeletedAt: run.imageDeletedAt?.toISOString() ?? null,
      issues: run.issues.map((issue) => ({
        ...issue,
        createdAt: issue.createdAt.toISOString(),
      })),
      feedback: run.feedback.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
      reviewEvents: run.reviewEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAuthorizedInternalAdminBridgeRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    reviewStatus?: string;
    safetyFlags?: string[];
    reviewNotes?: string | null;
    overrideDiagnosis?: {
      species?: string;
      confidence?: number;
      healthStatus?: "healthy" | "warning" | "critical";
      recommendations?: string[];
    } | null;
    overrideProductSuggestions?: Array<{
      id: string;
      title: string;
      handle: string;
      imageUrl: string | null;
      imageAlt: string;
      price: { amount: string; currencyCode: "EUR" } | null;
      reason: string;
    }> | null;
  };

  const existing = await prisma.plantAnalysisRun.findUnique({
    where: { id },
    select: {
      id: true,
      reviewStatus: true,
      safetyFlags: true,
      reviewNotes: true,
      outputJson: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  const nextStatus =
    typeof body.reviewStatus === "string"
      ? normalizePlantAnalysisReviewStatus(body.reviewStatus)
      : existing.reviewStatus;
  if (
    typeof body.reviewStatus === "string" &&
    !reviewStatusSet.has(body.reviewStatus.trim().toUpperCase())
  ) {
    return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  }

  const nextSafetyFlags =
    typeof body.safetyFlags === "undefined"
      ? existing.safetyFlags
      : parseSafetyFlags(body.safetyFlags);
  if (!nextSafetyFlags) {
    return NextResponse.json({ error: "Invalid safety flags." }, { status: 400 });
  }

  const nextNotes =
    typeof body.reviewNotes === "undefined"
      ? existing.reviewNotes
      : body.reviewNotes?.trim() || null;

  const nextOverrideDiagnosis =
    body.overrideDiagnosis && typeof body.overrideDiagnosis === "object"
      ? {
          ...(body.overrideDiagnosis.species ? { species: body.overrideDiagnosis.species } : {}),
          ...(typeof body.overrideDiagnosis.confidence === "number"
            ? { confidence: body.overrideDiagnosis.confidence }
            : {}),
          ...(body.overrideDiagnosis.healthStatus
            ? { healthStatus: body.overrideDiagnosis.healthStatus }
            : {}),
          ...(Array.isArray(body.overrideDiagnosis.recommendations)
            ? {
                recommendations: body.overrideDiagnosis.recommendations
                  .map((entry) => entry.trim())
                  .filter(Boolean)
                  .slice(0, 6),
              }
            : {}),
        }
      : null;

  const nextOverrideProductSuggestions = Array.isArray(body.overrideProductSuggestions)
    ? body.overrideProductSuggestions
        .filter(
          (entry) =>
            entry &&
            typeof entry.id === "string" &&
            typeof entry.title === "string" &&
            typeof entry.handle === "string" &&
            typeof entry.imageAlt === "string" &&
            typeof entry.reason === "string",
        )
        .slice(0, 6)
    : null;

  const actor = getInternalAdminBridgeActor(request);
  const updated = await prisma.$transaction(async (tx) => {
    const reviewer = actor.id
      ? await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } })
      : null;
    const queueStatus: PlantAnalyzerReviewedCase["queueStatus"] =
      nextStatus === "REVIEWED_OK"
        ? "resolved"
        : nextStatus === "NEEDS_PROMPT_FIX" ||
            nextStatus === "NEEDS_RECOMMENDATION_FIX"
          ? "rerun_requested"
          : nextStatus === "PRIVACY_REVIEW" ||
              nextStatus === "REVIEWED_UNSAFE" ||
              nextStatus === "REVIEWED_INCORRECT"
            ? "in_review"
            : "new";

    const reviewedCase: PlantAnalyzerReviewedCase = {
      reviewStatus: nextStatus,
      queueStatus,
      reviewedAt: new Date().toISOString(),
      reviewNotes: nextNotes,
      qualityLabels: nextSafetyFlags,
      override:
        nextOverrideDiagnosis || nextOverrideProductSuggestions
          ? {
              ...(nextOverrideDiagnosis ? { diagnosis: nextOverrideDiagnosis } : {}),
              ...(nextOverrideProductSuggestions
                ? { productSuggestions: nextOverrideProductSuggestions }
                : {}),
              resolutionNote: nextNotes,
            }
          : null,
    };

    const run = await tx.plantAnalysisRun.update({
      where: { id },
      data: {
        reviewStatus: nextStatus,
        safetyFlags: nextSafetyFlags,
        reviewNotes: nextNotes,
        reviewedAt: new Date(),
        reviewedById: reviewer?.id ?? null,
        outputJson: mergePlantAnalyzerStoredOutput(existing.outputJson, {
          reviewedCase,
        }),
      },
    });
    await tx.plantAnalysisReviewEvent.create({
      data: {
        analysisId: id,
        actorId: reviewer?.id ?? null,
        actorEmail: actor.email,
        fromStatus: existing.reviewStatus,
        toStatus: nextStatus,
        safetyFlags: nextSafetyFlags,
        notes: nextNotes,
        metadata: { source: "internal.admin.analyzer.review.patch" },
      },
    });
    return run;
  });

  return NextResponse.json({
    run: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      imageRetentionUntil: updated.imageRetentionUntil?.toISOString() ?? null,
      imageDeletedAt: updated.imageDeletedAt?.toISOString() ?? null,
    },
  });
}
