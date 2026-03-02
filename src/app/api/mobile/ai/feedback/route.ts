import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseMobileToken } from "@/lib/mobileToken";
import { prisma } from "@/lib/prisma";

type FeedbackBody = {
  analysisId?: string;
  isCorrect?: boolean;
  correctLabel?: string;
  comment?: string;
};

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-ai-feedback:ip:${ip}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const tokenPayload = parseMobileToken(request.headers.get("authorization"));
  if (!tokenPayload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userLimit = await checkRateLimit({
    key: `mobile-ai-feedback:user:${tokenPayload.sub}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!userLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as FeedbackBody;
  const analysisId = body.analysisId?.trim();
  const comment = body.comment?.trim() || null;
  const correctLabel = body.correctLabel?.trim() || null;
  const isCorrect = Boolean(body.isCorrect);

  if (!analysisId) {
    return NextResponse.json({ error: "Missing analysisId" }, { status: 400 });
  }

  const analysis = await prisma.plantAnalysisRun.findUnique({
    where: { id: analysisId },
    select: { id: true },
  });
  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  const duplicate = await prisma.plantAnalysisFeedback.findFirst({
    where: {
      analysisId,
      userId: tokenPayload.sub,
      isCorrect,
      correctLabel: isCorrect ? null : correctLabel,
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
      userId: tokenPayload.sub,
      isCorrect,
      correctLabel: isCorrect ? null : correctLabel,
      comment,
      source: "mobile-app",
    },
  });

  return NextResponse.json({ ok: true });
}
