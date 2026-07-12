"use client";

import { useMemo, useState } from "react";
import type { AdminScriptCategory, AdminScriptDefinition } from "@/lib/adminScripts";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import { AdminPage, AdminPrimaryGrid } from "@/components/admin/ui";

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

const CATEGORY_ORDER: readonly AdminScriptCategory[] = [
  "Suppliers",
  "Catalog",
  "Orders",
  "Operations",
];

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
  const [scriptInputs, setScriptInputs] = useState<Record<string, Record<string, string>>>({});
  const [scriptReasons, setScriptReasons] = useState<Record<string, string>>({});

  const groupedScripts = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: scripts.filter((script) => script.category === category),
    })).filter((group) => group.items.length > 0);
  }, [scripts]);

  const readonlyCount = scripts.filter((script) => script.riskLevel === "read-only").length;
  const writeCount = scripts.length - readonlyCount;

  const updateScriptInput = (scriptId: string, inputId: string, value: string) => {
    setScriptInputs((current) => ({
      ...current,
      [scriptId]: {
        ...(current[scriptId] ?? {}),
        [inputId]: value,
      },
    }));
  };

  const getScriptInputValue = (scriptId: string, inputId: string) =>
    scriptInputs[scriptId]?.[inputId] ?? "";

  const updateScriptReason = (scriptId: string, value: string) => {
    setScriptReasons((current) => ({
      ...current,
      [scriptId]: value,
    }));
  };

  const getScriptReason = (scriptId: string) => scriptReasons[scriptId] ?? "";

  const runScript = async (script: AdminScriptDefinition) => {
    const reason = getScriptReason(script.id).trim();
    if (!reason) {
      setRequestError("Add a short execution reason before running an admin script.");
      return;
    }
    setRunningScriptId(script.id);
    setRequestError("");

    try {
      const response = await fetch("/api/admin/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: script.id,
          inputs: scriptInputs[script.id] ?? {},
          reason,
        }),
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
    <AdminPage layout="console">
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

      <AdminPrimaryGrid rail="balanced">
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
                      ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                      : hasLastRun && lastRun.status === "error"
                      ? "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]"
                      : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]";

                  return (
                    <div
                      key={script.id}
                      className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-[var(--adm-text)]">{script.title}</h3>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                script.riskLevel === "read-only"
                                  ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                                  : "border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
                              }`}
                            >
                              {script.riskLevel === "read-only" ? "Read-only" : "Writes data"}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                script.dryRunByDefault
                                  ? "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]"
                                  : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
                              }`}
                            >
                              {script.dryRunByDefault ? "Dry-run first" : "Direct apply"}
                            </span>
                          </div>
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

                      <div className="mt-4 grid gap-3 xl:grid-cols-3">
                        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                            What it does
                          </div>
                          <div className="mt-2 text-sm text-[var(--adm-text)]">{script.description}</div>
                        </div>
                        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                            Input
                          </div>
                          <div className="mt-2 text-sm text-[var(--adm-text)]">{script.inputSummary}</div>
                        </div>
                        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                            Output
                          </div>
                          <div className="mt-2 text-sm text-[var(--adm-text)]">{script.outputSummary}</div>
                        </div>
                      </div>

                      {script.inputs?.length ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {script.inputs.map((input) => (
                            <div
                              key={input.id}
                              className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3"
                            >
                              <AdminField label={input.label} optional="Optional">
                                <AdminInput
                                  type={input.kind === "url" ? "url" : "text"}
                                  value={getScriptInputValue(script.id, input.id)}
                                  onChange={(event) =>
                                    updateScriptInput(script.id, input.id, event.target.value)
                                  }
                                  placeholder={input.placeholder}
                                  disabled={Boolean(runningScriptId)}
                                />
                              </AdminField>
                              <p className="mt-2 text-xs text-[var(--adm-text-faint)]">{input.description}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                        <AdminField label="Execution reason">
                          <AdminTextarea
                            value={getScriptReason(script.id)}
                            onChange={(event) => updateScriptReason(script.id, event.target.value)}
                            placeholder="Why is this run needed right now?"
                            rows={3}
                            disabled={Boolean(runningScriptId)}
                          />
                        </AdminField>
                        <p className="mt-2 text-xs text-[var(--adm-text-faint)]">
                          Required for auditability before the script can run.
                        </p>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                            Command
                          </div>
                          <div className="mt-2 text-sm text-[var(--adm-text)]">npm run {script.npmScript}</div>
                        </div>
                        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                            Expected time
                          </div>
                          <div className="mt-2 text-sm text-[var(--adm-text)]">{script.expectedDuration}</div>
                        </div>
                        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                            Impact
                          </div>
                          <div className="mt-2 text-sm text-[var(--adm-text)]">{script.impact}</div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3 text-sm text-[var(--adm-text-muted)]">
                        {script.safetyNote}
                      </div>

                      {hasLastRun ? (
                        <div className="mt-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                                Last result
                              </div>
                              <div className="mt-2 text-sm text-[var(--adm-text)]">{lastRun.message}</div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-[var(--adm-text-muted)]">
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
                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                        Script
                      </div>
                      <div className="mt-2 text-sm font-semibold text-[var(--adm-text)]">{lastRun.title}</div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                        lastRun.status === "success"
                          ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                          : "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]"
                      }`}
                    >
                      {lastRun.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                        Duration
                      </div>
                      <div className="mt-2 text-sm text-[var(--adm-text)]">{formatDuration(lastRun.durationMs)}</div>
                    </div>
                    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                        Exit code
                      </div>
                      <div className="mt-2 text-sm text-[var(--adm-text)]">{lastRun.exitCode ?? "n/a"}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                      Stdout
                    </div>
                    <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-[var(--adm-text-muted)]">
                      {lastRun.stdout || "No stdout returned."}
                    </pre>
                  </div>
                  <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                      Stderr
                    </div>
                    <pre className="mt-3 max-h-[18rem] overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-[var(--adm-text-muted)]">
                      {lastRun.stderr || "No stderr returned."}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] px-5 py-10 text-center text-sm text-[var(--adm-text-faint)]">
                Trigger a script to review its latest captured output here.
              </div>
            )}
          </AdminPanel>

          <AdminPanel
            eyebrow="Rules"
            title="Execution guardrails"
            description="This page is intentionally constrained to reduce operational risk."
          >
            <div className="space-y-3 text-sm text-[var(--adm-text-muted)]">
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
                Only approved npm scripts are exposed. There is no arbitrary command entry point.
              </div>
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
                Runs are executed one at a time and rejected if another script is already active.
              </div>
              <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
                Every trigger is logged to the audit log with outcome metadata for later review.
              </div>
            </div>
          </AdminPanel>
        </div>
      </AdminPrimaryGrid>
    </AdminPage>
  );
}
