"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import AdminThemeToggle from "@/components/admin/AdminThemeToggle";
import AdminBackButton from "@/components/admin/AdminBackButton";

type Funnel = {
  totalOrders: number;
  paidOrders: number;
  fulfilledOrders: number;
  refundedOrders: number;
  canceledOrders: number;
};

type TopProduct = {
  productId: string | null;
  productTitle: string | null;
  name: string;
  units: number;
  revenueCents: number;
};

type Stockout = {
  variantId: string;
  sku: string | null;
  productId: string | null;
  productTitle: string;
  variantTitle: string;
  quantityOnHand: number;
  reserved: number;
  available: number;
};
type Revenue = {
  totalCents: number;
};

const formatPrice = (amount: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount / 100);

const toPercent = (value: number, total: number) => {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
};

export default function AdminAnalyticsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [funnel, setFunnel] = useState<Funnel>({
    totalOrders: 0,
    paidOrders: 0,
    fulfilledOrders: 0,
    refundedOrders: 0,
    canceledOrders: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [stockouts, setStockouts] = useState<Stockout[]>([]);
  const [revenue, setRevenue] = useState<Revenue>({ totalCents: 0 });

  const loadAnalytics = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Analytics konnte nicht geladen werden.");
        return;
      }
      const data = (await res.json()) as {
        funnel?: Funnel;
        revenue?: Revenue;
        topProducts?: TopProduct[];
        stockouts?: Stockout[];
      };
      setFunnel(data.funnel ?? funnel);
      setRevenue(data.revenue ?? { totalCents: 0 });
      setTopProducts(data.topProducts ?? []);
      setStockouts(data.stockouts ?? []);
    } catch {
      setError("Analytics konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const stages = useMemo(
    () => [
      { label: "Orders", value: funnel.totalOrders, percent: "100%" },
      {
        label: "Paid",
        value: funnel.paidOrders,
        percent: toPercent(funnel.paidOrders, funnel.totalOrders),
      },
      {
        label: "Fulfilled",
        value: funnel.fulfilledOrders,
        percent: toPercent(funnel.fulfilledOrders, funnel.totalOrders),
      },
      {
        label: "Refunded",
        value: funnel.refundedOrders,
        percent: toPercent(funnel.refundedOrders, funnel.totalOrders),
      },
    ],
    [funnel]
  );

  return (
    <div className="space-y-10 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="rounded-2xl bg-[#2f3e36] p-6 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-white/70">
              ADMIN / ANALYTICS
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Analytics</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                {funnel.totalOrders} orders
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                {stockouts.length} stockouts
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AdminThemeToggle />
            <AdminBackButton
              inline
              showOnAnalytics
              className="h-9 px-4 text-sm text-[#2f3e36] hover:bg-emerald-50"
            />
            <button
              type="button"
              onClick={loadAnalytics}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2f3e36] shadow-sm transition hover:bg-emerald-50"
              disabled={loading}
            >
              {loading ? "Laden..." : "Aktualisieren"}
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(16,185,129,0.12)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
              01
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Conversion funnel
              </p>
              <p className="text-xs text-stone-500">
                Orders to paid and fulfilled.
              </p>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <LoadingSpinner size="sm" />
            <span>Analytics werden geladen...</span>
          </div>
        ) : error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-emerald-200/70 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-stone-400">
                Total Umsatz
              </p>
              <p className="mt-2 text-2xl font-semibold text-stone-900">
                {formatPrice(revenue.totalCents)}
              </p>
              <p className="text-xs text-stone-500">Paid orders only</p>
            </div>
            {stages.map((stage) => (
              <div
                key={stage.label}
                className="rounded-xl border border-emerald-200/70 bg-white p-4"
              >
                <p className="text-xs uppercase tracking-wide text-stone-400">
                  {stage.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {stage.value}
                </p>
                <p className="text-xs text-stone-500">{stage.percent}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(251,191,36,0.14)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
              02
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                Top products
              </p>
              <p className="text-xs text-stone-500">By revenue and units sold.</p>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <LoadingSpinner size="sm" />
            <span>Analytics werden geladen...</span>
          </div>
        ) : topProducts.length === 0 ? (
          <p className="text-sm text-stone-500">Noch keine Bestellungen.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-amber-200/70 bg-white">
            <div className="grid grid-cols-1 gap-3 border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800 sm:grid-cols-[2fr_120px_140px]">
              <div>Produkt</div>
              <div>Units</div>
              <div>Umsatz</div>
            </div>
            <div className="divide-y divide-amber-100">
              {topProducts.map((item) => (
                <div
                  key={`${item.productId ?? "unknown"}-${item.name}`}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-stone-700 sm:grid-cols-[2fr_120px_140px]"
                >
                  <div>
                    <div className="font-semibold text-stone-900">
                      {item.productTitle ?? item.name}
                    </div>
                    {item.productId && (
                      <div className="text-xs text-stone-500">{item.productId}</div>
                    )}
                  </div>
                  <div>{item.units}</div>
                  <div>{formatPrice(item.revenueCents)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-rose-200/70 bg-white/90 p-6 shadow-[0_18px_40px_rgba(248,113,113,0.14)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-700">
              03
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
                Stockouts
              </p>
              <p className="text-xs text-stone-500">Variants with zero stock.</p>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <LoadingSpinner size="sm" />
            <span>Analytics werden geladen...</span>
          </div>
        ) : stockouts.length === 0 ? (
          <p className="text-sm text-stone-500">
            Keine Produkte sind aktuell ausverkauft.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-rose-200/70 bg-white">
            <div className="grid grid-cols-1 gap-3 border-b border-rose-200/60 bg-rose-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-800 sm:grid-cols-[2fr_1fr_120px]">
              <div>Produkt</div>
              <div>Variante</div>
              <div>Verfuegbar</div>
            </div>
            <div className="divide-y divide-rose-100">
              {stockouts.map((item) => (
                <div
                  key={item.variantId}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-stone-700 sm:grid-cols-[2fr_1fr_120px]"
                >
                  <div>
                    <div className="font-semibold text-stone-900">
                      {item.productTitle}
                    </div>
                    <div className="text-xs text-stone-500">
                      {item.sku ? `SKU ${item.sku}` : item.variantId}
                    </div>
                  </div>
                  <div>{item.variantTitle}</div>
                  <div>0</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
