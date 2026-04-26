import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createHash, randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { analyzePlantImage } from "@/lib/plantAnalyzer";
import { authOptions } from "@/lib/auth";
import { attachServerTiming, getNow } from "@/lib/perf";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { detectImageFromBuffer } from "@/lib/uploadValidation";

const FREE_ANALYSIS_LIMIT = 3;
const FREE_ANALYSIS_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

const ALLOWED_ANALYZER_IMAGE_FORMATS = new Set(["jpeg", "png", "webp"]);

function parseFormNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  const startedAt = getNow();
  if (!isSameOrigin(request)) {
    return attachServerTiming(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
    );
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return attachServerTiming(
      NextResponse.json(
        { error: "Bitte anmelden oder registrieren." },
        { status: 401 },
      ),
      [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
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
    return attachServerTiming(
      NextResponse.json(
        { error: "Zu viele Anfragen. Bitte kurz warten." },
        { status: 429 },
      ),
      [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const notes =
    typeof formData?.get("notes") === "string"
      ? formData.get("notes")?.toString().trim() ?? ""
      : "";
  const previousAnalysisId =
    typeof formData?.get("previousAnalysisId") === "string"
      ? formData.get("previousAnalysisId")?.toString().trim() || null
      : null;
  const analysisContext = {
    medium:
      typeof formData?.get("medium") === "string"
        ? formData.get("medium")?.toString().trim() || undefined
        : undefined,
    growthStage:
      typeof formData?.get("growthStage") === "string"
        ? formData.get("growthStage")?.toString().trim() || undefined
        : undefined,
    wateringCadence:
      typeof formData?.get("wateringCadence") === "string"
        ? formData.get("wateringCadence")?.toString().trim() || undefined
        : undefined,
    ph: parseFormNumber(formData?.get("ph") ?? null),
    ec: parseFormNumber(formData?.get("ec") ?? null),
    temperatureC: parseFormNumber(formData?.get("temperatureC") ?? null),
    humidityPercent: parseFormNumber(formData?.get("humidityPercent") ?? null),
    lightDistanceCm: parseFormNumber(formData?.get("lightDistanceCm") ?? null),
    lightType:
      typeof formData?.get("lightType") === "string"
        ? formData.get("lightType")?.toString().trim() || undefined
        : undefined,
    tentOrRoomSize:
      typeof formData?.get("tentOrRoomSize") === "string"
        ? formData.get("tentOrRoomSize")?.toString().trim() || undefined
        : undefined,
  };

  if (!(file instanceof File)) {
    return attachServerTiming(
      NextResponse.json({ error: "Bitte ein Foto hochladen." }, { status: 400 }),
      [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
    );
  }
  if (file.size === 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return attachServerTiming(
      NextResponse.json(
        { error: "Bitte ein Bild bis maximal 8 MB hochladen." },
        { status: 400 },
      ),
      [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
    );
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
      return attachServerTiming(
        NextResponse.json(
          {
            error:
              "Deine 3 kostenlosen Analysen in den letzten 24 Stunden wurden bereits verwendet. Das Limit setzt sich nach 24 Stunden zurück.",
          },
          { status: 403 },
        ),
        [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
      );
    }
  }

  try {
    const uploadStartedAt = getNow();
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedImage = detectImageFromBuffer(buffer);
    if (!detectedImage || !ALLOWED_ANALYZER_IMAGE_FORMATS.has(detectedImage.format)) {
      return attachServerTiming(
        NextResponse.json(
          { error: "Bitte ein JPEG-, PNG- oder WebP-Bild hochladen." },
          { status: 400 },
        ),
        [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
      );
    }
    const imageHash = createHash("sha256").update(buffer).digest("hex");
    const filename = `plant-analyzer/${session.user.id}/${randomUUID()}${detectedImage.extension}`;
    const blob = await put(filename, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: detectedImage.mime,
    });
    const uploadDuration = getNow() - uploadStartedAt;

    const analyzeStartedAt = getNow();
    const result = await analyzePlantImage({
      imageUrl: blob.url,
      imageHash,
      imageMime: detectedImage.mime,
      notes,
      analysisContext,
      previousAnalysisId,
      userId: session.user.id,
    });
    const analyzeDuration = getNow() - analyzeStartedAt;

    return attachServerTiming(
      NextResponse.json({
        analysisId: result.persisted ? result.id : null,
        diagnosis: {
          healthStatus: result.healthStatus,
          species: result.species,
          confidence: result.confidence,
          issues: result.issues.slice(0, 2),
          recommendations: result.recommendations.slice(0, 3),
        },
        summary: result.summary,
        observedSymptoms: result.observedSymptoms,
        possibleCauses: result.possibleCauses,
        verificationChecks: result.verificationChecks,
        immediateActions: result.immediateActions,
        deferActions: result.deferActions,
        environmentConsiderations: result.environmentConsiderations,
        uncertaintyNote: result.uncertaintyNote,
        confidenceBand: result.confidenceBand,
        needsHumanReview: result.needsHumanReview,
        analysisContext: result.analysisContext,
        contextUsed: result.contextUsed,
        promptVersion: result.promptVersion,
        reasoningVersion: result.reasoningVersion,
        followUp: result.followUp,
        productSuggestions: result.productSuggestions,
        guideSuggestions: result.guideSuggestions,
        remediation: result.remediationPlan,
        lastFeedback: null,
        reviewedCase: null,
        storageWarning: result.persisted
          ? null
          : "Analysis completed, but the report could not be saved.",
      }),
      [
        { name: "analyzer_upload", durationMs: uploadDuration, description: "upload" },
        { name: "analyzer_model", durationMs: analyzeDuration, description: "model" },
        { name: "analyzer", durationMs: getNow() - startedAt, description: "submit" },
      ],
    );
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
    return attachServerTiming(
      NextResponse.json(
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
      ),
      [{ name: "analyzer", durationMs: getNow() - startedAt, description: "submit" }],
    );
  }
}
