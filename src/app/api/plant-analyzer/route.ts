import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzePlantImage } from "@/lib/plantAnalyzer";
import { validatePlantAnalyzerImageMeta } from "@/lib/plantAnalyzerRequestValidation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

const parseOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeContext = (input: Record<string, unknown>) => ({
  medium: typeof input.medium === "string" ? input.medium : undefined,
  growthStage:
    typeof input.growthStage === "string" ? input.growthStage : undefined,
  wateringCadence:
    typeof input.wateringCadence === "string" ? input.wateringCadence : undefined,
  ph: parseOptionalNumber(input.ph),
  ec: parseOptionalNumber(input.ec),
  temperatureC: parseOptionalNumber(input.temperatureC),
  humidityPercent: parseOptionalNumber(input.humidityPercent),
  lightDistanceCm: parseOptionalNumber(input.lightDistanceCm),
  lightType: typeof input.lightType === "string" ? input.lightType : undefined,
  tentOrRoomSize:
    typeof input.tentOrRoomSize === "string" ? input.tentOrRoomSize : undefined,
});

const fileToDataUri = async (file: File) => {
  const validation = validatePlantAnalyzerImageMeta({
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!validation.ok) {
    throw new Error(validation.code);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
};

async function parsePlantAnalyzerRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File)) {
      throw new Error("MISSING_IMAGE");
    }

    return {
      imageUri: await fileToDataUri(image),
      notes: readString(formData.get("notes")),
      previousAnalysisId: readString(formData.get("previousAnalysisId")) || null,
      plantId: readString(formData.get("plantId")) || null,
      analysisContext: normalizeContext({
        medium: readString(formData.get("medium")),
        growthStage: readString(formData.get("growthStage")),
        wateringCadence: readString(formData.get("wateringCadence")),
        ph: readString(formData.get("ph")),
        ec: readString(formData.get("ec")),
        temperatureC: readString(formData.get("temperatureC")),
        humidityPercent: readString(formData.get("humidityPercent")),
        lightDistanceCm: readString(formData.get("lightDistanceCm")),
        lightType: readString(formData.get("lightType")),
        tentOrRoomSize: readString(formData.get("tentOrRoomSize")),
      }),
    };
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) {
    throw new Error("INVALID_JSON");
  }

  const imageUri = typeof body.imageUri === "string" ? body.imageUri : undefined;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
  if (!imageUri && !imageUrl) {
    throw new Error("MISSING_IMAGE");
  }

  return {
    imageUri,
    imageUrl,
    notes: typeof body.notes === "string" ? body.notes : "",
    previousAnalysisId:
      typeof body.previousAnalysisId === "string" ? body.previousAnalysisId : null,
    plantId: typeof body.plantId === "string" ? body.plantId : null,
    analysisContext: normalizeContext(
      (body.analysisContext && typeof body.analysisContext === "object"
        ? (body.analysisContext as Record<string, unknown>)
        : body) ?? {},
    ),
  };
}

const toErrorResponse = (error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "UNSUPPORTED_IMAGE_TYPE") {
    return NextResponse.json(
      { error: "Bitte lade ein JPG, PNG oder WebP Pflanzenfoto hoch." },
      { status: 415 },
    );
  }
  if (message === "IMAGE_TOO_LARGE") {
    return NextResponse.json(
      { error: "Das Bild ist zu groß. Bitte nutze maximal 7 MB." },
      { status: 413 },
    );
  }
  if (message === "MISSING_IMAGE" || message === "INVALID_JSON") {
    return NextResponse.json(
      { error: "Bitte lade ein Pflanzenfoto oder eine Bild-URL hoch." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "Die Pflanzenanalyse konnte nicht abgeschlossen werden." },
    { status: 500 },
  );
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const rateLimit = await checkRateLimit({
    key: `plant-analyzer:ip:${ip}`,
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Analysen. Bitte versuche es später erneut." },
      { status: 429 },
    );
  }

  try {
    const session = await getServerSession(authOptions);
    const payload = await parsePlantAnalyzerRequest(request);
    const result = await analyzePlantImage({
      ...payload,
      userId: session?.user?.id ?? null,
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Smokeify plant analyzer request failed", error);
    return toErrorResponse(error);
  }
}
