import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

type AnalyzeBody = {
  imageUri?: string;
  notes?: string;
};

type ParsedAiResult = {
  species: string;
  confidence: number;
  healthStatus: "healthy" | "warning" | "critical";
  issues: Array<{ id: string; label: string; confidence: number; severity: "healthy" | "warning" | "critical" }>;
  recommendations: string[];
};

function clampConfidence(value: unknown, fallback = 0.7) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function parseModelJson(raw: string): ParsedAiResult {
  const parsed = JSON.parse(raw) as Partial<ParsedAiResult>;

  return {
    species: (parsed.species ?? "Unbekannt").toString(),
    confidence: clampConfidence(parsed.confidence, 0.7),
    healthStatus:
      parsed.healthStatus === "healthy" || parsed.healthStatus === "warning" || parsed.healthStatus === "critical"
        ? parsed.healthStatus
        : "warning",
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

  const body = (await request.json().catch(() => ({}))) as AnalyzeBody;
  const imageUri = body.imageUri?.trim();
  const notes = body.notes?.trim() ?? "";

  if (!imageUri) {
    return NextResponse.json({ error: "Missing imageUri" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI backend not configured (OPENAI_API_KEY missing)" }, { status: 503 });
  }

  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini";

  const prompt = [
    "Analysiere das Pflanzenbild und gib nur JSON zurück.",
    "Schema:",
    '{"species":"string","confidence":0-1,"healthStatus":"healthy|warning|critical","issues":[{"id":"string","label":"string","confidence":0-1,"severity":"healthy|warning|critical"}],"recommendations":["string"]}',
    "Antwort ausschließlich als JSON ohne Markdown.",
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
    return NextResponse.json({ error: `OpenAI request failed: ${response.status}`, details: rawText.slice(0, 500) }, { status: 502 });
  }

  let outputText = "";
  try {
    const payload = JSON.parse(rawText) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };

    outputText = payload.output_text ?? "";
    if (!outputText && Array.isArray(payload.output)) {
      for (const item of payload.output) {
        for (const content of item.content ?? []) {
          if (content.type === "output_text" && content.text) {
            outputText += content.text;
          }
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid AI response payload" }, { status: 502 });
  }

  if (!outputText.trim()) {
    return NextResponse.json({ error: "AI returned empty output" }, { status: 502 });
  }

  try {
    const parsed = parseModelJson(outputText);

    return NextResponse.json({
      id: `analysis-${Date.now()}`,
      imageUri,
      species: parsed.species,
      confidence: parsed.confidence,
      healthStatus: parsed.healthStatus,
      issues: parsed.issues,
      recommendations: parsed.recommendations.length > 0 ? parsed.recommendations : ["Keine Empfehlung verfügbar."],
      analyzedAt: new Date().toISOString(),
      source: "api",
    });
  } catch {
    return NextResponse.json({ error: "AI output was not valid JSON", raw: outputText.slice(0, 500) }, { status: 502 });
  }
}
