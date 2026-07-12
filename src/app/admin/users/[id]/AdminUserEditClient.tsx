"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { AdminKpiStrip, AdminPage, AdminPageHeader, AdminPrimaryGrid, AdminStat } from "@/components/admin/ui";

type CustomerGroup = "NORMAL" | "VIP" | "WHOLESALE" | "BLOCKED";
type UserRole = "USER" | "ADMIN" | "STAFF";

type UserData = {
  id: string;
  email: string | null;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  role: UserRole;
  customerGroup: CustomerGroup;
  notes: string | null;
  newsletterOptIn: boolean;
  newsletterOptInAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderRow = {
  id: string;
  orderNumber: number;
  status: string;
  amountTotal: number;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AnalyzerRun = {
  id: string;
  storefront: "Smokeify" | "Growvault";
  userEmail: string | null;
  provider: string;
  model: string;
  latencyMs: number | null;
  confidence: number;
  healthStatus: string;
  species: string;
  reviewStatus: string;
  safetyFlags: string[];
  createdAt: string;
  issues: Array<{
    id: string;
    label: string;
    confidence: number;
    severity: string;
  }>;
  feedbackCount: number;
  incorrectFeedbackCount: number;
};

type Props = {
  user: UserData;
  recentOrders: OrderRow[];
  analyzerRuns: AnalyzerRun[];
  analyzerBridgeError: string | null;
  auditLogs: AuditEntry[];
  actorRole: UserRole;
};

type UserFormState = {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  customerGroup: CustomerGroup;
  notes: string;
  newsletterOptIn: boolean;
};

type PersistedUserDraft = {
  version: 1;
  baseUpdatedAt: string;
  form: UserFormState;
};

const USER_DRAFT_STORAGE_PREFIX = "admin-user-draft:";

const PANEL_CLASS =
  "rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[0_22px_70px_rgba(0,0,0,0.35)]";
const INPUT_CLASS =
  "h-9 w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3.5 text-sm text-[var(--adm-text)] outline-none transition placeholder:text-[var(--adm-text-faint)] focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10";
const TEXTAREA_CLASS =
  "w-full rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3.5 py-3 text-sm text-[var(--adm-text)] outline-none transition placeholder:text-[var(--adm-text-faint)] focus:border-cyan-400/40 focus:ring-4 focus:ring-cyan-400/10";
const PRIMARY_BUTTON =
  "inline-flex h-9 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-white transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-[var(--adm-text-muted)]";
const SECONDARY_BUTTON =
  "inline-flex h-9 items-center justify-center rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-4 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)] disabled:cursor-not-allowed disabled:border-[var(--adm-border)] disabled:text-[var(--adm-text-faint)]";
const MUTED_BUTTON =
  "inline-flex h-8 items-center justify-center rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-primary)] hover:text-[var(--adm-primary)]";

const GROUP_META: Record<CustomerGroup, { label: string; className: string }> = {
  NORMAL: { label: "Normal", className: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]" },
  VIP: { label: "VIP", className: "border-[#e2a136] bg-[#fff4dd] text-[#81560e]" },
  WHOLESALE: {
    label: "Wholesale",
    className: "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]",
  },
  BLOCKED: { label: "Blocked", className: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]" },
};

const ROLE_META: Record<UserRole, { label: string; className: string }> = {
  USER: { label: "User", className: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]" },
  STAFF: { label: "Staff", className: "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]" },
  ADMIN: {
    label: "Admin",
    className: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  },
};

const ORDER_STATUS_META: Record<string, string> = {
  pending: "border-[#e2a136] bg-[#fff4dd] text-[#81560e]",
  processing: "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]",
  shipped: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  delivered: "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
  cancelled: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]",
  canceled: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]",
  refunded: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]",
};

const ANALYZER_STOREFRONT_META: Record<
  AnalyzerRun["storefront"],
  { label: string; className: string }
> = {
  Smokeify: {
    label: "Smokeify",
    className: "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]",
  },
  Growvault: {
    label: "Growvault",
    className: "border-lime-400/20 bg-lime-400/10 text-lime-200",
  },
};

const ANALYZER_HEALTH_META: Record<string, string> = {
  HEALTHY: "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
  WARNING: "border-[#e2a136] bg-[#fff4dd] text-[#81560e]",
  CRITICAL: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]",
};

const ANALYZER_REVIEW_META: Record<string, string> = {
  UNREVIEWED: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]",
  REVIEWED_OK: "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
  REVIEWED_INCORRECT: "border-orange-400/20 bg-orange-400/10 text-orange-200",
  REVIEWED_UNSAFE: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]",
  NEEDS_PROMPT_FIX: "border-violet-400/20 bg-violet-400/10 text-violet-200",
  NEEDS_RECOMMENDATION_FIX: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  PRIVACY_REVIEW: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function serializeUserForm(form: UserFormState) {
  return JSON.stringify(form);
}

function buildInitialForm(user: UserData): UserFormState {
  return {
    email: user.email ?? "",
    name: user.name ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    street: user.street ?? "",
    houseNumber: user.houseNumber ?? "",
    postalCode: user.postalCode ?? "",
    city: user.city ?? "",
    country: user.country ?? "DE",
    customerGroup: user.customerGroup,
    notes: user.notes ?? "",
    newsletterOptIn: user.newsletterOptIn,
  };
}

function createEmptyUser(user: UserData, form: UserFormState, updatedAt: string): UserData {
  return {
    ...user,
    email: form.email.trim() || null,
    name: form.name.trim() || null,
    firstName: form.firstName.trim() || null,
    lastName: form.lastName.trim() || null,
    street: form.street.trim() || null,
    houseNumber: form.houseNumber.trim() || null,
    postalCode: form.postalCode.trim() || null,
    city: form.city.trim() || null,
    country: form.country.trim() || null,
    customerGroup: form.customerGroup,
    notes: form.notes.trim() || null,
    newsletterOptIn: form.newsletterOptIn,
    newsletterOptInAt:
      form.newsletterOptIn && !user.newsletterOptIn
        ? new Date().toISOString()
        : user.newsletterOptInAt,
    updatedAt,
  };
}

export default function AdminUserEditClient({
  user,
  recentOrders,
  analyzerRuns,
  analyzerBridgeError,
  auditLogs,
  actorRole,
}: Props) {
  const initialForm = useMemo(() => buildInitialForm(user), [user]);
  const [account, setAccount] = useState(user);
  const [userUpdatedAt, setUserUpdatedAt] = useState(user.updatedAt);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedFormSnapshot, setSavedFormSnapshot] = useState(() =>
    serializeUserForm(initialForm)
  );
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);

  const userDraftStorageKey = `${USER_DRAFT_STORAGE_PREFIX}${user.id}`;
  const hasUnsavedChanges = serializeUserForm(form) !== savedFormSnapshot;

  const setField = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  useEffect(() => {
    setAccount(user);
    setUserUpdatedAt(user.updatedAt);
    setForm(initialForm);
    setSavedFormSnapshot(serializeUserForm(initialForm));
  }, [initialForm, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawDraft = window.sessionStorage.getItem(userDraftStorageKey);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as PersistedUserDraft;
      if (draft.version !== 1 || draft.baseUpdatedAt !== user.updatedAt) {
        window.sessionStorage.removeItem(userDraftStorageKey);
        return;
      }
      setForm(draft.form);
      setDraftMessage("Recovered a local draft from this browser session.");
    } catch {
      window.sessionStorage.removeItem(userDraftStorageKey);
    }
  }, [user.updatedAt, userDraftStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasUnsavedChanges) {
      window.sessionStorage.removeItem(userDraftStorageKey);
      return;
    }

    const draft: PersistedUserDraft = {
      version: 1,
      baseUpdatedAt: userUpdatedAt,
      form,
    };
    window.sessionStorage.setItem(userDraftStorageKey, JSON.stringify(draft));
  }, [form, hasUnsavedChanges, userDraftStorageKey, userUpdatedAt]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const discardLocalDraft = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(userDraftStorageKey);
    window.location.reload();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/users/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          expectedUpdatedAt: userUpdatedAt,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        currentUpdatedAt?: string;
        user?: { id: string; updatedAt: string };
      };

      if (!response.ok) {
        if (data.currentUpdatedAt) {
          setUserUpdatedAt(data.currentUpdatedAt);
        }
        setError(data.error ?? "Saving failed.");
        return;
      }

      const nextUpdatedAt = data.user?.updatedAt ?? new Date().toISOString();
      setUserUpdatedAt(nextUpdatedAt);
      setSavedFormSnapshot(serializeUserForm(form));
      setAccount((current) => createEmptyUser(current, form, nextUpdatedAt));
      setNotice("User profile saved.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setResetSending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/users/${account.id}/password-reset`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Failed to send password reset email.");
        return;
      }

      setNotice(`Password reset email sent to ${account.email}.`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResetSending(false);
    }
  };

  const recentOrderTotal = useMemo(
    () => recentOrders.reduce((sum, order) => sum + order.amountTotal, 0),
    [recentOrders]
  );
  const analyzerSourceCounts = useMemo(
    () =>
      analyzerRuns.reduce(
        (counts, run) => ({
          Smokeify: counts.Smokeify + (run.storefront === "Smokeify" ? 1 : 0),
          Growvault: counts.Growvault + (run.storefront === "Growvault" ? 1 : 0),
        }),
        { Smokeify: 0, Growvault: 0 }
      ),
    [analyzerRuns]
  );
  const displayName =
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.name ||
    account.email ||
    account.id;
  const initials = (displayName.trim()[0] ?? "?").toUpperCase();
  const roleMeta = ROLE_META[account.role];
  const groupMeta = GROUP_META[account.customerGroup];
  const infoCards = [
    {
      label: "Created",
      value: formatDateTime(account.createdAt),
      detail: "Initial account creation",
    },
    {
      label: "Last update",
      value: formatDateTime(account.updatedAt),
      detail: hasUnsavedChanges ? "Draft changes are still local" : "Server data matches this view",
    },
    {
      label: "Recent orders",
      value: String(recentOrders.length),
      detail:
        recentOrders.length > 0 ? `${formatMoney(recentOrderTotal)} across latest orders` : "No recent orders",
    },
    {
      label: "Analyzer",
      value: String(analyzerRuns.length),
      detail: `${analyzerSourceCounts.Smokeify} Smokeify · ${analyzerSourceCounts.Growvault} Growvault`,
    },
    {
      label: "Marketing",
      value: form.newsletterOptIn ? "Opted in" : "Not subscribed",
      detail: account.newsletterOptInAt
        ? `Since ${formatDateTime(account.newsletterOptInAt)}`
        : "No opt-in timestamp recorded",
    },
  ];

  return (
    <AdminPage layout="editor">
      <AdminPageHeader
        eyebrow="Admin / Users / Detail"
        title={displayName}
        description="Identity, access governance, customer context, activity, and destructive controls."
        actions={<><Link href="/admin/users" className={MUTED_BUTTON}>All users</Link><button type="button" onClick={handleSave} disabled={saving || !hasUnsavedChanges} className={PRIMARY_BUTTON}>{saving ? "Saving..." : "Save changes"}</button></>}
      >
        <AdminKpiStrip>
          <AdminStat label="Role" value={roleMeta.label} />
          <AdminStat label="Customer group" value={groupMeta.label} />
          <AdminStat label="Recent orders" value={recentOrders.length} />
          <AdminStat label="Marketing" value={form.newsletterOptIn ? "Opted in" : "Not subscribed"} />
        </AdminKpiStrip>
      </AdminPageHeader>
      <section className="hidden">
        <div className="absolute inset-0 bg-[var(--adm-surface)]" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--adm-text-faint)]">
              <Link
                href="/admin/users"
                className="inline-flex h-8 w-10 items-center justify-center rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <span>Admin / Users / Detail</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/users" className={MUTED_BUTTON}>
                All users
              </Link>
              <Link href={`/admin/audit?target=user:${account.id}`} className={MUTED_BUTTON}>
                Audit log
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-xl font-semibold text-[var(--adm-text)] shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--adm-text-faint)]">
                  User profile
                </p>
                <h1 className="mt-2 truncate text-3xl font-semibold text-[var(--adm-text)]">
                  {displayName}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-[var(--adm-text-muted)]">
                  Edit customer identity, shipping profile, internal notes, and trigger a password
                  reset email without leaving the user record.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className={roleMeta.className}>{roleMeta.label}</Badge>
                  <Badge className={groupMeta.className}>{groupMeta.label}</Badge>
                  <Badge
                    className={
                      account.newsletterOptIn
                        ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                        : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
                    }
                  >
                    {account.newsletterOptIn ? "Marketing opt-in" : "No marketing opt-in"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={resetSending || !account.email}
                className={SECONDARY_BUTTON}
              >
                <EnvelopeIcon className="mr-2 h-4 w-4" />
                {resetSending ? "Sending reset email..." : "Send password reset"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className={PRIMARY_BUTTON}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {infoCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-4 backdrop-blur"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                  {card.label}
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--adm-text)]">{card.value}</div>
                <div className="mt-2 text-xs text-[var(--adm-text-muted)]">{card.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {draftMessage ? (
        <Banner
          tone="info"
          action={
            <button type="button" onClick={discardLocalDraft} className={MUTED_BUTTON}>
              Discard draft
            </button>
          }
        >
          {draftMessage}
        </Banner>
      ) : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      <AdminPrimaryGrid rail="narrow">
        <div className="space-y-6">
          <SectionCard title="Identity and contact" description="Core account identifiers and customer-facing name fields.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="user@example.com"
                />
              </Field>
              <Field label="Public username">
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Optional public handle"
                />
              </Field>
              <Field label="First name">
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(event) => setField("firstName", event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(event) => setField("lastName", event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Shipping address" description="Stored delivery address values used across checkout and order history.">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <Field label="Street">
                <input
                  type="text"
                  value={form.street}
                  onChange={(event) => setField("street", event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="House number">
                <input
                  type="text"
                  value={form.houseNumber}
                  onChange={(event) => setField("houseNumber", event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <Field label="Postal code">
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(event) => setField("postalCode", event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="City">
                <input
                  type="text"
                  value={form.city}
                  onChange={(event) => setField("city", event.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <div className="max-w-xs">
              <Field label="Country">
                <input
                  type="text"
                  value={form.country}
                  onChange={(event) => setField("country", event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="DE"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Customer settings" description="Segmentation, newsletter consent, and internal notes for operators.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer group">
                <select
                  value={form.customerGroup}
                  onChange={(event) =>
                    setField("customerGroup", event.target.value as CustomerGroup)
                  }
                  className={INPUT_CLASS}
                  disabled={actorRole !== "ADMIN"}
                >
                  {(Object.entries(GROUP_META) as Array<
                    [CustomerGroup, { label: string; className: string }]
                  >).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                {actorRole !== "ADMIN" ? (
                  <div className="mt-2 text-xs text-[var(--adm-text-faint)]">
                    Only admins can change the customer group.
                  </div>
                ) : null}
              </Field>
              <Field label="Marketing opt-in">
                <label className="flex min-h-9 items-center gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3.5 text-sm text-[var(--adm-text)]">
                  <input
                    type="checkbox"
                    checked={form.newsletterOptIn}
                    onChange={(event) => setField("newsletterOptIn", event.target.checked)}
                    className="h-4 w-4 accent-cyan-300"
                  />
                  <span>{form.newsletterOptIn ? "Subscribed" : "Not subscribed"}</span>
                  <span className="ml-auto text-xs text-[var(--adm-text-faint)]">
                    {account.newsletterOptInAt
                      ? `Since ${formatDateTime(account.newsletterOptInAt)}`
                      : "No timestamp"}
                  </span>
                </label>
              </Field>
            </div>

            <Field label="Internal notes">
              <textarea
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                rows={5}
                className={TEXTAREA_CLASS}
                placeholder="Internal context for support, fraud checks, or account history"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Analyzer runs"
            description="Plant analyzer activity connected to this account across Smokeify and Growvault."
          >
            {analyzerBridgeError ? (
              <div className="rounded-[22px] border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
                Growvault runs could not be loaded: {analyzerBridgeError}
              </div>
            ) : null}
            {analyzerRuns.length === 0 ? (
              <EmptyState>No Smokeify or Growvault analyzer runs found for this user.</EmptyState>
            ) : (
              <div className="space-y-3">
                {analyzerRuns.map((run) => (
                  <AnalyzerRunRow key={`${run.storefront}:${run.id}`} run={run} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent orders" description="Latest order activity connected to this user account.">
            {recentOrders.length === 0 ? (
              <EmptyState>No recent orders found for this user.</EmptyState>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 md:hidden">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-sm font-semibold text-[var(--adm-primary)] underline-offset-4 hover:underline"
                          >
                            Order #{order.orderNumber}
                          </Link>
                          <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                            {formatDateTime(order.createdAt)}
                          </div>
                        </div>
                        <Badge
                          className={
                            ORDER_STATUS_META[order.status] ??
                            "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                      <div className="mt-4 text-sm font-semibold text-[var(--adm-text)]">
                        {formatMoney(order.amountTotal)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                      <tr>
                        <th className="pb-3 pr-4">Order</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Total</th>
                        <th className="pb-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="py-3 pr-4">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="font-semibold text-[var(--adm-primary)] underline-offset-4 hover:underline"
                            >
                              #{order.orderNumber}
                            </Link>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              className={
                                ORDER_STATUS_META[order.status] ??
                                "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
                              }
                            >
                              {order.status}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-[var(--adm-text)]">
                            {formatMoney(order.amountTotal)}
                          </td>
                          <td className="py-3 text-[var(--adm-text-muted)]">{formatDateTime(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Audit trail" description="Operator activity recorded against this user profile.">
            {auditLogs.length === 0 ? (
              <EmptyState>No audit entries recorded for this user yet.</EmptyState>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Account snapshot" description="Current server-side profile values and editor state.">
            <div className="space-y-3">
              <SnapshotRow label="Email" value={account.email ?? "No email stored"} />
              <SnapshotRow label="Public username" value={account.name ?? "Not set"} />
              <SnapshotRow label="Role" value={account.role} />
              <SnapshotRow label="Customer group" value={groupMeta.label} />
              <SnapshotRow
                label="Draft status"
                value={hasUnsavedChanges ? "Unsaved local changes" : "In sync with server"}
                tone={hasUnsavedChanges ? "warning" : "success"}
              />
            </div>
          </SectionCard>

          <SectionCard title="Quick actions" description="Direct actions for this account from the detail view.">
            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className={PRIMARY_BUTTON}
              >
                {saving ? "Saving..." : "Save profile changes"}
              </button>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={resetSending || !account.email}
                className={SECONDARY_BUTTON}
              >
                <EnvelopeIcon className="mr-2 h-4 w-4" />
                {resetSending ? "Sending..." : "Send password reset email"}
              </button>
              <button
                type="button"
                onClick={discardLocalDraft}
                disabled={!hasUnsavedChanges}
                className={SECONDARY_BUTTON}
              >
                <ArrowPathIcon className="mr-2 h-4 w-4" />
                Discard local draft
              </button>
              <Link href={`/admin/audit?target=user:${account.id}`} className={MUTED_BUTTON}>
                Review full audit trail
              </Link>
            </div>
          </SectionCard>

          <div className={`${PANEL_CLASS} overflow-hidden`}>
            <div className="border-b border-[var(--adm-border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
                Save status
              </p>
            </div>
            <div className="space-y-3 p-5 text-sm text-[var(--adm-text-muted)]">
              <div className="flex items-start gap-3 rounded-[20px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    hasUnsavedChanges
                      ? "bg-[#fff4dd] text-[#81560e]"
                      : "bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                  }`}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-[var(--adm-text)]">
                    {hasUnsavedChanges ? "Changes pending" : "Record synchronized"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                    {hasUnsavedChanges
                      ? "This browser session contains local edits that are not persisted yet."
                      : "The last successful save matches the current form state."}
                  </div>
                </div>
              </div>
              <div className="rounded-[20px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 text-xs text-[var(--adm-text-faint)]">
                Password reset emails use the currently saved account email. If you edit the email
                field, save first so the reset message goes to the correct address.
              </div>
            </div>
          </div>
        </div>
      </AdminPrimaryGrid>
    </AdminPage>
  );
}

function AnalyzerRunRow({ run }: { run: AnalyzerRun }) {
  const storefrontMeta = ANALYZER_STOREFRONT_META[run.storefront];
  const issueLabels = run.issues.map((issue) => issue.label).filter(Boolean);

  return (
    <div className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={storefrontMeta.className}>{storefrontMeta.label}</Badge>
            <Badge
              className={
                ANALYZER_HEALTH_META[run.healthStatus] ??
                "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
              }
            >
              {run.healthStatus}
            </Badge>
            <Badge
              className={
                ANALYZER_REVIEW_META[run.reviewStatus] ??
                "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"
              }
            >
              {run.reviewStatus}
            </Badge>
          </div>
          <div className="mt-3 text-sm font-semibold text-[var(--adm-text)]">
            {run.species || "Unknown plant"}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--adm-text-faint)]">
            <span>{formatDateTime(run.createdAt)}</span>
            <span>Confidence {formatPercent(run.confidence)}</span>
            {run.latencyMs ? <span>{run.latencyMs}ms</span> : null}
            <span>
              {run.provider}/{run.model}
            </span>
          </div>
          {issueLabels.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {issueLabels.slice(0, 6).map((label) => (
                <span
                  key={`${run.id}:${label}`}
                  className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-[var(--adm-text-faint)]">No stored issue labels.</div>
          )}
        </div>
        <div className="shrink-0 text-right text-xs text-[var(--adm-text-faint)]">
          <div className="font-mono">{run.id}</div>
          <div className="mt-2">
            Feedback: {run.feedbackCount}
            {run.incorrectFeedbackCount > 0 ? (
              <span className="font-semibold text-orange-200">
                {" "}
                ({run.incorrectFeedbackCount} disputed)
              </span>
            ) : null}
          </div>
          {run.safetyFlags.length > 0 ? (
            <div className="mt-1 font-semibold text-[var(--adm-error)]">
              {run.safetyFlags.length} safety flag
              {run.safetyFlags.length === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function Banner({
  children,
  tone,
  action,
}: {
  children: React.ReactNode;
  tone: "info" | "success" | "error";
  action?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
      : tone === "error"
        ? "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]"
        : "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${toneClass}`}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${PANEL_CLASS} overflow-hidden`}>
      <div className="border-b border-[var(--adm-border)] px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)]">
          {title}
        </p>
        <p className="mt-2 text-sm text-[var(--adm-text-muted)]">{description}</p>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      {children}
    </label>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-8 text-center text-sm text-[var(--adm-text-faint)]">
      {children}
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-[var(--adm-success)]"
      : tone === "warning"
        ? "text-[#81560e]"
        : "text-[var(--adm-text)]";

  return (
    <div className="rounded-[20px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
        {label}
      </div>
      <div className={`mt-2 text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const rawChanges =
    entry.metadata &&
    "changes" in entry.metadata &&
    entry.metadata.changes &&
    typeof entry.metadata.changes === "object"
      ? (entry.metadata.changes as Record<string, { from: unknown; to: unknown }>)
      : null;
  const hasChanges = rawChanges && Object.keys(rawChanges).length > 0;

  return (
    <div className="rounded-[22px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-text-muted)]">
              {entry.action}
            </span>
            {entry.summary ? (
              <span className="text-sm text-[var(--adm-text-muted)]">{entry.summary}</span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-[var(--adm-text-faint)]">
            {entry.actorEmail ? `Actor: ${entry.actorEmail}` : "Actor email not stored"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--adm-text-faint)]">{formatDateTime(entry.createdAt)}</span>
          {hasChanges ? (
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="text-xs font-semibold text-[var(--adm-primary)]"
            >
              {open ? "Hide details" : "Show details"}
            </button>
          ) : null}
        </div>
      </div>

      {open && hasChanges ? (
        <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--adm-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--adm-surface)] text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
              <tr>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[var(--adm-surface)]">
              {Object.entries(rawChanges).map(([field, change]) => (
                <tr key={field}>
                  <td className="px-4 py-3 font-medium text-[var(--adm-text)]">{field}</td>
                  <td className="px-4 py-3 text-[var(--adm-text-muted)]">{formatAuditValue(change.from)}</td>
                  <td className="px-4 py-3 text-[var(--adm-text)]">{formatAuditValue(change.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
