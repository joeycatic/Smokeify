import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import type { PlantHealthStatus } from "@prisma/client";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseMobileToken } from "@/lib/mobileToken";
import { prisma } from "@/lib/prisma";

type AnalyzeBody = {
  imageUri?: string;
  notes?: string;
  plantId?: string;
};

type ParsedAiResult = {
  species: string;
  confidence: number;
  healthStatus: "healthy" | "warning" | "critical" | "unknown";
  issues: Array<{ id: string; label: string; confidence: number; severity: "healthy" | "warning" | "critical" }>;
  recommendations: string[];
};

function clampConfidence(value: unknown, fallback = 0.7) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function toJsonString(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const withoutFence = trimmed
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1);
  }

  return withoutFence;
}

function parseModelJson(raw: string): ParsedAiResult {
  const parsed = JSON.parse(toJsonString(raw)) as Partial<ParsedAiResult>;

  return {
    species: (parsed.species ?? "Unbekannt").toString(),
    confidence: clampConfidence(parsed.confidence, 0.7),
    healthStatus:
      parsed.healthStatus === "healthy" ||
      parsed.healthStatus === "warning" ||
      parsed.healthStatus === "critical" ||
      parsed.healthStatus === "unknown"
        ? parsed.healthStatus
        : "unknown",
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.slice(0, 5).map((issue, index) => ({
          id: (issue.id ?? `issue-${index + 1}`).toString(),
          label: (issue.label ?? "Unbekannter Befund").toString(),
          confidence: clampConfidence(issue.confidence, 0.5),
          severity:
            issue.severity === "healthy" || issue.severity === "warning" || issue.severity === "critical"
              ? issue.severity
              : "warning",
        }))
      : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((item) => item.toString()).filter(Boolean).slice(0, 6)
      : [],
  };
}

function extractOutputText(rawText: string) {
  const payload = JSON.parse(rawText) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  let outputText = payload.output_text ?? "";
  if (!outputText && Array.isArray(payload.output)) {
    for (const item of payload.output) {
      for (const content of item.content ?? []) {
        if (content.type === "output_text" && content.text) {
          outputText += content.text;
        }
      }
    }
  }

  return outputText;
}

function parseDataUriMeta(imageUri: string) {
  if (!imageUri.startsWith("data:")) {
    return {
      imageUri,
      imageMime: null as string | null,
      imageHash: createHash("sha256").update(imageUri).digest("hex"),
    };
  }

  const header = imageUri.slice(0, imageUri.indexOf(",") > 0 ? imageUri.indexOf(",") : 80);
  const mime = header.slice("data:".length).split(";")[0] || "application/octet-stream";
  return {
    imageUri: null,
    imageMime: mime,
    imageHash: createHash("sha256").update(imageUri).digest("hex"),
  };
}

function toDbHealthStatus(value: ParsedAiResult["healthStatus"]): PlantHealthStatus {
  if (value === "healthy") return "HEALTHY";
  if (value === "critical") return "CRITICAL";
  return "WARNING";
}

function toApiHealthStatus(value: ParsedAiResult["healthStatus"]): "healthy" | "warning" | "critical" {
  if (value === "healthy") return "healthy";
  if (value === "critical") return "critical";
  return "warning";
}

async function callVisionModel({
  apiKey,
  model,
  imageUri,
  notes,
}: {
  apiKey: string;
  model: string;
  imageUri: string;
  notes: string;
}) {
  const prompt = [
    "Analysiere das Pflanzenbild und gib nur JSON zurück.",
    "Schema:",
    '{"species":"string","confidence":0-1,"healthStatus":"healthy|warning|critical|unknown","issues":[{"id":"string","label":"string","confidence":0-1,"severity":"healthy|warning|critical"}],"recommendations":["string"]}',
    "Alle Freitext-Felder muessen auf Deutsch sein (insbesondere issue.label und recommendations).",
    "Nutze kurze, klare deutsche Formulierungen.",
    "Befunde muessen moeglichst konkret benannt werden, nicht allgemein.",
    "Bevorzugte issue.label Beispiele: Calciummangel, Magnesiummangel, Stickstoffmangel, Kaliummangel, Naehrstoffverbrennung, Ueberwaesserung, Unterwaesserung, Lichtstress, Hitzestress, Schaedlingsbefall (Thripse/Spinnmilben), pH-Blockade, Schimmelverdacht.",
    "Wenn kein klarer Befund sichtbar ist, verwende 'Kein akuter Befund'.",
    "Empfehlungen muessen konkret und umsetzbar sein (z. B. pH-Zielbereich, EC senken, CalMag-Dosis pruefen, Abstand zur Lampe erhoehen, Blattunterseiten auf Schaedlinge kontrollieren).",
    "Vermeide vage Empfehlungen wie 'weiter beobachten' ohne konkrete naechste Aktion.",
    "Regeln: max 5 issues, max 6 recommendations, keine Markdown-Formatierung, nur valides JSON.",
    notes ? `Zusatznotiz: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 500,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUri },
          ],
        },
      ],
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${rawText.slice(0, 200)}`);
  }

  const outputText = extractOutputText(rawText);
  if (!outputText.trim()) {
    throw new Error("AI returned empty output");
  }

  const parsed = parseModelJson(outputText);
  return { parsed, outputText };
}

export async function POST(request: Request) {
  const startedAt = Date.now();
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
  if (tokenPayload?.sub) {
    const userLimit = await checkRateLimit({
      key: `mobile-ai-analyze:user:${tokenPayload.sub}`,
      limit: 120,
      windowMs: 60 * 1000,
    });
    if (!userLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
  const imageUri = body.imageUri?.trim();
  const notes = body.notes?.trim() ?? "";
  const plantId = body.plantId?.trim() || null;

  if (!imageUri) {
    return NextResponse.json({ error: "Missing imageUri" }, { status: 400 });
  }
  if (imageUri.length < 20 || imageUri.length > 12_000_000) {
    return NextResponse.json({ error: "Invalid imageUri payload" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI backend not configured (OPENAI_API_KEY missing)" }, { status: 503 });
  }

  const modelFast = process.env.AI_MODEL_FAST ?? process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
  const modelStrong = process.env.AI_MODEL_STRONG ?? "gpt-4o";
  const escalationConfidence = clampConfidence(process.env.AI_ANALYZER_ESCALATION_CONFIDENCE, 0.72);

  try {
    const fastResult = await callVisionModel({
      apiKey,
      model: modelFast,
      imageUri,
      notes,
    });

    const needsFallback =
      fastResult.parsed.healthStatus === "unknown" || fastResult.parsed.confidence < escalationConfidence;

    const finalResult = needsFallback
      ? await callVisionModel({
          apiKey,
          model: modelStrong,
          imageUri,
          notes,
        })
      : fastResult;

    const finalModel = needsFallback ? modelStrong : modelFast;
    const normalizedHealthStatus = toApiHealthStatus(finalResult.parsed.healthStatus);
    const imageMeta = parseDataUriMeta(imageUri);

    let analysisId = `analysis-${Date.now()}`;
    try {
      const created = await prisma.plantAnalysisRun.create({
        data: {
          userId: tokenPayload?.sub ?? null,
          plantId,
          imageUri: imageMeta.imageUri,
          imageHash: imageMeta.imageHash,
          imageMime: imageMeta.imageMime,
          notes: notes || null,
          provider: "openai",
          model: finalModel,
          latencyMs: Date.now() - startedAt,
          confidence: finalResult.parsed.confidence,
          healthStatus: toDbHealthStatus(normalizedHealthStatus),
          species: finalResult.parsed.species,
          outputJson: finalResult.parsed,
          issues: {
            create: finalResult.parsed.issues.map((issue, index) => ({
              sourceIssueId: issue.id,
              label: issue.label,
              confidence: issue.confidence,
              severity: toDbHealthStatus(issue.severity),
              position: index,
            })),
          },
        },
        select: { id: true },
      });
      analysisId = created.id;
    } catch (persistError) {
      console.error("Failed to persist plant analysis", persistError);
    }

    return NextResponse.json({
      id: analysisId,
      imageUri,
      species: finalResult.parsed.species,
      confidence: finalResult.parsed.confidence,
      healthStatus: normalizedHealthStatus,
      issues: finalResult.parsed.issues,
      recommendations: finalResult.parsed.recommendations.length > 0 ? finalResult.parsed.recommendations : ["Keine Empfehlung verfügbar."],
      analyzedAt: new Date().toISOString(),
      source: "api",
      modelVersion: finalModel,
      rawProvider: "openai",
      usedFallback: needsFallback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Analyzer failed", details: message.slice(0, 500) }, { status: 502 });
  }
}
