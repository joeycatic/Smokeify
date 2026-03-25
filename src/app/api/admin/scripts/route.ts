import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAuditLog";
import { requireAdmin } from "@/lib/adminCatalog";
import { getAdminScriptDefinition } from "@/lib/adminScripts";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";

export const runtime = "nodejs";

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

function compactOutput(value: string, maxLength = AUDIT_OUTPUT_LIMIT) {
  if (value.length <= maxLength) return value;
  return value.slice(-maxLength);
}

function getScriptCommand(scriptId: string) {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm run ${scriptId}`],
    };
  }

  return {
    command: "npm",
    args: ["run", scriptId],
  };
}

async function executeScript({
  scriptId,
  timeoutMs,
}: {
  scriptId: string;
  timeoutMs: number;
}) {
  return new Promise<{
    ok: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }>((resolve, reject) => {
    const command = getScriptCommand(scriptId);
    const child = spawn(command.command, command.args, {
      cwd: process.cwd(),
      env: process.env,
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
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const appendLine = (target: string[], line: string) => {
    target.push(line);
    let combined = target.join("\n");
    while (combined.length > OUTPUT_LIMIT && target.length > 1) {
      target.shift();
      combined = target.join("\n");
    }
  };

  const { runSupplierSync } = await import("@/lib/supplierStockSync.mjs");
  const result = await runSupplierSync({
    prisma,
    logger: {
      info(message: string) {
        appendLine(stdoutLines, message);
      },
      warn(message: string) {
        appendLine(stderrLines, message);
      },
    },
  });

  return {
    ok: true,
    stdout: stdoutLines.join("\n"),
    stderr: stderrLines.join("\n"),
    exitCode: 0,
    timedOut: result.timedOut,
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

  const body = (await request.json().catch(() => ({}))) as {
    scriptId?: string;
  };
  const scriptId = body.scriptId?.trim();
  if (!scriptId) {
    return NextResponse.json({ error: "Missing script id." }, { status: 400 });
  }

  const definition = getAdminScriptDefinition(scriptId);
  if (!definition) {
    return NextResponse.json({ error: "Script is not approved for admin execution." }, { status: 400 });
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
    },
  });

  try {
    const result =
      definition.id === "suppliers:sync-stock"
        ? await executeInternalSupplierSync()
        : await executeScript({
            scriptId: definition.npmScript,
            timeoutMs: definition.timeoutMs,
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
          stdoutTail: compactOutput(result.stdout),
          stderrTail: compactOutput(result.stderr),
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
        stdoutTail: compactOutput(result.stdout),
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
        error: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    activeRunState.__smokeifyActiveAdminScriptRun = undefined;
  }
}
