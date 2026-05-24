"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AdminButton,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import type { AdminEnvironmentHealth } from "@/lib/adminEnvironmentHealth";

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
  checkoutRecovery: CheckoutRecoveryOverview;
  environmentHealth: AdminEnvironmentHealth;
  failedWebhookEvents: FailedWebhookEvent[];
  jobRuns: JobRun[];
  unresolvedAttributionCount: number;
};

type CheckoutRecoveryStepConfig = {
  stepIndex: number;
  enabled: boolean;
  delayMinutes: number;
  promoCode: string | null;
  promoMessage: string | null;
};

type CheckoutRecoveryOverview = {
  schedule: {
    key: string;
    status: "ACTIVE" | "PAUSED";
    cronExpression: string | null;
    lastSucceededAt: string | null;
    lastFailedAt: string | null;
    lastError: string | null;
    payload: {
      maxSendsPerRun: number;
      segmentation: {
        minCartTotalCents: number;
        customerType: "ANY" | "FIRST_TIME" | "RETURNING";
        storefrontScope: "ALL" | "MAIN" | "GROW";
        guestMode: "ANY" | "GUEST_ONLY" | "LOGGED_IN_ONLY";
      };
      steps: CheckoutRecoveryStepConfig[];
    };
  };
  metrics: {
    totalSessions: number;
    consentedSessions: number;
    activeSessions: number;
    suppressedSessions: number;
    completedSessions: number;
    dueNowCount: number;
    recoveredOrders: number;
    recoveredRevenueCents: number;
    sentAttempts: number;
    skippedAttempts: number;
    failedAttempts: number;
  };
  recentAttempts: Array<{
    id: string;
    sessionId: string;
    customerEmail: string | null;
    stepIndex: number;
    stepLabel: string;
    status: string;
    scheduledFor: string;
    sentAt: string | null;
    skipReason: string | null;
    errorMessage: string | null;
  }>;
  topSkipReasons: Array<{ reason: string; count: number }>;
  dueCandidates: Array<{
    sessionId: string;
    stripeSessionId: string;
    customerEmail: string | null;
    storefront: "MAIN" | "GROW" | null;
    customerType: "FIRST_TIME" | "RETURNING";
    stepIndex: number;
    stepLabel: string;
    scheduledFor: string;
    totalCents: number;
    isGuest: boolean;
  }>;
  sessions: Array<{
    id: string;
    stripeSessionId: string;
    customerEmail: string | null;
    storefront: "MAIN" | "GROW" | null;
    totalCents: number;
    isGuest: boolean;
    state: "active" | "suppressed" | "completed";
    suppressedAt: string | null;
    suppressionReason: string | null;
    completedAt: string | null;
    createdAt: string;
    nextStep: {
      stepIndex: number;
      stepLabel: string;
      scheduledFor: string;
      isDueNow: boolean;
    } | null;
    lastAttempt: {
      stepIndex: number;
      status: string;
      sentAt: string | null;
      scheduledFor: string;
      skipReason: string | null;
      errorMessage: string | null;
    } | null;
  }>;
  sessionPage: number;
  hasMoreSessions: boolean;
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

export default function AdminOpsClient({
  automationJobs: initialAutomationJobs,
  automationSchedules: initialAutomationSchedules,
  automationUnavailableReason,
  checkoutRecovery: initialCheckoutRecovery,
  environmentHealth,
  failedWebhookEvents: initialFailedWebhookEvents,
  jobRuns,
  unresolvedAttributionCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [automationJobs, setAutomationJobs] = useState(initialAutomationJobs);
  const [automationSchedules, setAutomationSchedules] = useState(initialAutomationSchedules);
  const [checkoutRecovery, setCheckoutRecovery] = useState(initialCheckoutRecovery);
  const [failedWebhookEvents, setFailedWebhookEvents] = useState(initialFailedWebhookEvents);
  const [pendingAutomationAction, setPendingAutomationAction] = useState<string | null>(null);
  const [pendingRecoveryAction, setPendingRecoveryAction] = useState<string | null>(null);
  const [suppressionReasons, setSuppressionReasons] = useState<Record<string, string>>({});
  const [replayingEventId, setReplayingEventId] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [testStepIndex, setTestStepIndex] = useState(String(initialCheckoutRecovery.schedule.payload.steps[0]?.stepIndex ?? 1));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recoveryConfig, setRecoveryConfig] = useState(initialCheckoutRecovery.schedule.payload);

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
        if (updated.key === checkoutRecovery.schedule.key) {
          setCheckoutRecovery((current) => ({
            ...current,
            schedule: {
              ...current.schedule,
              status: updated.status as "ACTIVE" | "PAUSED",
            },
          }));
        }
        setNotice(
          `${updated.label} is now ${updated.status === "PAUSED" ? "paused" : "active"}.`,
        );
        router.refresh();
      },
    );
  };

  const runRecoveryAction = async (
    key: string,
    request: () => Promise<Response>,
    apply?: (body: Record<string, unknown>) => void,
  ) => {
    setPendingRecoveryAction(key);
    setError("");
    setNotice("");
    try {
      const response = await request();
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Checkout recovery action failed.");
      }
      apply?.(data);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Checkout recovery action failed.",
      );
    } finally {
      setPendingRecoveryAction(null);
    }
  };

  const previewRecovery = async () => {
    await runRecoveryAction(
      "preview",
      () =>
        fetch("/api/admin/checkout-recovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preview", limit: 10 }),
        }),
      (body) => {
        setCheckoutRecovery((current) => ({
          ...current,
          metrics: {
            ...current.metrics,
            dueNowCount: Number(body.dueCount ?? current.metrics.dueNowCount),
          },
          dueCandidates: Array.isArray(body.candidates)
            ? (body.candidates as CheckoutRecoveryOverview["dueCandidates"])
            : current.dueCandidates,
        }));
        setNotice("Updated checkout recovery preview.");
      },
    );
  };

  const saveRecoveryConfig = async () => {
    await runRecoveryAction(
      "save-config",
      () =>
        fetch("/api/admin/checkout-recovery/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recoveryConfig),
        }),
      (body) => {
        const schedule = body.schedule as
          | { payload?: CheckoutRecoveryOverview["schedule"]["payload"] }
          | undefined;
        if (schedule?.payload) {
          setRecoveryConfig(schedule.payload);
          setCheckoutRecovery((current) => ({
            ...current,
            schedule: {
              ...current.schedule,
              payload: schedule.payload ?? current.schedule.payload,
            },
          }));
        }
        setNotice("Checkout recovery configuration saved.");
        router.refresh();
      },
    );
  };

  const runRecoveryNow = async () => {
    await runRecoveryAction(
      "run-now",
      () =>
        fetch("/api/admin/checkout-recovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "run" }),
        }),
      (body) => {
        const summary =
          body.summary && typeof body.summary === "object"
            ? (body.summary as Record<string, unknown>)
            : {};
        setNotice(
          `Checkout recovery processed ${Number(summary.processed ?? 0)} candidate(s).`,
        );
        router.refresh();
      },
    );
  };

  const sendRecoveryTest = async () => {
    await runRecoveryAction(
      "test-send",
      () =>
        fetch("/api/admin/checkout-recovery/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "test_send",
            recipient: testRecipient,
            stepIndex: Number(testStepIndex),
            storefront:
              checkoutRecovery.schedule.payload.segmentation.storefrontScope === "ALL"
                ? "MAIN"
                : checkoutRecovery.schedule.payload.segmentation.storefrontScope,
            promoCode:
              recoveryConfig.steps.find(
                (step) => String(step.stepIndex) === String(testStepIndex),
              )?.promoCode ?? null,
            promoMessage:
              recoveryConfig.steps.find(
                (step) => String(step.stepIndex) === String(testStepIndex),
              )?.promoMessage ?? null,
          }),
        }),
      () => {
        setNotice("Checkout recovery test email sent.");
      },
    );
  };

  const runRecoverySessionAction = async (
    sessionId: string,
    action: "suppress" | "resume" | "send_now",
  ) => {
    await runRecoveryAction(
      `session:${action}:${sessionId}`,
      () =>
        fetch(`/api/admin/checkout-recovery/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            reason: suppressionReasons[sessionId] ?? "",
          }),
        }),
      () => {
        setNotice(
          action === "suppress"
            ? "Checkout recovery session suppressed."
            : action === "resume"
              ? "Checkout recovery session resumed."
              : "Checkout recovery step sent.",
        );
        router.refresh();
      },
    );
  };

  const linkedRecoverySchedule = automationSchedules.find(
    (schedule) => schedule.key === checkoutRecovery.schedule.key,
  );

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Ops"
        title="Operational control surface"
        description="Monitor failed Stripe webhooks, queue-backed automations, schedules, and recent job history from one place."
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <AdminMetricCard label="Failed webhooks" value={String(failedWebhookEvents.length)} />
            <AdminMetricCard label="Automation jobs" value={String(automationJobs.length)} />
            <AdminMetricCard label="Environment" value={environmentHealth.status} detail="admin readiness" />
            <AdminMetricCard label="Attribution queue" value={String(unresolvedAttributionCount)} detail="storefront fixes" />
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
      {unresolvedAttributionCount > 0 ? (
        <AdminNotice tone="warning">
          {unresolvedAttributionCount} order(s) still need storefront attribution before
          storefront-scoped reporting and newsletters are fully trustworthy. Review them in{" "}
          <Link href="/admin/attribution" className="font-semibold underline underline-offset-2">
            Attribution
          </Link>
          .
        </AdminNotice>
      ) : null}

      <AdminPanel
        eyebrow="Recovery"
        title="Checkout recovery control"
        description="Preview, test, configure, and manually run checkout recovery while the underlying schedule stays paused until ops explicitly resumes it."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <AdminMetricCard
            label="Schedule"
            value={checkoutRecovery.schedule.status}
            detail={checkoutRecovery.schedule.cronExpression ?? "manual"}
          />
          <AdminMetricCard
            label="Due now"
            value={String(checkoutRecovery.metrics.dueNowCount)}
            detail="eligible reminders"
          />
          <AdminMetricCard
            label="Recovered orders"
            value={String(checkoutRecovery.metrics.recoveredOrders)}
            detail="linked orders"
          />
          <AdminMetricCard
            label="Recovered revenue"
            value={formatMoney(checkoutRecovery.metrics.recoveredRevenueCents)}
            detail="linked revenue"
          />
          <AdminMetricCard
            label="Active sessions"
            value={String(checkoutRecovery.metrics.activeSessions)}
            detail="eligible and unsuppressed"
          />
          <AdminMetricCard
            label="Suppressed"
            value={String(checkoutRecovery.metrics.suppressedSessions)}
            detail="held by ops"
          />
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminField label="Minimum cart total (cents)">
                <AdminInput
                  value={String(recoveryConfig.segmentation.minCartTotalCents)}
                  onChange={(event) =>
                    setRecoveryConfig((current) => ({
                      ...current,
                      segmentation: {
                        ...current.segmentation,
                        minCartTotalCents: Math.max(
                          0,
                          Number(event.target.value) || 0,
                        ),
                      },
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Max sends per run">
                <AdminInput
                  value={String(recoveryConfig.maxSendsPerRun)}
                  onChange={(event) =>
                    setRecoveryConfig((current) => ({
                      ...current,
                      maxSendsPerRun: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                />
              </AdminField>
              <AdminField label="Customer type">
                <AdminSelect
                  value={recoveryConfig.segmentation.customerType}
                  onChange={(event) =>
                    setRecoveryConfig((current) => ({
                      ...current,
                      segmentation: {
                        ...current.segmentation,
                        customerType: event.target.value as
                          | "ANY"
                          | "FIRST_TIME"
                          | "RETURNING",
                      },
                    }))
                  }
                >
                  <option value="ANY">Any</option>
                  <option value="FIRST_TIME">First-time only</option>
                  <option value="RETURNING">Returning only</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Storefront scope">
                <AdminSelect
                  value={recoveryConfig.segmentation.storefrontScope}
                  onChange={(event) =>
                    setRecoveryConfig((current) => ({
                      ...current,
                      segmentation: {
                        ...current.segmentation,
                        storefrontScope: event.target.value as "ALL" | "MAIN" | "GROW",
                      },
                    }))
                  }
                >
                  <option value="ALL">All storefronts</option>
                  <option value="MAIN">Smokeify only</option>
                  <option value="GROW">GrowVault only</option>
                </AdminSelect>
              </AdminField>
              <AdminField label="Guest mode">
                <AdminSelect
                  value={recoveryConfig.segmentation.guestMode}
                  onChange={(event) =>
                    setRecoveryConfig((current) => ({
                      ...current,
                      segmentation: {
                        ...current.segmentation,
                        guestMode: event.target.value as
                          | "ANY"
                          | "GUEST_ONLY"
                          | "LOGGED_IN_ONLY",
                      },
                    }))
                  }
                >
                  <option value="ANY">Guest + logged-in</option>
                  <option value="GUEST_ONLY">Guest only</option>
                  <option value="LOGGED_IN_ONLY">Logged-in only</option>
                </AdminSelect>
              </AdminField>
            </div>

            <div className="space-y-4">
              {recoveryConfig.steps.map((step, index) => (
                <div
                  key={step.stepIndex}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">
                      Reminder {step.stepIndex}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={step.enabled}
                        onChange={(event) =>
                          setRecoveryConfig((current) => {
                            const nextSteps = [...current.steps];
                            nextSteps[index] = {
                              ...nextSteps[index],
                              enabled: event.target.checked,
                            };
                            return {
                              ...current,
                              steps: nextSteps,
                            };
                          })
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <AdminField label="Delay (minutes)">
                      <AdminInput
                        value={String(step.delayMinutes)}
                        onChange={(event) =>
                          setRecoveryConfig((current) => {
                            const nextSteps = [...current.steps];
                            nextSteps[index] = {
                              ...nextSteps[index],
                              delayMinutes: Math.max(1, Number(event.target.value) || 1),
                            };
                            return {
                              ...current,
                              steps: nextSteps,
                            };
                          })
                        }
                      />
                    </AdminField>
                    <AdminField label="Promo code" optional="optional">
                      <AdminInput
                        value={step.promoCode ?? ""}
                        onChange={(event) =>
                          setRecoveryConfig((current) => {
                            const nextSteps = [...current.steps];
                            nextSteps[index] = {
                              ...nextSteps[index],
                              promoCode: event.target.value.trim() || null,
                            };
                            return {
                              ...current,
                              steps: nextSteps,
                            };
                          })
                        }
                      />
                    </AdminField>
                  </div>
                  <div className="mt-4">
                    <AdminField label="Promo message" optional="optional">
                      <AdminTextarea
                        rows={3}
                        value={step.promoMessage ?? ""}
                        onChange={(event) =>
                          setRecoveryConfig((current) => {
                            const nextSteps = [...current.steps];
                            nextSteps[index] = {
                              ...nextSteps[index],
                              promoMessage: event.target.value.trim() || null,
                            };
                            return {
                              ...current,
                              steps: nextSteps,
                            };
                          })
                        }
                      />
                    </AdminField>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <AdminButton
                onClick={() => void saveRecoveryConfig()}
                disabled={pendingRecoveryAction === "save-config"}
              >
                {pendingRecoveryAction === "save-config" ? "Saving..." : "Save config"}
              </AdminButton>
              <AdminButton
                tone="secondary"
                onClick={() => linkedRecoverySchedule && void toggleSchedule(linkedRecoverySchedule)}
                disabled={
                  !linkedRecoverySchedule ||
                  pendingAutomationAction === `schedule:${checkoutRecovery.schedule.key}`
                }
              >
                {pendingAutomationAction === `schedule:${checkoutRecovery.schedule.key}`
                  ? "Saving..."
                  : checkoutRecovery.schedule.status === "PAUSED"
                    ? "Resume schedule"
                    : "Pause schedule"}
              </AdminButton>
              <AdminButton
                tone="secondary"
                onClick={() => void previewRecovery()}
                disabled={pendingRecoveryAction === "preview"}
              >
                {pendingRecoveryAction === "preview" ? "Refreshing..." : "Preview due reminders"}
              </AdminButton>
              <AdminButton
                tone="secondary"
                onClick={() => void runRecoveryNow()}
                disabled={pendingRecoveryAction === "run-now"}
              >
                {pendingRecoveryAction === "run-now" ? "Running..." : "Run now"}
              </AdminButton>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Test send</div>
              <div className="mt-4 grid gap-4">
                <AdminField label="Recipient">
                  <AdminInput
                    value={testRecipient}
                    onChange={(event) => setTestRecipient(event.target.value)}
                    placeholder="ops@example.com"
                  />
                </AdminField>
                <AdminField label="Step">
                  <AdminSelect
                    value={testStepIndex}
                    onChange={(event) => setTestStepIndex(event.target.value)}
                  >
                    {recoveryConfig.steps.map((step) => (
                      <option key={step.stepIndex} value={String(step.stepIndex)}>
                        Reminder {step.stepIndex}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
                <AdminButton
                  onClick={() => void sendRecoveryTest()}
                  disabled={pendingRecoveryAction === "test-send" || !testRecipient.trim()}
                >
                  {pendingRecoveryAction === "test-send" ? "Sending..." : "Send test email"}
                </AdminButton>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Recovery sessions</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Active, suppressed, and completed sessions with direct ops controls.
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Page {checkoutRecovery.sessionPage}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {checkoutRecovery.sessions.length === 0 ? (
                  <div className="text-sm text-slate-400">No recovery sessions found.</div>
                ) : (
                  checkoutRecovery.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {session.customerEmail || "No email"} · {formatMoney(session.totalCents)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {session.storefront || "Unknown storefront"} ·{" "}
                            {session.isGuest ? "Guest" : "Logged in"} · created{" "}
                            {formatDate(session.createdAt)}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            State {session.state}
                            {session.suppressionReason
                              ? ` · ${session.suppressionReason}`
                              : session.completedAt
                                ? ` · completed ${formatDate(session.completedAt)}`
                                : ""}
                          </div>
                          {session.nextStep ? (
                            <div className="mt-2 text-xs text-cyan-200">
                              Next {session.nextStep.stepLabel} ·{" "}
                              {session.nextStep.isDueNow
                                ? "due now"
                                : `scheduled ${formatDate(session.nextStep.scheduledFor)}`}
                            </div>
                          ) : null}
                          {session.lastAttempt ? (
                            <div className="mt-2 text-xs text-slate-400">
                              Last attempt {session.lastAttempt.stepIndex} · {session.lastAttempt.status}
                              {session.lastAttempt.skipReason || session.lastAttempt.errorMessage
                                ? ` · ${session.lastAttempt.skipReason || session.lastAttempt.errorMessage}`
                                : ""}
                            </div>
                          ) : null}
                        </div>
                        <div className="w-full max-w-sm space-y-2">
                          {session.state === "active" ? (
                            <>
                              <AdminField label="Suppress reason">
                                <AdminInput
                                  value={suppressionReasons[session.id] ?? ""}
                                  onChange={(event) =>
                                    setSuppressionReasons((current) => ({
                                      ...current,
                                      [session.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Hold this session and explain why"
                                />
                              </AdminField>
                              <div className="flex flex-wrap gap-2">
                                <AdminButton
                                  tone="secondary"
                                  disabled={
                                    pendingRecoveryAction === `session:send_now:${session.id}` ||
                                    !session.nextStep
                                  }
                                  onClick={() => void runRecoverySessionAction(session.id, "send_now")}
                                >
                                  {pendingRecoveryAction === `session:send_now:${session.id}`
                                    ? "Sending..."
                                    : "Send now"}
                                </AdminButton>
                                <AdminButton
                                  tone="danger"
                                  disabled={
                                    pendingRecoveryAction === `session:suppress:${session.id}` ||
                                    !(suppressionReasons[session.id] ?? "").trim()
                                  }
                                  onClick={() => void runRecoverySessionAction(session.id, "suppress")}
                                >
                                  {pendingRecoveryAction === `session:suppress:${session.id}`
                                    ? "Saving..."
                                    : "Suppress"}
                                </AdminButton>
                              </div>
                            </>
                          ) : session.state === "suppressed" ? (
                            <div className="flex flex-wrap gap-2">
                              <AdminButton
                                tone="secondary"
                                disabled={pendingRecoveryAction === `session:resume:${session.id}`}
                                onClick={() => void runRecoverySessionAction(session.id, "resume")}
                              >
                                {pendingRecoveryAction === `session:resume:${session.id}`
                                  ? "Resuming..."
                                  : "Resume"}
                              </AdminButton>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Completed sessions: {checkoutRecovery.metrics.completedSessions}
                </div>
                <div className="flex gap-2">
                  {checkoutRecovery.sessionPage > 1 ? (
                    <Link
                      href={`${pathname}?recoveryPage=${checkoutRecovery.sessionPage - 1}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  {checkoutRecovery.hasMoreSessions ? (
                    <Link
                      href={`${pathname}?recoveryPage=${checkoutRecovery.sessionPage + 1}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
                    >
                      Next
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Due candidates</div>
              <div className="mt-3 space-y-3">
                {checkoutRecovery.dueCandidates.length === 0 ? (
                  <div className="text-sm text-slate-400">No due reminders right now.</div>
                ) : (
                  checkoutRecovery.dueCandidates.map((candidate) => (
                    <div
                      key={`${candidate.sessionId}-${candidate.stepIndex}`}
                      className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-white">
                        {candidate.stepLabel} · {formatMoney(candidate.totalCents)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {candidate.customerEmail || "No email"} · {candidate.customerType} ·{" "}
                        {candidate.storefront || "Unknown storefront"} · due {formatDate(candidate.scheduledFor)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Recent attempt outcomes</div>
              <div className="mt-3 space-y-3">
                {checkoutRecovery.recentAttempts.slice(0, 6).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-white">
                      {attempt.stepLabel} · {attempt.status}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {attempt.customerEmail || "No email"} · scheduled {formatDate(attempt.scheduledFor)}
                    </div>
                    {attempt.skipReason || attempt.errorMessage ? (
                      <div className="mt-2 text-xs text-amber-200">
                        {attempt.skipReason || attempt.errorMessage}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Top skip/failure reasons</div>
              <div className="mt-3 space-y-2">
                {checkoutRecovery.topSkipReasons.length === 0 ? (
                  <div className="text-sm text-slate-400">No skip or failure reasons recorded yet.</div>
                ) : (
                  checkoutRecovery.topSkipReasons.map((reason) => (
                    <div
                      key={reason.reason}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3 text-sm"
                    >
                      <span className="text-slate-300">{reason.reason}</span>
                      <span className="font-semibold text-white">{reason.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        eyebrow="Preflight"
        title="Admin environment health"
        description="Migration-backed subsystems are checked here before deeper workflows rely on them."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {environmentHealth.subsystems.map((subsystem) => (
            <div
              key={subsystem.key}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {subsystem.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {subsystem.ready ? "Ready" : "Blocked"}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {subsystem.message ?? "Healthy"}
              </div>
            </div>
          ))}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Last successful automation
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {formatDate(environmentHealth.lastSuccessfulAutomationRunAt)}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              Last migration block {formatDate(environmentHealth.lastMigrationBlockAt)}
            </div>
          </div>
        </div>
      </AdminPanel>

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
