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

type Props = {
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
  failedWebhookEvents: initialFailedWebhookEvents,
  jobRuns,
}: Props) {
  const [failedWebhookEvents, setFailedWebhookEvents] = useState(initialFailedWebhookEvents);
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

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Ops"
        title="Operational control surface"
        description="Monitor failed Stripe webhooks, recent script/report/publish jobs, and replay supported failures from one place."
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Failed webhooks" value={String(failedWebhookEvents.length)} />
            <AdminMetricCard label="Job runs" value={String(jobRuns.length)} />
            <AdminMetricCard
              label="Failed jobs"
              value={String(jobRuns.filter((run) => run.status === "FAILED").length)}
            />
            <AdminMetricCard
              label="Running jobs"
              value={String(jobRuns.filter((run) => run.status === "RUNNING").length)}
            />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

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
          eyebrow="Jobs"
          title="Recent job runs"
          description="Scripts, report deliveries, and landing-page publish/schedule actions are recorded here."
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
