"use client";

import { useEffect, useMemo, useState } from "react";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";

type RegisteredCustomer = {
  type: "registered";
  id: string;
  email: string;
  name: string | null;
  joinedAt: string;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
};

type GuestCustomer = {
  type: "guest";
  email: string;
  name: string | null;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
};

type Customer = RegisteredCustomer | GuestCustomer;

const formatEur = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE");
};

export default function AdminCustomersClient() {
  const [registeredCustomers, setRegisteredCustomers] = useState<
    RegisteredCustomer[]
  >([]);
  const [guestCustomers, setGuestCustomers] = useState<GuestCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "registered" | "guest">("all");

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", { method: "GET" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to load customers.");
        return;
      }
      const data = (await res.json()) as {
        registeredCustomers?: RegisteredCustomer[];
        guestCustomers?: GuestCustomer[];
      };
      setRegisteredCustomers(data.registeredCustomers ?? []);
      setGuestCustomers(data.guestCustomers ?? []);
    } catch {
      setError("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, []);

  const allCustomers: Customer[] = useMemo(
    () => [
      ...registeredCustomers,
      ...guestCustomers,
    ],
    [registeredCustomers, guestCustomers]
  );

  const filtered = useMemo(() => {
    let list: Customer[] =
      tab === "registered"
        ? registeredCustomers
        : tab === "guest"
          ? guestCustomers
          : allCustomers;

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          (c.name?.toLowerCase().includes(q) ?? false)
      );
    }

    return [...list].sort((a, b) => {
      const aDate = a.lastOrderAt ?? ("joinedAt" in a ? a.joinedAt : "");
      const bDate = b.lastOrderAt ?? ("joinedAt" in b ? b.joinedAt : "");
      return bDate.localeCompare(aDate);
    });
  }, [allCustomers, registeredCustomers, guestCustomers, tab, query]);

  const totalRevenueCents = useMemo(
    () => allCustomers.reduce((sum, c) => sum + c.totalSpentCents, 0),
    [allCustomers]
  );

  return (
    <div className="space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      {/* Header */}
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / CUSTOMERS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Customers</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {allCustomers.length} total
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {registeredCustomers.length} registered
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {guestCustomers.length} guests
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {formatEur(totalRevenueCents)} revenue
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <button
              type="button"
              onClick={loadCustomers}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-black/10 bg-white overflow-hidden text-xs font-semibold">
          {(["all", "registered", "guest"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 capitalize transition ${
                tab === t
                  ? "bg-[#2f3e36] text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              {t === "all" ? "All" : t === "registered" ? "Registered" : "Guests"}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or name..."
          className="h-9 flex-1 min-w-[200px] rounded-lg border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/25"
        />
        <span className="text-xs text-stone-400">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        {/* Head */}
        <div className="grid grid-cols-[auto_1fr_1fr_80px_100px_100px] gap-x-4 border-b border-black/10 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          <div>Type</div>
          <div>Email</div>
          <div>Name</div>
          <div className="text-right">Orders</div>
          <div className="text-right">Spent</div>
          <div className="text-right">Last order</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-stone-500">
            {loading ? "Loading..." : "No customers found."}
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {filtered.map((customer, i) => (
              <div
                key={
                  customer.type === "registered"
                    ? customer.id
                    : `guest-${customer.email}-${i}`
                }
                className="grid grid-cols-[auto_1fr_1fr_80px_100px_100px] items-center gap-x-4 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50/60"
              >
                <div>
                  {customer.type === "registered" ? (
                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Registered
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Gast
                    </span>
                  )}
                </div>
                <div className="truncate font-medium text-stone-900">
                  {customer.type === "registered" ? (
                    <a
                      href={`/admin/users/${customer.id}`}
                      className="hover:underline"
                    >
                      {customer.email}
                    </a>
                  ) : (
                    customer.email
                  )}
                </div>
                <div className="truncate text-stone-500">
                  {customer.name ?? "—"}
                </div>
                <div className="text-right tabular-nums">
                  {customer.orderCount}
                </div>
                <div className="text-right tabular-nums font-medium text-stone-900">
                  {formatEur(customer.totalSpentCents)}
                </div>
                <div className="text-right text-stone-500">
                  {formatDate(customer.lastOrderAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-stone-400">
        Guest customers are derived from paid orders with no associated account.
        Registered customers link to their user profile.
      </p>
    </div>
  );
}
