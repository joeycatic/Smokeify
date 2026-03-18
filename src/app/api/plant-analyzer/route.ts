import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { analyzePlantImage, type PlantAnalyzerIssue } from "@/lib/plantAnalyzer";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  getPlantAnalyzerGuideSuggestions,
  getPlantAnalyzerProductSuggestions,
} from "@/lib/plantAnalyzerRecommendations";

type AnalyzeBody = {
  imageUri?: string;
  notes?: string;
};

const FREE_ANALYSIS_LIMIT = 3;
const FREE_ANALYSIS_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Bitte anmelden oder registrieren." },
      { status: 401 },
    );
  }
  const isPrivilegedUser =
    session.user.role === "ADMIN" || session.user.role === "STAFF";

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `website-plant-analyzer:ip:${ip}`,
    limit: 12,
    windowMs: 60 * 1000,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte kurz warten." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
  const imageUri = body.imageUri?.trim();
  const notes = body.notes?.trim() ?? "";

  if (!imageUri) {
    return NextResponse.json({ error: "Bitte ein Foto hochladen." }, { status: 400 });
  }
  if (imageUri.length < 20 || imageUri.length > 12_000_000) {
    return NextResponse.json({ error: "Das Bildformat ist ungültig." }, { status: 400 });
  }

  if (!isPrivilegedUser) {
    const windowStart = new Date(Date.now() - FREE_ANALYSIS_WINDOW_MS);
    const existingAnalysesCount = await prisma.plantAnalysisRun.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: windowStart },
      },
    });
    if (existingAnalysesCount >= FREE_ANALYSIS_LIMIT) {
      return NextResponse.json(
        {
          error:
            "Deine 3 kostenlosen Analysen in den letzten 24 Stunden wurden bereits verwendet. Das Limit setzt sich nach 24 Stunden zurück.",
        },
        { status: 403 },
      );
    }
  }

  try {
    const result = await analyzePlantImage({
      imageUri,
      notes,
      userId: session.user.id,
    });
    const primaryIssues = result.issues.slice(0, 2);
    const productSuggestions =
      await getPlantAnalyzerProductSuggestions(primaryIssues);
    const guideSuggestions = getPlantAnalyzerGuideSuggestions(primaryIssues);

    return NextResponse.json({
      diagnosis: {
        healthStatus: result.healthStatus,
        species: result.species,
        confidence: result.confidence,
        issues: primaryIssues,
        recommendations: result.recommendations.slice(0, 3),
      },
      productSuggestions,
      guideSuggestions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("OPENAI_API_KEY missing")
      ? 503
      : error instanceof Error &&
          error.name === "PlantAnalyzerInvalidImageError"
        ? 422
      : message.includes("Model refused plant analysis")
        ? 422
        : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "PlantAnalyzerInvalidImageError"
            ? message
            : message.includes("Model refused plant analysis")
              ? "Die Bildanalyse konnte nicht sicher ausgewertet werden. Bitte lade ein klareres Pflanzenfoto hoch oder ergänze mehr Kontext."
              : "Analyse fehlgeschlagen.",
        details: message.slice(0, 500),
      },
      { status },
    );
  }
}
