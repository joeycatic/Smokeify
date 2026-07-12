import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminStorefrontDashboard } from "@/components/admin/AdminStorefrontDashboard";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getAdminStorefrontDashboardData } from "@/lib/adminStorefrontDashboard";
import {
  getGrowvaultSharedDiagnosticsFeed,
  getGrowvaultSharedMerchandisingFeed,
} from "@/lib/growvaultSharedStorefront";
import { getGrowvaultWishlistAdminAnalytics } from "@/lib/growvaultWishlistAdmin";
import { getGrowvaultChatbotConfig } from "@/lib/growvaultChatbot";
import { getGrowvaultChatbotAnalytics } from "@/lib/growvaultChatbotAdmin";
import { hasAdminScope } from "@/lib/adminPermissions";
import { parseAdminTimeRangeDays } from "@/lib/adminTimeRange";
import GrowvaultChatbotPanel from "./GrowvaultChatbotPanel";
import { AdminPage } from "@/components/admin/ui";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const statusToneClass = {
  ok: "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
  warn: "border-[#e2a136] bg-[#fff4dd] text-[#81560e]",
  fail: "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]",
  unknown: "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]",
} as const;

function WishlistProductList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getGrowvaultWishlistAdminAnalytics>>["analytics"]["topProducts"];
}) {
  if (rows.length === 0) {
    return <AdminEmptyState copy="Noch keine Growvault Wishlist-Produktdaten im gewählten Zeitraum." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Link
          key={row.productId}
          href={`/admin/catalog/${row.productId}?storefront=GROW`}
          className="block rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4 transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--adm-text)]">{row.title}</div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--adm-text-muted)]">
                <span>{row.currentWishlists} aktuell gemerkt</span>
                <span>{row.addEvents} Add-Events</span>
                <span>{row.removeEvents} Remove-Events</span>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-[var(--adm-text-muted)]">
              <div>Netto {row.netEvents >= 0 ? `+${row.netEvents}` : row.netEvents}</div>
              <div className="mt-1">
                {row.lastActivityAt ? formatDate(row.lastActivityAt) : "Keine Aktivität"}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function WishlistUserList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof getGrowvaultWishlistAdminAnalytics>>["analytics"]["topUsers"];
}) {
  if (rows.length === 0) {
    return <AdminEmptyState copy="Noch keine Growvault Wishlist-Nutzeraktivität im gewählten Zeitraum." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.userId}
          className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--adm-text)]">
                {row.name ?? row.email ?? `User ${row.userId.slice(0, 8)}`}
              </div>
              <div className="mt-1 truncate text-xs text-[var(--adm-text-faint)]">
                {row.email ?? "Keine E-Mail verfügbar"}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--adm-text-muted)]">
                <span>{row.currentWishlistItems} aktuell auf Wishlist</span>
                <span>{row.addEvents} Adds</span>
                <span>{row.removeEvents} Removes</span>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-[var(--adm-text-muted)]">
              <div>Netto {row.netEvents >= 0 ? `+${row.netEvents}` : row.netEvents}</div>
              <div className="mt-1">
                {row.lastActivityAt ? formatDate(row.lastActivityAt) : "Keine Aktivität"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AdminGrowvaultPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminScope("analytics.read");
  if (!admin) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const days = parseAdminTimeRangeDays(resolvedSearchParams?.days);

  const [dashboardData, diagnostics, merchandising, wishlistAnalytics, chatbotConfig, chatbotAnalytics] = await Promise.all([
    getAdminStorefrontDashboardData({ storefront: "GROW", days }),
    getGrowvaultSharedDiagnosticsFeed(),
    getGrowvaultSharedMerchandisingFeed(),
    getGrowvaultWishlistAdminAnalytics(days),
    getGrowvaultChatbotConfig(),
    getGrowvaultChatbotAnalytics(days),
  ]);

  return (
    <AdminPage layout="dashboard">
        <AdminStorefrontDashboard data={dashboardData} pathname="/admin/growvault" />

        <GrowvaultChatbotPanel
          initialConfig={chatbotConfig}
          analytics={chatbotAnalytics.analytics}
          analyticsError={chatbotAnalytics.error ?? null}
          canManage={hasAdminScope(admin.user.role, "ops.write")}
        />

        <AdminPanel
          eyebrow="Wishlist"
          title="Growvault Wunschlisten-Aktivität"
          description="Audited add/remove activity from the Growvault storefront and mobile app, aggregated for product pressure and user behavior."
        >
          {!wishlistAnalytics.ok ? (
            <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Die Growvault Wishlist-Analytics konnten nicht geladen werden.
              {wishlistAnalytics.error ? ` ${wishlistAnalytics.error}` : ""}
              {wishlistAnalytics.targetUrl ? ` Bridge target: ${wishlistAnalytics.targetUrl}.` : ""}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Aktive Wishlist-Items"
              value={String(wishlistAnalytics.analytics.summary.activeWishlistItems)}
              footnote="Aktuell gespeicherte Produkt-User Zuordnungen"
              tone="slate"
            />
            <AdminMetricCard
              label="Aktive Nutzer"
              value={String(wishlistAnalytics.analytics.summary.activeWishlistUsers)}
              footnote="Nutzer mit mindestens einem aktuellen Wishlist-Eintrag"
              tone="violet"
            />
            <AdminMetricCard
              label="Add-Events"
              value={String(wishlistAnalytics.analytics.summary.addEvents)}
              detail={`${wishlistAnalytics.analytics.summary.removeEvents} Removes`}
              footnote={`${wishlistAnalytics.analytics.summary.uniqueActors} aktive Akteure im Fenster`}
              tone="emerald"
            />
            <AdminMetricCard
              label="Wishlist-Größe"
              value={String(wishlistAnalytics.analytics.summary.largestWishlistSize)}
              detail={`Ø ${wishlistAnalytics.analytics.summary.avgWishlistSize}`}
              footnote="Größte und durchschnittliche aktuelle Wishlist pro Nutzer"
              tone="amber"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <AdminPanel
              title="Top gemerkte Produkte"
              description="Aktuell häufig gemerkte Growvault Produkte mit Event-Kontext."
              className="p-0 shadow-none"
            >
              <div className="p-4 sm:p-5">
                <WishlistProductList rows={wishlistAnalytics.analytics.topProducts} />
              </div>
            </AdminPanel>

            <AdminPanel
              title="Aktivste Nutzer"
              description="Wer im Zeitraum am meisten wishlistet oder abbaut."
              className="p-0 shadow-none"
            >
              <div className="p-4 sm:p-5">
                <WishlistUserList rows={wishlistAnalytics.analytics.topUsers} />
              </div>
            </AdminPanel>
          </div>

          <div className="mt-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[var(--adm-text)]">Letzte Wishlist-Aktionen</h3>
              <p className="mt-1 text-sm text-[var(--adm-text-muted)]">
                Zeitraum ab {formatDate(wishlistAnalytics.analytics.window.startsAt)}.
              </p>
            </div>
            {wishlistAnalytics.analytics.recentActivity.length === 0 ? (
              <AdminEmptyState copy="Keine Wishlist-Aktivität im gewählten Zeitraum." />
            ) : (
              <div className="space-y-3">
                {wishlistAnalytics.analytics.recentActivity.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                              row.action === "ADD"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                : "border-rose-400/20 bg-rose-400/10 text-rose-200"
                            }`}
                          >
                            {row.action === "ADD" ? "Add" : "Remove"}
                          </span>
                          <span className="rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-muted)]">
                            {row.source}
                          </span>
                        </div>
                        <div className="mt-3 text-sm font-semibold text-[var(--adm-text)]">
                          {row.name ?? row.email ?? `User ${row.userId.slice(0, 8)}`}
                        </div>
                        <div className="mt-1 text-xs text-[var(--adm-text-faint)]">
                          {row.email ?? "Keine E-Mail verfügbar"}
                        </div>
                        <div className="mt-3 text-sm text-[var(--adm-text-muted)]">
                          {row.productHandle ? (
                            <Link
                              href={`/admin/catalog/${row.productId}?storefront=GROW`}
                              className="font-semibold text-[var(--adm-text)] underline-offset-4 hover:underline"
                            >
                              {row.productTitle}
                            </Link>
                          ) : (
                            <span className="font-semibold text-[var(--adm-text)]">{row.productTitle}</span>
                          )}{" "}
                          wurde {row.action === "ADD" ? "gemerkt" : "entfernt"}.
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-[var(--adm-text-muted)]">
                        {formatDateTime(row.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Diagnostik"
          title="Operative Statussignale"
          description="Maschinenlesbare GrowVault Signale aus dem Shared-Storefront-Vertrag."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {diagnostics.statuses.map((status) => (
              <div
                key={status.key}
                className={`rounded-2xl border p-4 ${statusToneClass[status.status]}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-current/20 bg-[var(--adm-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                    {status.status}
                  </span>
                  <span className="text-xs opacity-75">
                    {status.category ?? "diagnostics"} · {status.owner ?? status.source}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold">{status.key}</p>
                <p className="mt-2 text-sm opacity-85">{status.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-75">
                  <span>Updated {formatDate(status.updatedAt)}</span>
                  {typeof status.affectedCount === "number" ? (
                    <span>{status.affectedCount} affected</span>
                  ) : null}
                </div>
                {status.impact ? (
                  <p className="mt-2 text-xs opacity-75">{status.impact}</p>
                ) : null}
                {status.actionUrl ? (
                  <a
                    href={status.actionUrl}
                    className="mt-3 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
                  >
                    {status.actionLabel ?? "Workspace öffnen"}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Merchandising"
          title="Shared Merchandising Feed"
          description="GrowVault Homepage-Slots, die im Smokeify Admin gepflegt und in den Feed exportiert werden."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {merchandising.slots.map((slot) => (
              <div
                key={slot.slotKey}
                className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--adm-text-faint)]">
                  {slot.slotKey}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--adm-text)]">
                  {slot.copy?.title ?? slot.slotKey}
                </p>
                <p className="mt-2 text-sm text-[var(--adm-text-muted)]">
                  {slot.productHandles.length} Produkt-Handle(s) im Live-Feed.
                </p>
              </div>
            ))}
          </div>
        </AdminPanel>
    </AdminPage>
  );
}
