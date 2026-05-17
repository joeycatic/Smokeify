import { adminJson } from "@/lib/adminApi";
import { logAdminAction } from "@/lib/adminAuditLog";
import { withAdminRoute } from "@/lib/adminRoute";
import { getAdminScriptDefinition } from "@/lib/adminScripts";
import {
  buildAdminScriptExecution,
  normalizeAdminScriptInputs,
} from "@/lib/adminScriptInputs";
import { startAdminJobRun } from "@/lib/adminJobRuns";
import { runAutomationJobNow } from "@/lib/automationQueue";

export const runtime = "nodejs";
export const maxDuration = 600;

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

function buildInputMetadata(inputs: Record<string, string>) {
  return Object.keys(inputs).length > 0 ? { inputs } : {};
}

export const POST = withAdminRoute(
  async ({ request, session }) => {
    const body = (await request.json().catch(() => ({}))) as {
      scriptId?: string;
      inputs?: Record<string, unknown>;
      reason?: string;
    };
    const scriptId = body.scriptId?.trim();
    if (!scriptId) {
      return adminJson({ error: "Missing script id." }, { status: 400 });
    }

    const definition = getAdminScriptDefinition(scriptId);
    if (!definition) {
      return adminJson(
        { error: "Script is not approved for admin execution." },
        { status: 400 },
      );
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return adminJson(
        { error: "A short execution reason is required before running admin scripts." },
        { status: 400 },
      );
    }

    const requestedInputs = normalizeAdminScriptInputs(body.inputs);
    const execution = buildAdminScriptExecution(definition, requestedInputs);
    if ("error" in execution) {
      return adminJson({ error: execution.error }, { status: 400 });
    }

    const activeRunState = getActiveRunState();
    if (activeRunState.__smokeifyActiveAdminScriptRun) {
      const activeRun = activeRunState.__smokeifyActiveAdminScriptRun;
      return adminJson(
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

    await startAdminJobRun({
      jobType: "admin_script_requested",
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
      action: "admin.script.run.requested",
      targetType: "script",
      targetId: definition.id,
      summary: `Queued ${definition.title}`,
      metadata: {
        scriptId: definition.id,
        npmScript: definition.npmScript,
        riskLevel: definition.riskLevel,
        reason,
        ...buildInputMetadata(execution.normalizedInputs),
      },
    });

    try {
      const automation = await runAutomationJobNow({
        handler: "admin.script.run",
        dedupeKey: `admin-script::${definition.id}`,
        payload: {
          scriptId: definition.id,
          reason,
          inputs: execution.normalizedInputs,
        },
        actor: {
          id: session.user.id,
          email: session.user.email ?? null,
        },
        workerId: `admin-script-${session.user.id}`,
      });

      if (!automation.result) {
        return adminJson(
          {
            error: automation.error ?? "Automation job did not return a script result.",
            job: automation.job,
          },
          { status: 500 },
        );
      }

      const data = (automation.result.data ?? {}) as Record<string, unknown>;
      return adminJson({
        ok: true,
        job: automation.job,
        scriptId: definition.id,
        title: definition.title,
        stdout: typeof data.stdout === "string" ? data.stdout : "",
        stderr: typeof data.stderr === "string" ? data.stderr : "",
        exitCode: typeof data.exitCode === "number" ? data.exitCode : null,
        timedOut: data.timedOut === true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Script execution failed unexpectedly.";
      await logAdminAction({
        actor: { id: session.user.id, email: session.user.email ?? null },
        action: "admin.script.run.failed",
        targetType: "script",
        targetId: definition.id,
        summary: `${definition.title} could not run`,
        metadata: {
          scriptId: definition.id,
          npmScript: definition.npmScript,
          reason,
          ...buildInputMetadata(execution.normalizedInputs),
          error: message,
        },
      });
      return adminJson({ error: message }, { status: 500 });
    } finally {
      activeRunState.__smokeifyActiveAdminScriptRun = undefined;
    }
  },
  {
    action: "admin.script.execute",
    rateLimit: {
      keyPrefix: "admin-scripts",
      limit: 12,
      windowMs: 10 * 60 * 1000,
      message: "Too many script triggers. Please wait and try again.",
    },
  },
);
