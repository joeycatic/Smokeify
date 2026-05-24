import "server-only";

import { spawn } from "node:child_process";
import { getAdminScriptDefinition } from "@/lib/adminScripts";
import { buildAdminScriptExecution } from "@/lib/adminScriptInputs";
import type { BloomtechPreviewPayload } from "@/lib/bloomtechAdminPreviewStore";
import {
  loadLatestBloomtechPreviewPayload,
  saveBloomtechPreviewPayload,
} from "@/lib/bloomtechAdminPreviewStore";
import {
  fetchGrowvaultAnalyzerAdminJson,
  getGrowvaultAnalyzerAdminBridgeTarget,
  hasGrowvaultAnalyzerAdminBridge,
} from "@/lib/growvaultAnalyzerAdminBridge";
import { prisma } from "@/lib/prisma";

const OUTPUT_LIMIT = 12_000;

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

  const { runSupplierSync } = await import(
    /* turbopackIgnore: true */ "./supplierStockSync.mjs"
  );
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
    /* turbopackIgnore: true */ "../../scripts/bloomtech/scrapeSupplierPreview.mjs"
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
    /* turbopackIgnore: true */ "../../scripts/bloomtech/importPreviewToCatalog.mjs"
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

async function executeGrowvaultAnalyzerResync(input: {
  actor?: {
    id?: string | null;
    email?: string | null;
  };
}) {
  if (!hasGrowvaultAnalyzerAdminBridge()) {
    return {
      ok: false,
      stdout: "",
      stderr: `Growvault analyzer bridge is not configured. Target: ${getGrowvaultAnalyzerAdminBridgeTarget() ?? "unconfigured"}`,
      exitCode: 1,
      timedOut: false,
    };
  }

  const bridge = await fetchGrowvaultAnalyzerAdminJson<{
    source: string;
    storefront: string;
    scannedCount: number;
    candidateCount: number;
    repairedCount: number;
    repairedIds: string[];
    alreadyPresentCount: number;
    note?: string;
    error?: string;
  }>(
    "/api/internal/admin/analyzer/publications/backfill",
    "",
    input.actor?.id
      ? {
          method: "POST",
          actor: {
            id: input.actor.id,
            email: input.actor.email ?? null,
          },
        }
      : {
          method: "POST",
        },
  );

  if (!bridge?.ok) {
    return {
      ok: false,
      stdout: "",
      stderr:
        bridge?.payload.error ??
        "Growvault analyzer publication backfill failed through the shared bridge.",
      exitCode: bridge?.status ?? 1,
      timedOut: false,
    };
  }

  const repairedIds =
    bridge.payload.repairedIds.length > 0
      ? bridge.payload.repairedIds.join(", ")
      : "(none)";

  const stdout = [
    `target=${getGrowvaultAnalyzerAdminBridgeTarget() ?? "unknown"}`,
    `scanned=${bridge.payload.scannedCount}`,
    `candidates=${bridge.payload.candidateCount}`,
    `already_present=${bridge.payload.alreadyPresentCount}`,
    `repaired=${bridge.payload.repairedCount}`,
    `repaired_ids=${repairedIds}`,
    bridge.payload.note ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ok: true,
    stdout,
    stderr: "",
    exitCode: 0,
    timedOut: false,
  };
}

export async function runApprovedAdminScriptById(input: {
  scriptId: string;
  inputs?: Record<string, string>;
  actor?: {
    id?: string | null;
    email?: string | null;
  };
}) {
  const definition = getAdminScriptDefinition(input.scriptId);
  if (!definition) {
    throw new Error("Script is not approved for admin execution.");
  }

  const execution = buildAdminScriptExecution(definition, input.inputs ?? {});
  if ("error" in execution) {
    throw new Error(execution.error);
  }

  const result =
    definition.id === "suppliers:sync-stock"
      ? await executeInternalSupplierSync()
      : definition.id === "analyzer:resync-growvault-runs"
        ? await executeGrowvaultAnalyzerResync({
            actor: input.actor,
          })
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
              envOverrides:
                "envOverrides" in execution ? execution.envOverrides : undefined,
            });

  return {
    definition,
    normalizedInputs: execution.normalizedInputs,
    result,
  };
}
