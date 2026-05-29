import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/requestSecurity";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        analysisId?: unknown;
        isCorrect?: unknown;
        helpful?: unknown;
        correctLabel?: unknown;
        comment?: unknown;
        source?: unknown;
      }
    | null;

  const analysisId = typeof body?.analysisId === "string" ? body.analysisId : "";
  const isCorrect =
    typeof body?.isCorrect === "boolean"
      ? body.isCorrect
      : typeof body?.helpful === "boolean"
        ? body.helpful
        : null;

  if (!analysisId || typeof isCorrect !== "boolean") {
    return NextResponse.json(
      { error: "analysisId and isCorrect are required." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);
  const run = await prisma.plantAnalysisRun.findUnique({
    where: { id: analysisId },
    select: { id: true, userId: true },
  });

  if (!run || (run.userId && run.userId !== session?.user?.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const feedback = await prisma.plantAnalysisFeedback.create({
    data: {
      analysisId,
      userId: session?.user?.id ?? null,
      isCorrect,
      correctLabel:
        typeof body?.correctLabel === "string"
          ? body.correctLabel.trim().slice(0, 120) || null
          : null,
      comment:
        typeof body?.comment === "string"
          ? body.comment.trim().slice(0, 1000) || null
          : null,
      source:
        typeof body?.source === "string"
          ? body.source.trim().slice(0, 40) || "web"
          : "web",
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    feedback: {
      id: feedback.id,
      createdAt: feedback.createdAt.toISOString(),
    },
  });
}
