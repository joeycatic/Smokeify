import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPlantAnalyzerStoredOutput,
  mergePlantAnalyzerStoredOutput,
} from "@/lib/plantAnalyzerOutput";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import type {
  PlantAnalyzerFeedbackClassification,
  PlantAnalyzerFeedbackOutcome,
} from "@/lib/plantAnalyzerRemediationTypes";

type FeedbackBody = {
  analysisId?: string;
  isCorrect?: boolean;
  correctLabel?: string;
  comment?: string;
  feedbackType?: string;
  outcome?: string;
};

const FEEDBACK_TYPES = new Set<PlantAnalyzerFeedbackClassification>([
  "helpful",
  "issue_guess_wrong",
  "product_suggestion_off",
  "recommendation_relevant",
  "follow_up_improved",
  "follow_up_worsened",
  "needs_recheck",
]);

const FEEDBACK_OUTCOMES = new Set<PlantAnalyzerFeedbackOutcome>([
  "improved",
  "unchanged",
  "worsened",
]);

function normalizeFeedbackType(
  value: string | undefined,
  fallbackCorrectLabel: string | null,
  isCorrect: boolean,
): PlantAnalyzerFeedbackClassification {
  if (value && FEEDBACK_TYPES.has(value as PlantAnalyzerFeedbackClassification)) {
    return value as PlantAnalyzerFeedbackClassification;
  }

  if (
    fallbackCorrectLabel &&
    FEEDBACK_TYPES.has(fallbackCorrectLabel as PlantAnalyzerFeedbackClassification)
  ) {
    return fallbackCorrectLabel as PlantAnalyzerFeedbackClassification;
  }

  return isCorrect ? "helpful" : "issue_guess_wrong";
}

function normalizeOutcome(value: string | undefined) {
  if (!value) return null;
  return FEEDBACK_OUTCOMES.has(value as PlantAnalyzerFeedbackOutcome)
    ? (value as PlantAnalyzerFeedbackOutcome)
    : null;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `plant-feedback:ip:${ip}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userLimit = await checkRateLimit({
    key: `plant-feedback:user:${session.user.id}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!userLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as FeedbackBody;
  const analysisId = body.analysisId?.trim();
  const comment = body.comment?.trim() || null;
  const fallbackCorrectLabel = body.correctLabel?.trim() || null;
  const isCorrect = Boolean(body.isCorrect);
  const feedbackType = normalizeFeedbackType(
    body.feedbackType?.trim(),
    fallbackCorrectLabel,
    isCorrect,
  );
  const outcome = normalizeOutcome(body.outcome?.trim());
  const helpful =
    feedbackType === "helpful" ||
    feedbackType === "recommendation_relevant" ||
    feedbackType === "follow_up_improved"
      ? true
      : feedbackType === "follow_up_worsened" ||
          feedbackType === "issue_guess_wrong" ||
          feedbackType === "product_suggestion_off"
        ? false
        : isCorrect;
  const correctLabel = feedbackType;

  if (!analysisId) {
    return NextResponse.json({ error: "Missing analysisId" }, { status: 400 });
  }

  const analysis = await prisma.plantAnalysisRun.findFirst({
    where: { id: analysisId, userId: session.user.id },
    select: { id: true, outputJson: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const duplicate = await prisma.plantAnalysisFeedback.findFirst({
    where: {
      analysisId,
      userId: session.user.id,
      isCorrect: helpful,
      correctLabel,
      comment,
      createdAt: {
        gte: new Date(Date.now() - 2 * 60 * 1000),
      },
    },
    select: { id: true },
  });

  if (duplicate) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  await prisma.plantAnalysisFeedback.create({
    data: {
      analysisId,
      userId: session.user.id,
      isCorrect: helpful,
      correctLabel,
      comment,
      source: `web-storefront:${feedbackType}`,
    },
  });

  const output = getPlantAnalyzerStoredOutput(analysis.outputJson);
  await prisma.plantAnalysisRun.update({
    where: { id: analysisId },
    data: {
      outputJson: mergePlantAnalyzerStoredOutput(output, {
        followUpStatus:
          feedbackType === "needs_recheck"
            ? "pending"
            : feedbackType === "follow_up_improved"
              ? "improved"
              : feedbackType === "follow_up_worsened"
                ? "worsened"
                : outcome ?? output.followUpStatus,
        followUpRecordedAt:
          feedbackType === "needs_recheck" ||
          feedbackType === "follow_up_improved" ||
          feedbackType === "follow_up_worsened" ||
          Boolean(outcome)
            ? new Date().toISOString()
            : output.followUpRecordedAt,
        lastFeedback: {
          helpful,
          classification: feedbackType,
          outcome,
          comment,
          recordedAt: new Date().toISOString(),
        },
      }),
    },
  });

  return NextResponse.json({ ok: true });
}
