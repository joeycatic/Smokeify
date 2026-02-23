"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type CustomerGroup = "NORMAL" | "VIP" | "WHOLESALE" | "BLOCKED";

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
  role: "USER" | "ADMIN" | "STAFF";
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

type Props = {
  user: UserData;
  recentOrders: OrderRow[];
  auditLogs: AuditEntry[];
  actorRole: "USER" | "ADMIN" | "STAFF";
};

const GROUP_META: Record<CustomerGroup, { label: string; className: string }> = {
  NORMAL: { label: "Normal", className: "bg-stone-100 text-stone-700" },
  VIP: { label: "VIP", className: "bg-amber-100 text-amber-800" },
  WHOLESALE: { label: "Wholesale", className: "bg-blue-100 text-blue-800" },
  BLOCKED: { label: "Gesperrt", className: "bg-red-100 text-red-700" },
};

const ROLE_META: Record<string, { label: string; className: string }> = {
  USER: { label: "User", className: "bg-stone-100 text-stone-700" },
  STAFF: { label: "Staff", className: "bg-sky-100 text-sky-800" },
  ADMIN: { label: "Admin", className: "bg-violet-100 text-violet-800" },
};

const ORDER_STATUS_META: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-stone-100 text-stone-600",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
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
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-black/10 bg-stone-50 px-3 text-sm text-stone-900 outline-none transition focus:border-emerald-500/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/20";

export default function AdminUserEditClient({
  user,
  recentOrders,
  auditLogs,
  actorRole,
}: Props) {
  const [form, setForm] = useState({
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
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  };

  const initials = (
    (user.firstName?.[0] ?? user.email?.[0] ?? "?").toUpperCase()
  );

  const groupMeta = GROUP_META[form.customerGroup];
  const roleMeta = ROLE_META[user.role] ?? ROLE_META.USER;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-stone-500 shadow-sm transition hover:border-black/20 hover:text-stone-800"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="text-xs text-stone-400">
            <Link href="/admin" className="hover:text-stone-600">
              Admin
            </Link>
            {" / "}
            <span className="text-stone-700">
              {user.email ?? user.id}
            </span>
          </div>
        </div>
        <AdminThemeToggle />
      </div>

      {/* User header card */}
      <div className="mb-6 flex flex-wrap items-start gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2f3e36] text-xl font-bold text-white shadow">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-stone-900">
              {user.email ?? "—"}
            </p>
            <Chip className={roleMeta.className}>{roleMeta.label}</Chip>
            <Chip className={GROUP_META[user.customerGroup].className}>
              {GROUP_META[user.customerGroup].label}
            </Chip>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">
            Registriert: {fmtDate(user.createdAt)}
            {user.newsletterOptIn && (
              <span className="ml-3 text-emerald-600">✓ Marketing opt-in</span>
            )}
          </p>
          {(user.firstName || user.lastName) && (
            <p className="mt-0.5 text-sm text-stone-600">
              {[user.firstName, user.lastName].filter(Boolean).join(" ")}
            </p>
          )}
        </div>
        {/* Audit link */}
        <Link
          href={`/admin/audit?target=user:${user.id}`}
          className="shrink-0 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm hover:border-black/20 hover:text-stone-900"
        >
          Audit-Log →
        </Link>
      </div>

      {/* ── Section: Identity ──────────────────────────── */}
      <Section title="Identität & Kontakt">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-Mail">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls}
              placeholder="user@example.com"
            />
          </Field>
          <Field label="Nutzername (Public)">
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputCls}
              placeholder="optional"
            />
          </Field>
          <Field label="Vorname">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Nachname">
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* ── Section: Shipping Address ──────────────────── */}
      <Section title="Lieferadresse">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Straße">
            <input
              type="text"
              value={form.street}
              onChange={(e) => set("street", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Hausnummer">
            <input
              type="text"
              value={form.houseNumber}
              onChange={(e) => set("houseNumber", e.target.value)}
              className={`${inputCls} w-24`}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Field label="PLZ">
            <input
              type="text"
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
              className={`${inputCls} w-28`}
            />
          </Field>
          <Field label="Stadt">
            <input
              type="text"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="max-w-xs">
          <Field label="Land">
            <input
              type="text"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              className={inputCls}
              placeholder="DE"
            />
          </Field>
        </div>
      </Section>

      {/* ── Section: Customer Settings ─────────────────── */}
      <Section title="Kundeneinstellungen">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kundengruppe">
            <select
              value={form.customerGroup}
              onChange={(e) =>
                set("customerGroup", e.target.value as CustomerGroup)
              }
              className={inputCls}
              disabled={actorRole !== "ADMIN"}
            >
              {(
                Object.entries(GROUP_META) as [
                  CustomerGroup,
                  { label: string },
                ][]
              ).map(([val, { label }]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
            {actorRole !== "ADMIN" && (
              <p className="text-[11px] text-stone-400">
                Nur Admins können die Gruppe ändern.
              </p>
            )}
          </Field>

          <Field label="Marketing Opt-in">
            <label className="flex h-10 cursor-pointer items-center gap-3 rounded-lg border border-black/10 bg-stone-50 px-3">
              <input
                type="checkbox"
                checked={form.newsletterOptIn}
                onChange={(e) => set("newsletterOptIn", e.target.checked)}
                className="h-4 w-4 accent-emerald-700"
              />
              <span className="text-sm text-stone-700">
                {form.newsletterOptIn ? "Aktiv" : "Inaktiv"}
              </span>
              {user.newsletterOptInAt && (
                <span className="ml-auto text-[11px] text-stone-400">
                  seit {fmtDate(user.newsletterOptInAt)}
                </span>
              )}
            </label>
          </Field>
        </div>

        <Field label="Interne Notizen">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            placeholder="Notizen zum Kunden (nur intern sichtbar)…"
            className="w-full rounded-lg border border-black/10 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-emerald-500/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
          />
        </Field>
      </Section>

      {/* ── Save button ────────────────────────────────── */}
      <div className="mb-10 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#2f3e36] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#24312b] disabled:opacity-60"
        >
          {saving ? "Speichern…" : "Änderungen speichern"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircleIcon className="h-4 w-4" />
            Gespeichert
          </span>
        )}
        {error && (
          <span className="text-sm font-semibold text-red-600">{error}</span>
        )}
      </div>

      {/* ── Recent Orders ──────────────────────────────── */}
      {recentOrders.length > 0 && (
        <Section title={`Letzte Bestellungen (${recentOrders.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/8 text-left text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                  <th className="pb-2 pr-4">Nummer</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Betrag</th>
                  <th className="pb-2">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="text-sm">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-semibold text-emerald-800 hover:underline"
                      >
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Chip
                        className={
                          ORDER_STATUS_META[order.status] ??
                          "bg-stone-100 text-stone-600"
                        }
                      >
                        {order.status}
                      </Chip>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-stone-700">
                      {fmtMoney(order.amountTotal)}
                    </td>
                    <td className="py-2.5 text-stone-400">
                      {fmtDate(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Audit Log ──────────────────────────────────── */}
      <Section title="Audit-Log" noPad>
        {auditLogs.length === 0 ? (
          <p className="px-6 py-4 text-sm text-stone-400">
            Noch keine Einträge.
          </p>
        ) : (
          <div className="divide-y divide-black/5">
            {auditLogs.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  noPad,
}: {
  title: string;
  children: React.ReactNode;
  noPad?: boolean;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-black/8 bg-white shadow-sm">
      <div className="border-b border-black/6 px-5 py-3.5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
          {title}
        </h2>
      </div>
      <div className={noPad ? "" : "space-y-4 p-5"}>{children}</div>
    </section>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasChanges =
    entry.metadata &&
    "changes" in entry.metadata &&
    typeof entry.metadata.changes === "object" &&
    entry.metadata.changes !== null;

  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-600">
              {entry.action}
            </span>
            {entry.summary && (
              <span className="text-sm text-stone-600">{entry.summary}</span>
            )}
          </div>
          {entry.actorEmail && (
            <p className="mt-0.5 text-[11px] text-stone-400">
              von {entry.actorEmail}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[11px] text-stone-400">
            {fmtDate(entry.createdAt)}
          </span>
          {hasChanges && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
            >
              {open ? "Weniger ▲" : "Details ▼"}
            </button>
          )}
        </div>
      </div>

      {open && hasChanges && (
        <div className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-3">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left font-semibold uppercase tracking-wide text-stone-400">
                <th className="pb-1 pr-4">Feld</th>
                <th className="pb-1 pr-4">Vorher</th>
                <th className="pb-1">Nachher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60">
              {Object.entries(
                (entry.metadata!.changes as Record<
                  string,
                  { from: unknown; to: unknown }
                >) ?? {}
              ).map(([field, { from, to }]) => (
                <tr key={field}>
                  <td className="py-1 pr-4 font-semibold text-stone-500">
                    {field}
                  </td>
                  <td className="py-1 pr-4 font-mono text-red-500">
                    {String(from ?? "—")}
                  </td>
                  <td className="py-1 font-mono text-emerald-700">
                    {String(to ?? "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
