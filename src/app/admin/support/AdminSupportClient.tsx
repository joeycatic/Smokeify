"use client";

import { useMemo, useState } from "react";
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

type SupportCase = {
  id: string;
  linkedOrderId: string | null;
  linkedCustomerId: string | null;
  returnRequestId: string | null;
  contactSubmissionId: string | null;
  sourceType: "RETURN_REQUEST" | "CONTACT_SUBMISSION" | "MANUAL";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  createdById: string | null;
  createdByEmail: string | null;
  summary: string;
  resolutionNote: string | null;
  latestCustomerEventAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  linkedOrder: {
    id: string;
    orderNumber: number;
    customerEmail: string | null;
    shippingName: string | null;
  } | null;
  linkedCustomer: {
    id: string;
    email: string | null;
    label: string;
  } | null;
  returnRequest: {
    id: string;
    status: string;
    requestedResolution: string;
  } | null;
  contactSubmission: {
    id: string;
    name: string;
    email: string;
    message: string;
    createdAt: string;
    processedAt: string | null;
  } | null;
  events: Array<{
    id: string;
    actorId: string | null;
    actorEmail: string | null;
    eventType: string;
    summary: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

type SupportOwner = {
  id: string;
  email: string | null;
  name: string;
  role: string;
};

type Props = {
  supportCases: SupportCase[];
  owners: SupportOwner[];
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const STATUS_OPTIONS: SupportCase["status"][] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
];
const PRIORITY_OPTIONS: SupportCase["priority"][] = ["LOW", "MEDIUM", "HIGH"];

export default function AdminSupportClient({ supportCases: initialCases, owners }: Props) {
  const [supportCases, setSupportCases] = useState(initialCases);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCases[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupportCase["status"] | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<SupportCase["priority"] | "ALL">("ALL");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newCase, setNewCase] = useState({
    linkedOrderId: "",
    linkedCustomerId: "",
    priority: "MEDIUM" as SupportCase["priority"],
    summary: "",
    note: "",
  });
  const [caseNoteDraft, setCaseNoteDraft] = useState("");

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return supportCases.filter((supportCase) => {
      if (statusFilter !== "ALL" && supportCase.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && supportCase.priority !== priorityFilter) return false;
      if (!normalized) return true;
      return [
        supportCase.summary,
        supportCase.assigneeEmail ?? "",
        supportCase.linkedOrder?.orderNumber ?? "",
        supportCase.linkedCustomer?.email ?? "",
        supportCase.contactSubmission?.email ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [priorityFilter, query, statusFilter, supportCases]);

  const selectedCase =
    filteredCases.find((supportCase) => supportCase.id === selectedCaseId) ??
    supportCases.find((supportCase) => supportCase.id === selectedCaseId) ??
    filteredCases[0] ??
    null;

  const openCount = supportCases.filter((supportCase) => supportCase.status !== "RESOLVED").length;
  const waitingCustomerCount = supportCases.filter(
    (supportCase) => supportCase.status === "WAITING_CUSTOMER",
  ).length;
  const highPriorityCount = supportCases.filter(
    (supportCase) => supportCase.priority === "HIGH",
  ).length;

  const patchSupportCase = async (
    supportCaseId: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    setSavingId(supportCaseId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/support-cases/${supportCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        supportCase?: SupportCase;
      };
      if (!response.ok || !data.supportCase) {
        throw new Error(data.error ?? "Failed to update support case.");
      }
      setSupportCases((current) =>
        current.map((supportCase) =>
          supportCase.id === supportCaseId ? data.supportCase! : supportCase,
        ),
      );
      setNotice(successMessage);
      setCaseNoteDraft("");
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Failed to update support case.");
    } finally {
      setSavingId(null);
    }
  };

  const createSupportCase = async () => {
    setSavingId("new");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/support-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedOrderId: newCase.linkedOrderId.trim() || null,
          linkedCustomerId: newCase.linkedCustomerId.trim() || null,
          priority: newCase.priority,
          summary: newCase.summary,
          note: newCase.note,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        supportCase?: SupportCase;
      };
      if (!response.ok || !data.supportCase) {
        throw new Error(data.error ?? "Failed to create support case.");
      }
      setSupportCases((current) => [data.supportCase!, ...current]);
      setSelectedCaseId(data.supportCase.id);
      setNewCase({
        linkedOrderId: "",
        linkedCustomerId: "",
        priority: "MEDIUM",
        summary: "",
        note: "",
      });
      setNotice("Support case created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create support case.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Support"
        title="Support inbox"
        description="Track return-linked, contact-form, and manual support cases in one operational queue."
        metrics={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Total cases" value={String(supportCases.length)} />
            <AdminMetricCard label="Open cases" value={String(openCount)} />
            <AdminMetricCard label="Waiting customer" value={String(waitingCustomerCount)} />
            <AdminMetricCard label="High priority" value={String(highPriorityCount)} />
          </div>
        }
      />

      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
      {!error && notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <AdminPanel
          eyebrow="Create"
          title="Manual support case"
          description="Use this when work starts outside returns or contact submissions."
          actions={
            <AdminButton onClick={createSupportCase} disabled={savingId === "new"}>
              {savingId === "new" ? "Creating..." : "Create case"}
            </AdminButton>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="Summary">
              <AdminInput
                value={newCase.summary}
                onChange={(event) =>
                  setNewCase((current) => ({ ...current, summary: event.target.value }))
                }
                placeholder="Short support summary"
              />
            </AdminField>
            <AdminField label="Priority">
              <AdminSelect
                value={newCase.priority}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    priority: event.target.value as SupportCase["priority"],
                  }))
                }
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminField label="Linked order id" optional="optional">
              <AdminInput
                value={newCase.linkedOrderId}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    linkedOrderId: event.target.value,
                  }))
                }
              />
            </AdminField>
            <AdminField label="Linked customer id" optional="optional">
              <AdminInput
                value={newCase.linkedCustomerId}
                onChange={(event) =>
                  setNewCase((current) => ({
                    ...current,
                    linkedCustomerId: event.target.value,
                  }))
                }
              />
            </AdminField>
            <div className="md:col-span-2">
              <AdminField label="Initial note" optional="optional">
                <AdminTextarea
                  rows={3}
                  value={newCase.note}
                  onChange={(event) =>
                    setNewCase((current) => ({ ...current, note: event.target.value }))
                  }
                />
              </AdminField>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Queue"
          title="Support cases"
          description="Filter by workload, source, assignee, or case summary."
        >
          <div className="mb-4 grid gap-3 lg:grid-cols-[1.6fr_1fr_1fr]">
            <AdminInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search summary, email, assignee, order..."
            />
            <AdminSelect
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as SupportCase["status"] | "ALL")
              }
            >
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as SupportCase["priority"] | "ALL")
              }
            >
              <option value="ALL">All priorities</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </AdminSelect>
          </div>

          <div className="space-y-3">
            {filteredCases.length === 0 ? (
              <AdminEmptyState
                title="No support cases found"
                description="Adjust the current filters or create a manual case."
              />
            ) : (
              filteredCases.map((supportCase) => (
                <button
                  key={supportCase.id}
                  type="button"
                  onClick={() => setSelectedCaseId(supportCase.id)}
                  className={`block w-full rounded-2xl border p-4 text-left transition ${
                    selectedCase?.id === supportCase.id
                      ? "border-cyan-400/30 bg-cyan-400/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{supportCase.summary}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {supportCase.sourceType} · {supportCase.assigneeEmail || "Unassigned"}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      <div>{supportCase.status}</div>
                      <div>{supportCase.priority}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        eyebrow="Case"
        title={selectedCase ? selectedCase.summary : "Support case detail"}
        description="Assign work, update support status, and append operational notes."
      >
        {!selectedCase ? (
          <AdminEmptyState
            title="No support case selected"
            description="Choose a case from the queue to inspect its timeline."
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <AdminField label="Status">
                  <AdminSelect
                    value={selectedCase.status}
                    onChange={(event) =>
                      void patchSupportCase(
                        selectedCase.id,
                        { status: event.target.value },
                        "Support case status updated.",
                      )
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
                <AdminField label="Priority">
                  <AdminSelect
                    value={selectedCase.priority}
                    onChange={(event) =>
                      void patchSupportCase(
                        selectedCase.id,
                        { priority: event.target.value },
                        "Support case priority updated.",
                      )
                    }
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
                <AdminField label="Assignee">
                  <AdminSelect
                    value={selectedCase.assigneeUserId ?? ""}
                    onChange={(event) =>
                      void patchSupportCase(
                        selectedCase.id,
                        { assigneeUserId: event.target.value || null },
                        "Support case assignee updated.",
                      )
                    }
                  >
                    <option value="">Unassigned</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} ({owner.role})
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
                <AdminField label="Resolution note" optional="optional">
                  <AdminInput
                    value={selectedCase.resolutionNote ?? ""}
                    onChange={(event) =>
                      setSupportCases((current) =>
                        current.map((supportCase) =>
                          supportCase.id === selectedCase.id
                            ? { ...supportCase, resolutionNote: event.target.value }
                            : supportCase,
                        ),
                      )
                    }
                    onBlur={() =>
                      void patchSupportCase(
                        selectedCase.id,
                        { resolutionNote: selectedCase.resolutionNote ?? "" },
                        "Resolution note saved.",
                      )
                    }
                  />
                </AdminField>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                <div>Created {formatDate(selectedCase.createdAt)}</div>
                <div className="mt-2">Updated {formatDate(selectedCase.updatedAt)}</div>
                <div className="mt-2">Resolved {formatDate(selectedCase.resolvedAt)}</div>
                {selectedCase.linkedOrder ? (
                  <div className="mt-2">
                    Linked order #{selectedCase.linkedOrder.orderNumber}
                  </div>
                ) : null}
                {selectedCase.linkedCustomer ? (
                  <div className="mt-2">
                    Linked customer {selectedCase.linkedCustomer.label}
                  </div>
                ) : null}
              </div>

              <AdminField label="Internal note">
                <AdminTextarea
                  rows={4}
                  value={caseNoteDraft}
                  onChange={(event) => setCaseNoteDraft(event.target.value)}
                />
              </AdminField>
              <AdminButton
                onClick={() =>
                  void patchSupportCase(
                    selectedCase.id,
                    { note: caseNoteDraft },
                    "Support note added.",
                  )
                }
                disabled={savingId === selectedCase.id}
              >
                {savingId === selectedCase.id ? "Saving..." : "Append note"}
              </AdminButton>
            </div>

            <div className="space-y-4">
              {selectedCase.contactSubmission ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold text-white">Contact submission</div>
                  <div className="mt-2 text-sm text-slate-300">
                    {selectedCase.contactSubmission.name} · {selectedCase.contactSubmission.email}
                  </div>
                  <div className="mt-3 text-sm text-slate-400">
                    {selectedCase.contactSubmission.message}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {selectedCase.events.length === 0 ? (
                  <AdminEmptyState
                    title="No support events yet"
                    description="Timeline events will appear here as the case changes."
                  />
                ) : (
                  selectedCase.events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-white">
                          {event.summary ?? event.eventType}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(event.createdAt)}
                        </div>
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {event.eventType}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        {event.actorEmail ?? "System"}
                      </div>
                      {event.note ? (
                        <div className="mt-3 text-sm text-slate-300">{event.note}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}
