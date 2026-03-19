import { NextResponse } from "next/server";
import { analyzePlantImage } from "@/lib/plantAnalyzer";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseMobileToken } from "@/lib/mobileToken";

type AnalyzeBody = {
  imageUri?: string;
  notes?: string;
  plantId?: string;
};

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `mobile-ai-analyze:ip:${ip}`,
    limit: 30,
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
    key: `mobile-ai-analyze:user:${tokenPayload.sub}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!userLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenPayload.sub },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
  const imageUri = body.imageUri?.trim();
  const notes = body.notes?.trim() ?? "";
  const plantId = body.plantId?.trim() || null;

  if (!imageUri) {
    return NextResponse.json({ error: "Missing imageUri" }, { status: 400 });
  }
  if (imageUri.length < 20 || imageUri.length > 12_000_000) {
    return NextResponse.json(
      { error: "Invalid imageUri payload" },
      { status: 400 },
    );
  }

  try {
    const result = await analyzePlantImage({
      imageUri,
      notes,
      plantId,
      userId: tokenPayload.sub,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("OPENAI_API_KEY missing") ? 503 : 502;
    return NextResponse.json(
      { error: "Analyzer failed", details: message.slice(0, 500) },
      { status },
    );
  }
}
