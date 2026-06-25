"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";

type Overview = {
  config: {
    enabled: boolean;
    payload: {
      welcomeEnabled: boolean;
      recoveryEnabled: boolean;
      popupDelaySeconds: number;
      contentCadenceDays: number;
    };
  };
  metrics: {
    activeSubscribers: number;
    activeWelcome: number;
    welcomeSent: number;
    pendingBackInStock: number;
    crossSells: number;
    crossSellCoverage: number;
    presets: number;
    articles: number;
    publishedArticles: number;
  };
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    status: string;
    excerpt: string;
    seoTitle: string | null;
    seoDescription: string | null;
    keyword: string | null;
    cluster: string | null;
    body: unknown;
    scheduledAt: string | Date | null;
  }>;
  backInStock: Array<{
    productId: string;
    productTitle: string | null;
    _count: { _all: number };
  }>;
};

const emptyArticle = {
  id: "",
  slug: "",
  title: "",
  excerpt: "",
  seoTitle: "",
  seoDescription: "",
  keyword: "",
  cluster: "buying-guides",
  markdown: "",
  status: "DRAFT",
  scheduledAt: "",
};

export default function AdminGrowthClient({
  initialOverview,
}: {
  initialOverview: Overview;
}) {
  const [overview, setOverview] = useState(initialOverview);
  const [config, setConfig] = useState(initialOverview.config);
  const [article, setArticle] = useState(emptyArticle);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  const callGrowth = async (
    key: string,
    init: RequestInit,
    success: string,
  ) => {
    setPending(key);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/growth", {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Aktion fehlgeschlagen.");
      const refreshed = await fetch("/api/admin/growth", { cache: "no-store" });
      if (refreshed.ok) {
        const next = (await refreshed.json()) as Overview;
        setOverview(next);
        setConfig(next.config);
      }
      setNotice({ tone: "success", text: success });
      return data;
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Aktion fehlgeschlagen.",
      });
      return null;
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="admin-route-frame text-slate-100">
      <div className="relative overflow-hidden rounded-[28px] border border-lime-300/15 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,.12),transparent_35%),repeating-linear-gradient(135deg,rgba(255,255,255,.018)_0,rgba(255,255,255,.018)_1px,transparent_1px,transparent_10px),#07100b] p-5 shadow-[0_32px_90px_rgba(0,0,0,.38)] sm:p-7">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-lime-300" />
        <p className="font-mono text-[11px] font-bold uppercase tracking-[.24em] text-lime-300">
          Growth Control / GrowVault
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-.045em] text-white sm:text-5xl">
          Demand Engine
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Capture, Recovery, Merchandising, Starter-Setups, Content und Restock in einem
          kontrollierten Betriebsraum.
        </p>
      </div>

      {notice ? (
        <div className="mt-5">
          <AdminNotice tone={notice.tone}>{notice.text}</AdminNotice>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard label="Abonnenten" value={String(overview.metrics.activeSubscribers)} detail="aktiv" tone="emerald" />
        <AdminMetricCard label="Welcome" value={String(overview.metrics.activeWelcome)} detail={`${overview.metrics.welcomeSent} Mails versendet`} tone="violet" />
        <AdminMetricCard label="Cross-Sells" value={`${overview.metrics.crossSellCoverage}%`} detail={`${overview.metrics.crossSells} Zuordnungen`} tone="amber" />
        <AdminMetricCard label="Restock" value={String(overview.metrics.pendingBackInStock)} detail="offene Anfragen" tone="slate" />
        <AdminMetricCard label="Content" value={`${overview.metrics.publishedArticles}/${overview.metrics.articles}`} detail="veröffentlicht" tone="emerald" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          eyebrow="01 / Lifecycle"
          title="Capture und Automationen"
          description="Flows bleiben bis zum kontrollierten Aktivieren pausiert."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <span className="text-sm font-semibold text-white">Welcome-Serie</span>
              <span className="mt-1 block text-xs text-slate-400">Sofort, Tag 2, Tag 5</span>
              <input
                className="mt-4 h-5 w-5 accent-lime-300"
                type="checkbox"
                checked={config.payload.welcomeEnabled}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    payload: { ...current.payload, welcomeEnabled: event.target.checked },
                  }))
                }
              />
            </label>
            <label className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <span className="text-sm font-semibold text-white">Checkout-Recovery</span>
              <span className="mt-1 block text-xs text-slate-400">60 Minuten und 24 Stunden</span>
              <input
                className="mt-4 h-5 w-5 accent-lime-300"
                type="checkbox"
                checked={config.payload.recoveryEnabled}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    payload: { ...current.payload, recoveryEnabled: event.target.checked },
                  }))
                }
              />
            </label>
            <AdminField label="Popup-Verzögerung (Sekunden)">
              <AdminInput
                value={String(config.payload.popupDelaySeconds)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    payload: {
                      ...current.payload,
                      popupDelaySeconds: Number(event.target.value) || 7,
                    },
                  }))
                }
              />
            </AdminField>
            <AdminField label="Content-Takt (Tage)">
              <AdminInput
                value={String(config.payload.contentCadenceDays)}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    payload: {
                      ...current.payload,
                      contentCadenceDays: Number(event.target.value) || 7,
                    },
                  }))
                }
              />
            </AdminField>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <AdminButton
              disabled={pending === "config"}
              onClick={() =>
                void callGrowth(
                  "config",
                  {
                    method: "PATCH",
                    body: JSON.stringify({
                      enabled:
                        config.payload.welcomeEnabled ||
                        config.payload.recoveryEnabled,
                      ...config.payload,
                    }),
                  },
                  "Growth-Konfiguration gespeichert.",
                )
              }
            >
              {pending === "config" ? "Speichert …" : "Konfiguration speichern"}
            </AdminButton>
            <AdminButton
              tone="secondary"
              disabled={pending === "welcome"}
              onClick={() =>
                void callGrowth(
                  "welcome",
                  { method: "POST", body: JSON.stringify({ action: "run_welcome" }) },
                  "Welcome-Lauf abgeschlossen.",
                )
              }
            >
              Welcome jetzt prüfen
            </AdminButton>
            <Link href="/admin/ops" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:border-lime-300/30">
              Recovery in Ops
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="02 / Merchandising"
          title="Cross-Sells und Starter-Setups"
          description="Regelbasierte Vorschläge mit manuellen Produkt-Overrides."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="font-mono text-xs uppercase tracking-[.18em] text-lime-300">Cross-Sell Coverage</div>
              <div className="mt-3 text-4xl font-black text-white">{overview.metrics.crossSellCoverage}%</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Manuelle Zuordnungen bleiben bestehen; nur leere Produkte werden ergänzt.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <div className="font-mono text-xs uppercase tracking-[.18em] text-lime-300">Preset Engine</div>
              <div className="mt-3 text-4xl font-black text-white">{overview.metrics.presets}</div>
              <p className="mt-2 text-xs leading-5 text-slate-400">Budget, Balanced und Premium mit wählbarer Fläche.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <AdminButton
              disabled={pending === "cross-sells"}
              onClick={() =>
                void callGrowth(
                  "cross-sells",
                  {
                    method: "POST",
                    body: JSON.stringify({ action: "generate_cross_sells" }),
                  },
                  "Leere Cross-Sell-Slots wurden regelbasiert befüllt.",
                )
              }
            >
              Vorschläge generieren
            </AdminButton>
            <Link href="/admin/recommendations" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:border-lime-300/30">
              Regeln öffnen
            </Link>
            <Link href="/admin/catalog" className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:border-lime-300/30">
              Overrides pflegen
            </Link>
          </div>
        </AdminPanel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <AdminPanel
          eyebrow="03 / Editorial"
          title="Content-SEO CMS"
          description="Entwürfe, geplante Artikel und direkte Veröffentlichung für GrowVault."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Titel"><AdminInput value={article.title} onChange={(event) => setArticle({ ...article, title: event.target.value })} /></AdminField>
            <AdminField label="Slug"><AdminInput value={article.slug} onChange={(event) => setArticle({ ...article, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })} /></AdminField>
            <AdminField label="Keyword"><AdminInput value={article.keyword} onChange={(event) => setArticle({ ...article, keyword: event.target.value })} /></AdminField>
            <AdminField label="Cluster"><AdminInput value={article.cluster} onChange={(event) => setArticle({ ...article, cluster: event.target.value })} /></AdminField>
          </div>
          <div className="mt-4"><AdminField label="Kurzbeschreibung"><AdminTextarea rows={3} value={article.excerpt} onChange={(event) => setArticle({ ...article, excerpt: event.target.value })} /></AdminField></div>
          <div className="mt-4"><AdminField label="Artikelinhalt (Markdown)"><AdminTextarea rows={12} value={article.markdown} onChange={(event) => setArticle({ ...article, markdown: event.target.value })} /></AdminField></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AdminField label="Status">
              <AdminSelect value={article.status} onChange={(event) => setArticle({ ...article, status: event.target.value })}>
                <option value="DRAFT">Entwurf</option>
                <option value="SCHEDULED">Geplant</option>
                <option value="PUBLISHED">Veröffentlicht</option>
              </AdminSelect>
            </AdminField>
            <AdminField label="Veröffentlichung">
              <AdminInput type="datetime-local" value={article.scheduledAt} onChange={(event) => setArticle({ ...article, scheduledAt: event.target.value })} />
            </AdminField>
          </div>
          <div className="mt-5 flex gap-2">
            <AdminButton
              disabled={pending === "article"}
              onClick={() =>
                void callGrowth(
                  "article",
                  {
                    method: "POST",
                    body: JSON.stringify({ action: "save_article", article }),
                  },
                  "Artikel gespeichert.",
                ).then((result) => result && setArticle(emptyArticle))
              }
            >
              Artikel speichern
            </AdminButton>
          </div>
          <div className="mt-6 space-y-2">
            {overview.articles.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const body =
                    item.body && typeof item.body === "object" && "markdown" in item.body
                      ? String((item.body as { markdown?: unknown }).markdown ?? "")
                      : "";
                  setArticle({
                    id: item.id,
                    slug: item.slug,
                    title: item.title,
                    excerpt: item.excerpt,
                    seoTitle: item.seoTitle ?? "",
                    seoDescription: item.seoDescription ?? "",
                    keyword: item.keyword ?? "",
                    cluster: item.cluster ?? "",
                    markdown: body,
                    status: item.status,
                    scheduledAt: item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : "",
                  });
                }}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-left hover:border-lime-300/25"
              >
                <span><span className="block text-sm font-semibold text-white">{item.title}</span><span className="mt-1 block font-mono text-[11px] text-slate-500">/{item.slug}</span></span>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-300">{item.status}</span>
              </button>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="04 / Demand"
          title="Back-in-Stock"
          description="Offene Nachfrage aus GrowVault und priorisierte Produkte."
        >
          {overview.backInStock.length === 0 ? (
            <AdminNotice tone="success">Keine offenen Back-in-Stock-Anfragen.</AdminNotice>
          ) : (
            <div className="space-y-2">
              {overview.backInStock.map((row, index) => (
                <Link
                  key={row.productId}
                  href={`/admin/catalog/${row.productId}`}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-3 hover:border-lime-300/25"
                >
                  <span className="font-mono text-xs text-lime-300">{String(index + 1).padStart(2, "0")}</span>
                  <span className="truncate text-sm font-semibold text-white">{row.productTitle ?? row.productId}</span>
                  <span className="rounded-full bg-lime-300/10 px-2.5 py-1 text-xs font-bold text-lime-200">{row._count._all}</span>
                </Link>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
