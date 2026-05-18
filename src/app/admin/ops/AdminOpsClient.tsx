"use client";

import { useState } from "react";
import {
  AdminButton,
  AdminEmptyState,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";

type FailedWebhookEvent = {
  id: string;
  eventId: string;
  type: string;
  status: string;
  createdAt: string;
  supportedReplay: boolean;
};

type JobRun = {
  id: string;
  jobType: string;
  status: string;
  triggeredById: string | null;
  triggeredByEmail: string | null;
  summary: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AutomationJob = {
  id: string;
  scheduleId: string | null;
  status: string;
  handler: string;
  payload: Record<string, unknown>;
  dedupeKey: string | null;
  maxAttempts: number;
  attemptCount: number;
  runAfter: string;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  leasedBy: string | null;
  lastError: string | null;
  lastResult: Record<string, unknown> | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdById: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

type AutomationSchedule = {
  id: string;
  key: string;
  label: string;
  handler: string;
  status: string;
  cronExpression: string | null;
  nextRunAt: string | null;
  lastEnqueuedAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  payload: Record<string, unknown> | null;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  automationJobs: AutomationJob[];
  automationSchedules: AutomationSchedule[];
  automationUnavailableReason: string | null;
  failedWebhookEvents: FailedWebhookEvent[];
  jobRuns: JobRun[];
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

export default function AdminOpsClient({
  automationJobs: initialAutomationJobs,
  automationSchedules: initialAutomationSchedules,
  automationUnavailableReason,
  failedWebhookEvents: initialFailedWebhookEvents,
  jobRuns,
}: Props) {
  const [automationJobs, setAutomationJobs] = useState(initialAutomationJobs);
  const [automationSchedules, setAutomationSchedules] = useState(initialAutomationSchedules);
  const [failedWebhookEvents, setFailedWebhookEvents] = useState(initialFailedWebhookEvents);
  const [pendingAutomationAction, setPendingAutomationAction] = useState<string | null>(null);
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const replayWebhook = async (eventId: string) => {
    setReplayingEventId(eventId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/webhooks/stripe/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Webhook replay failed.");
      }

      setFailedWebhookEvents((current) =>
        current.filter((event) => event.eventId !== eventId),
      );
      setNotice(`Reprocessed ${eventId}.`);
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : "Webhook replay failed.");
    } finally {
      setReplayingEventId(null);
    }
  };

  const runAutomationAction = async (
    key: string,
    request: () => Promise<Response>,
    apply: (body: Record<string, unknown>) => void,
  ) => {
    setPendingAutomationAction(key);
    setError("");
    setNotice("");
    try {
      const response = await request();
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        job?: AutomationJob;
        schedule?: AutomationSchedule;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Automation action failed.");
      }
      apply(data as Record<string, unknown>);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Automation action failed.");
    } finally {
      setPendingAutomationAction(null);
    }
  };

  const retryJob = async (jobId: string) => {
    await runAutomationAction(
      `retry:${jobId}`,
      () =>
        fetch(`/api/admin/automation/jobs/${jobId}/retry`, {
          method: "POST",
        }),
      (body) => {
        const job = body.job as AutomationJob | undefined;
        if (!job) return;
        setAutomationJobs((current) =>
          current.map((entry) => (entry.id === job.id ? job : entry)),
        );
        setNotice(`Queued retry for job ${job.id}.`);
      },
    );
  };

  const cancelJob = async (jobId: string) => {
    await runAutomationAction(
      `cancel:${jobId}`,
      () =>
        fetch(`/api/admin/automation/jobs/${jobId}/cancel`, {
          method: "POST",
        }),
      (body) => {
        const job = body.job as AutomationJob | undefined;
        if (!job) return;
        setAutomationJobs((current) =>
          current.map((entry) => (entry.id === job.id ? job : entry)),
        );
        setNotice(`Canceled job ${job.id}.`);
      },
    );
  };

  const toggleSchedule = async (schedule: AutomationSchedule) => {
    const nextStatus = schedule.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    await runAutomationAction(
      `schedule:${schedule.key}`,
      () =>
        fetch("/api/admin/automation/schedules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: schedule.key,
            status: nextStatus,
          }),
        }),
      (body) => {
        const updated = body.schedule as AutomationSchedule | undefined;
        if (!updated) return;
        setAutomationSchedules((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
        setNotice(
          `${updated.label} is now ${updated.status === "PAUSED" ? "paused" : "active"}.`,
        );
      },
    );
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Ops"
        title="Operational control surface"
        description="Monitor failed Stripe webhooks, queue-backed automations, schedules, and recent job history from one place."
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Failed webhooks" value={String(failedWebhookEvents.length)} />
            <AdminMetricCard label="Automation jobs" value={String(automationJobs.length)} />
            <AdminMetricCard
              label="Dead-letter jobs"
              value={String(automationJobs.filter((job) => job.status === "DEAD_LETTER").length)}
            />
            <AdminMetricCard
              label="Paused schedules"
              value={String(automationSchedules.filter((schedule) => schedule.status === "PAUSED").length)}
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}
      {!error && !notice && automationUnavailableReason ? (
        <AdminNotice tone="warning">{automationUnavailableReason}</AdminNotice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="Webhooks"
          title="Failed Stripe events"
          description="Supported event types can be replayed directly through the existing admin reprocess endpoint."
        >
          <div className="space-y-3">
            {failedWebhookEvents.length === 0 ? (
              <AdminEmptyState
                title="No failed webhooks"
                description="The Stripe failure queue is currently clear."
              />
            ) : (
              failedWebhookEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{event.type}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">
                        {event.eventId}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Failed {formatDate(event.createdAt)}
                      </div>
                    </div>
                    {event.supportedReplay ? (
                      <AdminButton
                        onClick={() => replayWebhook(event.eventId)}
                        disabled={replayingEventId === event.eventId}
                      >
                        {replayingEventId === event.eventId ? "Reprocessing..." : "Replay"}
                      </AdminButton>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                        Unsupported replay type
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Automation"
          title="Recent automation jobs"
          description="Lease-based jobs back scripts, cron syncs, pricing runs, diagnostics, and scheduled publishes."
        >
          <div className="space-y-3">
            {automationUnavailableReason ? (
              <AdminEmptyState
                title="Automation tables not migrated"
                description={automationUnavailableReason}
              />
            ) : automationJobs.length === 0 ? (
              <AdminEmptyState
                title="No automation jobs yet"
                description="Queue-backed jobs will appear here after the first run."
              />
            ) : (
              automationJobs.map((job) => {
                const canRetry = job.status === "FAILED" || job.status === "DEAD_LETTER";
                const canCancel = job.status === "QUEUED" || job.status === "LEASED";
                return (
                  <div
                    key={job.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{job.handler}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Status {job.status} · Attempts {job.attemptCount}/{job.maxAttempts}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          Created {formatDate(job.createdAt)} · Run after {formatDate(job.runAfter)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {canRetry ? (
                          <AdminButton
                            onClick={() => retryJob(job.id)}
                            disabled={pendingAutomationAction === `retry:${job.id}`}
                          >
                            {pendingAutomationAction === `retry:${job.id}` ? "Retrying..." : "Retry"}
                          </AdminButton>
                        ) : null}
                        {canCancel ? (
                          <AdminButton
                            onClick={() => cancelJob(job.id)}
                            disabled={pendingAutomationAction === `cancel:${job.id}`}
                          >
                            {pendingAutomationAction === `cancel:${job.id}` ? "Canceling..." : "Cancel"}
                          </AdminButton>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      Triggered by {job.createdByEmail || "system"} · Completed{" "}
                      {formatDate(job.completedAt)}
                    </div>
                    {job.lastError ? (
                      <div className="mt-3 text-sm text-red-200">{job.lastError}</div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </AdminPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="Schedules"
          title="Automation schedules"
          description="Pause noisy workflows, inspect schedule health, and verify which handlers are active."
        >
          <div className="space-y-3">
            {automationUnavailableReason ? (
              <AdminEmptyState
                title="Automation schedules unavailable"
                description={automationUnavailableReason}
              />
            ) : automationSchedules.length === 0 ? (
              <AdminEmptyState
                title="No schedules seeded"
                description="Default automation schedules will appear here after the first load."
              />
            ) : (
              automationSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{schedule.label}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {schedule.handler} · {schedule.cronExpression}
                      </div>
                    </div>
                    <AdminButton
                      onClick={() => toggleSchedule(schedule)}
                      disabled={pendingAutomationAction === `schedule:${schedule.key}`}
                    >
                      {pendingAutomationAction === `schedule:${schedule.key}`
                        ? "Saving..."
                        : schedule.status === "PAUSED"
                          ? "Resume"
                          : "Pause"}
                    </AdminButton>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Status {schedule.status} · Last success {formatDate(schedule.lastSucceededAt)} ·
                    Last failure {formatDate(schedule.lastFailedAt)}
                  </div>
                  {schedule.lastError ? (
                    <div className="mt-3 text-sm text-red-200">{schedule.lastError}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Jobs"
          title="Recent job runs"
          description="Audit history remains separate from the durable queue and records script, report, publish, and automation executions."
        >
          <div className="space-y-3">
            {jobRuns.length === 0 ? (
              <AdminEmptyState
                title="No job runs yet"
                description="Operational job history will appear after scripts, cron deliveries, or landing-page publish actions run."
              />
            ) : (
              jobRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {run.summary || run.jobType}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{run.jobType}</div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>{run.status}</div>
                      <div>{formatDate(run.startedAt)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Triggered by {run.triggeredByEmail || "system"} · Finished{" "}
                    {formatDate(run.finishedAt)}
                  </div>
                  {run.errorMessage ? (
                    <div className="mt-3 text-sm text-red-200">{run.errorMessage}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
