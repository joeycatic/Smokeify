"use client";

import { useMemo, useState } from "react";
import type { AdminScriptCategory, AdminScriptDefinition } from "@/lib/adminScripts";
import {
  AdminButton,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";

type AdminScriptsClientProps = {
  scripts: readonly AdminScriptDefinition[];
};

type RunState = {
  scriptId: string;
  title: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  status: "success" | "error";
  message: string;
};

const CATEGORY_ORDER: readonly AdminScriptCategory[] = ["Suppliers", "Catalog", "Orders"];

const formatDuration = (durationMs: number) => {
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

export default function AdminScriptsClient({ scripts }: AdminScriptsClientProps) {
  const [runningScriptId, setRunningScriptId] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunState | null>(null);
  const [requestError, setRequestError] = useState<string>("");

  const groupedScripts = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: scripts.filter((script) => script.category === category),
    })).filter((group) => group.items.length > 0);
  }, [scripts]);

  const readonlyCount = scripts.filter((script) => script.riskLevel === "read-only").length;
  const writeCount = scripts.length - readonlyCount;

  const runScript = async (script: AdminScriptDefinition) => {
    setRunningScriptId(script.id);
    setRequestError("");

    try {
      const response = await fetch("/api/admin/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId: script.id }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        scriptId?: string;
        title?: string;
        durationMs?: number;
        exitCode?: number | null;
        stdout?: string;
        stderr?: string;
      };

      if (!response.ok) {
        const message = data.error ?? "Script run failed.";
        setRequestError(message);
        setLastRun({
          scriptId: script.id,
          title: data.title ?? script.title,
          durationMs: data.durationMs ?? 0,
          exitCode: data.exitCode ?? null,
          stdout: data.stdout ?? "",
          stderr: data.stderr ?? "",
          status: "error",
          message,
        });
        return;
      }

      setLastRun({
        scriptId: data.scriptId ?? script.id,
        title: data.title ?? script.title,
        durationMs: data.durationMs ?? 0,
        exitCode: data.exitCode ?? null,
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        status: "success",
        message: `${script.title} completed successfully.`,
      });
    } catch {
      const message = "Script run failed before the server responded.";
      setRequestError(message);
      setLastRun({
        scriptId: script.id,
        title: script.title,
        durationMs: 0,
        exitCode: null,
        stdout: "",
        stderr: "",
        status: "error",
        message,
      });
    } finally {
      setRunningScriptId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Scripts"
        title="Manual operations console"
        description="Run approved maintenance and sync scripts from a single admin workspace. Only whitelisted npm scripts are available here, runs are executed one at a time, and every trigger is written to the audit log."
        metrics={
          <div className="grid gap-3 md:grid-cols-4">
            <AdminMetricCard label="Approved scripts" value={String(scripts.length)} detail="Whitelisted for admin use" />
            <AdminMetricCard label="Read-only" value={String(readonlyCount)} detail="Preview and diagnostic runs" />
            <AdminMetricCard label="Write scripts" value={String(writeCount)} detail="Directly mutate data" />
            <AdminMetricCard
              label="Execution mode"
              value={runningScriptId ? "Busy" : "Ready"}
              detail={runningScriptId ? "A script run is in progress" : "Manual, one at a time"}
            />
          </div>
        }
      />

      {requestError ? <AdminNotice tone="error">{requestError}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          {groupedScripts.map((group) => (
            <AdminPanel
              key={group.category}
              eyebrow="Approved scripts"
              title={group.category}
              description="Curated operational scripts exposed to the admin panel."
            >
              <div className="space-y-3">
                {group.items.map((script) => {
                  const isRunning = runningScriptId === script.id;
                  const hasLastRun = lastRun?.scriptId === script.id;
                  const lastRunBadgeClass =
                    hasLastRun && lastRun.status === "success"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : hasLastRun && lastRun.status === "error"
                      ? "border-red-400/20 bg-red-400/10 text-red-200"
                      : "border-white/10 bg-white/[0.04] text-slate-400";

                  return (
                    <div
                      key={script.id}
                      className="rounded-[24px] border border-white/10 bg-[#070a0f] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-white">{script.title}</h3>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                script.riskLevel === "read-only"
                                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                  : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                              }`}
                            >
                              {script.riskLevel === "read-only" ? "Read-only" : "Writes data"}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                script.dryRunByDefault
                                  ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                                  : "border-white/10 bg-white/[0.04] text-slate-300"
                              }`}
                            >
                              {script.dryRunByDefault ? "Dry-run first" : "Direct apply"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-400">{script.description}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${lastRunBadgeClass}`}
                          >
                            {isRunning
                              ? "Running"
                              : hasLastRun
                              ? lastRun?.status === "success"
                                ? "Last run ok"
                                : "Last run failed"
                              : "Not run"}
                          </span>
                          <AdminButton
                            onClick={() => void runScript(script)}
                            disabled={Boolean(runningScriptId)}
                          >
                            {isRunning ? "Running..." : "Run script"}
                          </AdminButton>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Command
                          </div>
                          <div className="mt-2 text-sm text-slate-200">npm run {script.npmScript}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Expected time
                          </div>
                          <div className="mt-2 text-sm text-slate-200">{script.expectedDuration}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Impact
                          </div>
                          <div className="mt-2 text-sm text-slate-200">{script.impact}</div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-400">
                        {script.safetyNote}
                      </div>

                      {hasLastRun ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                                Last result
                              </div>
                              <div className="mt-2 text-sm text-slate-200">{lastRun.message}</div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                              <span>Duration: {formatDuration(lastRun.durationMs)}</span>
                              <span>Exit code: {lastRun.exitCode ?? "n/a"}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </AdminPanel>
          ))}
        </div>

        <div className="space-y-6">
          <AdminPanel
            eyebrow="Execution"
            title="Latest captured output"
            description="The most recent stdout and stderr tail returned by the admin script runner."
          >
            {lastRun ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Script
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">{lastRun.title}</div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                        lastRun.status === "success"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : "border-red-400/20 bg-red-400/10 text-red-200"
                      }`}
                    >
                      {lastRun.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Duration
                      </div>
                      <div className="mt-2 text-sm text-slate-200">{formatDuration(lastRun.durationMs)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Exit code
                      </div>
                      <div className="mt-2 text-sm text-slate-200">{lastRun.exitCode ?? "n/a"}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Stdout
                    </div>
                    <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-300">
                      {lastRun.stdout || "No stdout returned."}
                    </pre>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#070a0f] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Stderr
                    </div>
                    <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-slate-300">
                      {lastRun.stderr || "No stderr returned."}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center text-sm text-slate-500">
                Trigger a script to review its latest captured output here.
              </div>
            )}
          </AdminPanel>

          <AdminPanel
            eyebrow="Rules"
            title="Execution guardrails"
            description="This page is intentionally constrained to reduce operational risk."
          >
            <div className="space-y-3 text-sm text-slate-400">
              <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3">
                Only approved npm scripts are exposed. There is no arbitrary command entry point.
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3">
                Runs are executed one at a time and rejected if another script is already active.
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3">
                Every trigger is logged to the audit log with outcome metadata for later review.
              </div>
            </div>
          </AdminPanel>
        </div>
      </div>
    </div>
  );
}
