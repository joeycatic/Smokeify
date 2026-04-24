import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  type BloomtechPreviewPayload,
  loadLatestBloomtechPreviewPayload,
  saveBloomtechPreviewPayload,
} from "@/lib/bloomtechAdminPreviewStore";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminScriptDefinition } from "@/lib/adminScripts";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { canAdminPerformAction } from "@/lib/adminPermissions";
import { finishAdminJobRun, startAdminJobRun } from "@/lib/adminJobRuns";

export const runtime = "nodejs";
export const maxDuration = 600;

const OUTPUT_LIMIT = 12_000;
const AUDIT_OUTPUT_LIMIT = 1_000;

declare global {
  var __smokeifyActiveAdminScriptRun:
    | {
        scriptId: string;
        title: string;
      }
    | undefined;
}

function getActiveRunState() {
  if (!globalThis.__smokeifyActiveAdminScriptRun) {
    globalThis.__smokeifyActiveAdminScriptRun = undefined;
  }
  return globalThis;
}

function appendOutput(current: string, chunk: Buffer | string) {
  const next = current + chunk.toString();
  if (next.length <= OUTPUT_LIMIT) return next;
  return next.slice(-OUTPUT_LIMIT);
}

function appendOutputLine(current: string, line: string) {
  const next = current ? `${current}\n${line}` : line;
  if (next.length <= OUTPUT_LIMIT) return next;
  return next.slice(-OUTPUT_LIMIT);
}

function compactOutput(value: string, maxLength = AUDIT_OUTPUT_LIMIT) {
  if (value.length <= maxLength) return value;
  return value.slice(-maxLength);
}

function normalizeScriptInputs(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, rawValue]) =>
      typeof rawValue === "string" ? [[key, rawValue]] : [],
    ),
  );
}

function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function buildScriptExecution(definition: NonNullable<ReturnType<typeof getAdminScriptDefinition>>, rawInputs: Record<string, string>) {
  switch (definition.id) {
    case "bloomtech:scrape-preview":
    case "bloomtech:scrape-category-preview":
    case "bloomtech:scrape-product-preview": {
      const rawSourceUrl = rawInputs.sourceUrl?.trim() ?? "";
      if (!rawSourceUrl) {
        return {
          scriptArgs: [] as string[],
          normalizedInputs: {} as Record<string, string>,
        };
      }

      const sourceUrl = normalizeHttpUrl(rawSourceUrl);
      if (!sourceUrl) {
        return {
          error: "Bloomtech link must be a valid http or https URL.",
        };
      }

      const hostname = new URL(sourceUrl).hostname.toLowerCase();
      if (hostname !== "bloomtech.de" && hostname !== "www.bloomtech.de") {
        return {
          error: "Bloomtech link must point to bloomtech.de.",
        };
      }

      return {
        scriptArgs: ["--url", sourceUrl],
        normalizedInputs: { sourceUrl },
      };
    }
    case "bloomtech:import-preview":
      return {
        scriptArgs: ["--apply"],
        envOverrides: {
          BLOOMTECH_IMPORT_ALLOW_WRITE: "1",
        } as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
    case "pricing:seed-bloomtech-profiles":
      return {
        scriptArgs: ["--apply"],
        envOverrides: {
          PRICING_PROFILE_SEED_ALLOW_WRITE: "1",
        } as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
    default:
      return {
        scriptArgs: [] as string[],
        envOverrides: {} as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
  }
}

function buildInputMetadata(inputs: Record<string, string>) {
  return Object.keys(inputs).length > 0 ? { inputs } : {};
}

function escapeWindowsCmdArg(value: string) {
  return value
    .replace(/\^/g, "^^")
    .replace(/%/g, "%%")
    .replace(/[&|<>()!]/g, "^$&");
}

function getScriptCommand(scriptId: string, scriptArgs: string[] = []) {
  if (process.platform === "win32") {
    const commandLine = [
      "npm",
      "run",
      scriptId,
      ...(scriptArgs.length > 0 ? ["--", ...scriptArgs.map(escapeWindowsCmdArg)] : []),
    ].join(" ");

    return {
      command: process.env.ComSpec ?? "cmd.exe",
      args: ["/d", "/s", "/c", commandLine],
    };
  }

  return {
    command: "npm",
    args: ["run", scriptId, ...(scriptArgs.length > 0 ? ["--", ...scriptArgs] : [])],
  };
}

async function executeScript({
  scriptId,
  timeoutMs,
  scriptArgs,
  envOverrides,
}: {
  scriptId: string;
  timeoutMs: number;
  scriptArgs?: string[];
  envOverrides?: Record<string, string>;
}) {
  return new Promise<{
    ok: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }>((resolve, reject) => {
    const command = getScriptCommand(scriptId, scriptArgs);
    const child = spawn(command.command, command.args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...envOverrides,
      },
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timedOut = false;

    const settle = (result: {
      ok: boolean;
      stdout: string;
      stderr: string;
      exitCode: number | null;
      timedOut: boolean;
    }) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = appendOutput(stdout, chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr = appendOutput(stderr, chunk);
    });

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.on("close", (code) => {
      settle({
        ok: code === 0 && !timedOut,
        stdout,
        stderr,
        exitCode: code,
        timedOut,
      });
    });
  });
}

async function executeInternalSupplierSync() {
  let stdout = "";
  let stderr = "";

  const { runSupplierSync } = await import("@/lib/supplierStockSync.mjs");
  const result = await runSupplierSync({
    prisma,
    logger: {
      info(message: string) {
        stdout = appendOutputLine(stdout, message);
      },
      warn(message: string) {
        stderr = appendOutputLine(stderr, message);
      },
    },
  });

  return {
    ok: true,
    stdout,
    stderr,
    exitCode: 0,
    timedOut: result.timedOut,
  };
}

function createBufferedLogger() {
  let stdout = "";
  let stderr = "";

  return {
    logger: {
      log: (...args: unknown[]) => {
        stdout = appendOutputLine(stdout, args.map(String).join(" "));
      },
      warn: (...args: unknown[]) => {
        stderr = appendOutputLine(stderr, args.map(String).join(" "));
      },
      error: (...args: unknown[]) => {
        stderr = appendOutputLine(stderr, args.map(String).join(" "));
      },
    },
    getResult: () => ({ stdout, stderr }),
  };
}

async function executeInternalBloomtechPreview({
  scriptId,
  sourceUrl,
}: {
  scriptId: string;
  sourceUrl?: string;
}) {
  const mode =
    scriptId === "bloomtech:scrape-product-preview" ? "product" : "category";
  const { logger, getResult } = createBufferedLogger();
  const bloomtechModule = await import(
    "../../../../../scripts/bloomtech/scrapeSupplierPreview.mjs"
  );
  const runBloomtechSupplierPreview = bloomtechModule.runBloomtechSupplierPreview as (
    options: Record<string, unknown>
  ) => Promise<{ items?: unknown[] }>;
  const payload = await runBloomtechSupplierPreview({
    mode,
    ...(sourceUrl ? { url: sourceUrl } : {}),
    persistOutput: false,
    logger: logger as Console,
  });
  await saveBloomtechPreviewPayload(payload as BloomtechPreviewPayload);

  const buffered = getResult();
  const savedLine = `[preview] saved latest Bloomtech preview to database payload items=${Array.isArray(payload.items) ? payload.items.length : 0}`;

  return {
    ok: true,
    stdout: appendOutputLine(buffered.stdout, savedLine),
    stderr: buffered.stderr,
    exitCode: 0,
    timedOut: false,
  };
}

async function executeInternalBloomtechImportPreview() {
  const preview = await loadLatestBloomtechPreviewPayload();
  if (!preview) {
    return {
      ok: false,
      stdout: "",
      stderr:
        "No stored Bloomtech preview is available. Run a Bloomtech scrape preview first.",
      exitCode: 1,
      timedOut: false,
    };
  }

  const { logger, getResult } = createBufferedLogger();
  const bloomtechModule = await import(
    "../../../../../scripts/bloomtech/importPreviewToCatalog.mjs"
  );
  const runBloomtechImportPreview = bloomtechModule.runBloomtechImportPreview as (
    options: Record<string, unknown>
  ) => Promise<unknown>;

  await runBloomtechImportPreview({
    payload: preview.payload,
    apply: true,
    allowWrite: true,
    logger: logger as Console,
  });

  const buffered = getResult();
  const previewMetaLine = `[import] using stored Bloomtech preview savedAt=${preview.createdAt.toISOString()} items=${preview.payload.items.length}`;

  return {
    ok: true,
    stdout: appendOutputLine(previewMetaLine, buffered.stdout),
    stderr: buffered.stderr,
    exitCode: 0,
    timedOut: false,
  };
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-scripts:ip:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many script triggers. Please wait and try again." },
      { status: 429 },
    );
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAdminPerformAction(session.user.role, "admin.script.execute")) {
    return NextResponse.json(
      { error: "You do not have permission to execute admin scripts." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    scriptId?: string;
    inputs?: Record<string, unknown>;
    reason?: string;
  };
  const scriptId = body.scriptId?.trim();
  if (!scriptId) {
    return NextResponse.json({ error: "Missing script id." }, { status: 400 });
  }

  const definition = getAdminScriptDefinition(scriptId);
  if (!definition) {
    return NextResponse.json({ error: "Script is not approved for admin execution." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A short execution reason is required before running admin scripts." },
      { status: 400 },
    );
  }

  const requestedInputs = normalizeScriptInputs(body.inputs);
  const execution = buildScriptExecution(definition, requestedInputs);
  if ("error" in execution) {
    return NextResponse.json({ error: execution.error }, { status: 400 });
  }

  const activeRunState = getActiveRunState();
  if (activeRunState.__smokeifyActiveAdminScriptRun) {
    const activeRun = activeRunState.__smokeifyActiveAdminScriptRun;
    return NextResponse.json(
      {
        error: `Another script is already running: ${activeRun.title}. Wait for it to finish before starting a new run.`,
      },
      { status: 409 },
    );
  }

  activeRunState.__smokeifyActiveAdminScriptRun = {
    scriptId: definition.id,
    title: definition.title,
  };

  const startedAt = Date.now();
  const jobRun = await startAdminJobRun({
    jobType: "admin_script",
    summary: definition.title,
    metadata: {
      scriptId: definition.id,
      npmScript: definition.npmScript,
      reason,
      ...buildInputMetadata(execution.normalizedInputs),
    },
    actor: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "admin.script.run.started",
    targetType: "script",
    targetId: definition.id,
    summary: `Started ${definition.title}`,
        metadata: {
          scriptId: definition.id,
          npmScript: definition.npmScript,
          riskLevel: definition.riskLevel,
          reason,
          ...buildInputMetadata(execution.normalizedInputs),
        },
      });

  try {
    const result =
      definition.id === "suppliers:sync-stock"
        ? await executeInternalSupplierSync()
        : definition.id === "bloomtech:scrape-preview" ||
            definition.id === "bloomtech:scrape-category-preview" ||
            definition.id === "bloomtech:scrape-product-preview"
          ? await executeInternalBloomtechPreview({
              scriptId: definition.id,
              sourceUrl: execution.normalizedInputs.sourceUrl,
            })
          : definition.id === "bloomtech:import-preview"
            ? await executeInternalBloomtechImportPreview()
        : await executeScript({
            scriptId: definition.npmScript,
            timeoutMs: definition.timeoutMs,
            scriptArgs: execution.scriptArgs,
            envOverrides: "envOverrides" in execution ? execution.envOverrides : undefined,
          });
    const durationMs = Date.now() - startedAt;

    if (!result.ok) {
      const errorMessage = result.timedOut
        ? `${definition.title} timed out after ${Math.round(definition.timeoutMs / 1000)} seconds.`
        : result.stderr.trim() || `Script exited with code ${result.exitCode ?? "unknown"}.`;

      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "admin.script.run.failed",
        targetType: "script",
        targetId: definition.id,
        summary: `${definition.title} failed`,
        metadata: {
          scriptId: definition.id,
          npmScript: definition.npmScript,
          durationMs,
          timedOut: result.timedOut,
          exitCode: result.exitCode,
          reason,
          ...buildInputMetadata(execution.normalizedInputs),
          stdoutTail: compactOutput(result.stdout),
          stderrTail: compactOutput(result.stderr),
        },
      });
      await finishAdminJobRun({
        id: jobRun.id,
        status: "FAILED",
        summary: definition.title,
        errorMessage,
        metadata: {
          durationMs,
          timedOut: result.timedOut,
          exitCode: result.exitCode,
        },
      });

      return NextResponse.json(
        {
          error: errorMessage,
          scriptId: definition.id,
          title: definition.title,
          durationMs,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        { status: result.timedOut ? 504 : 500 },
      );
    }

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "admin.script.run.completed",
      targetType: "script",
      targetId: definition.id,
      summary: `Completed ${definition.title}`,
      metadata: {
        scriptId: definition.id,
        npmScript: definition.npmScript,
        durationMs,
        exitCode: result.exitCode,
        reason,
        ...buildInputMetadata(execution.normalizedInputs),
        stdoutTail: compactOutput(result.stdout),
      },
    });
    await finishAdminJobRun({
      id: jobRun.id,
      status: "SUCCEEDED",
      summary: definition.title,
      metadata: {
        durationMs,
        exitCode: result.exitCode,
      },
    });

    return NextResponse.json({
      ok: true,
      scriptId: definition.id,
      title: definition.title,
      durationMs,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message =
      error instanceof Error ? error.message : "Script execution failed unexpectedly.";

    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "admin.script.run.failed",
      targetType: "script",
      targetId: definition.id,
      summary: `${definition.title} could not start`,
      metadata: {
        scriptId: definition.id,
        npmScript: definition.npmScript,
        durationMs,
        reason,
        ...buildInputMetadata(execution.normalizedInputs),
        error: message,
      },
    });
    await finishAdminJobRun({
      id: jobRun.id,
      status: "FAILED",
      summary: definition.title,
      errorMessage: message,
      metadata: {
        durationMs,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    activeRunState.__smokeifyActiveAdminScriptRun = undefined;
  }
}
