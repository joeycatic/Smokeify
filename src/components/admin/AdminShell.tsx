"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  BellAlertIcon,
  BanknotesIcon,
  CalculatorIcon,
  BeakerIcon,
  ChevronDownIcon,
  CheckBadgeIcon,
  ChartBarSquareIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  CommandLineIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  PresentationChartLineIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  SwatchIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  hasAdminScope,
  type AdminScope,
} from "@/lib/adminPermissions";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  adminPathSupportsAllStorefrontScope,
  adminPathSupportsStorefrontScope,
  getStorefrontConfigs,
  parseAdminStorefrontScope,
  storefrontFromAdminPath,
  type AdminStorefrontScope,
} from "@/lib/storefronts";

const AdminCommandBar = dynamic(() => import("@/components/admin/AdminCommandBar"), {
  ssr: false,
});
const AdminConnectionStatus = dynamic(
  () => import("@/components/admin/AdminConnectionStatus"),
  {
    ssr: false,
  },
);
const AdminSavedViews = dynamic(() => import("@/components/admin/AdminSavedViews"), {
  ssr: false,
});

type AdminShellProps = {
  children: React.ReactNode;
  userEmail: string | null;
  userRole: "USER" | "ADMIN" | "STAFF";
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  exact?: boolean;
  scope: AdminScope;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const SIDEBAR_STATE_STORAGE_KEY = "smokeify-admin-sidebar-groups:v2";

const NAV_GROUPS: NavGroup[] = [
  {
    id: "control",
    label: "Control Plane",
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon, exact: true, scope: "dashboard.read" },
      {
        href: "/admin/ops",
        label: "Ops",
        icon: ClipboardDocumentListIcon,
        scope: "ops.read",
      },
      { href: "/admin/alerts", label: "Alerts", icon: BellAlertIcon, scope: "alerts.read" },
      {
        href: "/admin/attribution",
        label: "Attribution",
        icon: DocumentTextIcon,
        scope: "ops.read",
      },
    ],
  },
  {
    id: "storefronts",
    label: "Storefronts",
    items: getStorefrontConfigs().map((storefront) => ({
      href: storefront.adminPath,
      label: storefront.label,
      icon: HomeIcon,
      scope: "analytics.read" as const,
    })),
  },
  {
    id: "commerce",
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: CreditCardIcon, scope: "orders.read" },
      { href: "/admin/catalog", label: "Catalog", icon: CubeIcon, scope: "catalog.read" },
      { href: "/admin/catalog/hygiene", label: "Hygiene", icon: ClipboardDocumentListIcon, scope: "catalog.read" },
      { href: "/admin/categories", label: "Categories", icon: SwatchIcon, scope: "catalog.write" },
      { href: "/admin/collections", label: "Collections", icon: FolderIcon, scope: "catalog.write" },
      { href: "/admin/compliance", label: "Compliance", icon: CheckBadgeIcon, scope: "catalog.write" },
      { href: "/admin/reviews", label: "Reviews", icon: ChatBubbleLeftRightIcon, scope: "catalog.write" },
      { href: "/admin/returns", label: "Returns", icon: ArchiveBoxIcon, scope: "returns.read" },
      {
        href: "/admin/inventory-adjustments",
        label: "Inventory",
        icon: TruckIcon,
        scope: "inventory.read",
      },
      {
        href: "/admin/procurement",
        label: "Procurement",
        icon: TruckIcon,
        scope: "procurement.read",
      },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: ChartBarSquareIcon, scope: "analytics.read" },
      { href: "/admin/landing-page", label: "Landing Page", icon: RectangleStackIcon, scope: "content.landing.manage" },
      { href: "/admin/discounts", label: "Discounts", icon: TagIcon, scope: "discounts.manage" },
      {
        href: "/admin/recommendations",
        label: "Recommendations",
        icon: RectangleGroupIcon,
        scope: "pricing.review",
      },
      {
        href: "/admin/analyzer",
        label: "Analyzer",
        icon: BeakerIcon,
        scope: "ops.read",
      },
      {
        href: "/admin/email-testing",
        label: "Email Testing",
        icon: ArrowTopRightOnSquareIcon,
        scope: "ops.read",
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/admin/finance", label: "Finance", icon: BanknotesIcon, scope: "finance.read" },
      { href: "/admin/reports", label: "Reports", icon: DocumentTextIcon, scope: "finance.read" },
      { href: "/admin/vat", label: "VAT Monitor", icon: CalculatorIcon, scope: "tax.review" },
      { href: "/admin/expenses", label: "Expenses", icon: DocumentTextIcon, scope: "tax.review" },
      {
        href: "/admin/profitability",
        label: "Profitability",
        icon: PresentationChartLineIcon,
        scope: "finance.read",
      },
      { href: "/admin/pricing", label: "Pricing", icon: CalculatorIcon, scope: "pricing.read" },
      { href: "/admin/customers", label: "Customers", icon: UsersIcon, scope: "customers.read" },
      { href: "/admin/suppliers", label: "Suppliers", icon: TruckIcon, scope: "suppliers.read" },
      { href: "/admin/support", label: "Support", icon: ChatBubbleLeftRightIcon, scope: "support.read" },
      {
        href: "/admin/scripts",
        label: "Scripts",
        icon: CommandLineIcon,
        scope: "scripts.execute",
      },
    ],
  },
  {
    id: "access",
    label: "Access",
    items: [
      { href: "/admin/users", label: "Users", icon: UsersIcon, scope: "users.manage" },
      { href: "/admin/audit", label: "Audit Log", icon: ClipboardDocumentListIcon, scope: "audit.read" },
    ],
  },
];

const HIDDEN_ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/catalog/", title: "Product Detail" },
  { prefix: "/admin/users/", title: "User Detail" },
  { prefix: "/admin/procurement/", title: "Purchase Order" },
  { prefix: "/admin/orders/", title: "Order Detail" },
  { prefix: "/admin/compliance/", title: "Compliance Detail" },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/admin/catalog" && pathname.startsWith("/admin/catalog/hygiene")) {
    return false;
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminShell({ children, userEmail, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const dashboardStorefront = storefrontFromAdminPath(pathname);
  const supportsStorefrontScope = adminPathSupportsStorefrontScope(pathname);
  const supportsAllStorefrontScope = adminPathSupportsAllStorefrontScope(pathname);
  const parsedStorefrontScope = supportsStorefrontScope
    ? parseAdminStorefrontScope(searchParams?.get("storefront"))
    : dashboardStorefront ?? "ALL";
  const currentStorefrontScope =
    supportsStorefrontScope && !supportsAllStorefrontScope && parsedStorefrontScope === "ALL"
      ? "MAIN"
      : parsedStorefrontScope;
  const currentStorefrontLabel = supportsStorefrontScope
    ? ADMIN_STOREFRONT_SCOPE_LABELS[currentStorefrontScope]
    : dashboardStorefront
      ? ADMIN_STOREFRONT_SCOPE_LABELS[dashboardStorefront]
    : "All-store workspace";
  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasAdminScope(userRole, item.scope)),
      })).filter((group) => group.items.length > 0),
    [userRole],
  );
  const activeGroupIds = useMemo(
    () =>
      new Set(
        visibleNavGroups
          .filter((group) => group.items.some((item) => isActive(pathname, item)))
          .map((group) => group.id),
      ),
    [pathname, visibleNavGroups],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      setExpandedGroups(
        Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, boolean] => {
            const [, value] = entry;
            return typeof value === "boolean";
          }),
        ),
      );
    } catch {
      window.localStorage.removeItem(SIDEBAR_STATE_STORAGE_KEY);
    }
  }, []);

  const toggleGroup = (groupId: string, isExpanded: boolean) => {
    setExpandedGroups((previous) => {
      const next = {
        ...previous,
        [groupId]: !isExpanded,
      };
      window.localStorage.setItem(SIDEBAR_STATE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const currentTitle = useMemo(() => {
    const hiddenMatch = HIDDEN_ROUTE_TITLES.find((item) =>
      pathname.startsWith(item.prefix),
    );
    if (hiddenMatch) return hiddenMatch.title;

    for (const group of visibleNavGroups) {
      const match = group.items.find((item) => isActive(pathname, item));
      if (match) return match.label;
    }

    return "Admin";
  }, [pathname, visibleNavGroups]);

  const navHref = (href: string) => {
    if (!adminPathSupportsStorefrontScope(href)) {
      return href;
    }
    const nextStorefrontScope =
      adminPathSupportsAllStorefrontScope(href) || currentStorefrontScope !== "ALL"
        ? currentStorefrontScope
        : "MAIN";
    const params = new URLSearchParams();
    params.set("storefront", nextStorefrontScope);
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  };

  const storefrontHref = (nextScope: AdminStorefrontScope) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("storefront", nextScope);
    if (pathname === "/admin/reports") {
      if (nextScope === "ALL") {
        params.delete("sourceStorefront");
      } else {
        params.set("sourceStorefront", nextScope);
      }
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <div className="admin-theme admin-dark admin-shell min-h-screen w-full overflow-x-hidden bg-[#05070a] text-slate-100">
      <div className="admin-shell__backdrop" aria-hidden="true" />
      <div className="relative flex min-h-screen">
        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            aria-label="Close admin navigation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[16.5rem] max-w-[calc(100vw-1rem)] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#0a0d12]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-200 ease-out`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                {supportsStorefrontScope
                  ? currentStorefrontScope === "ALL"
                    ? "All stores"
                    : currentStorefrontLabel
                  : dashboardStorefront
                    ? currentStorefrontLabel
                    : "All stores"}
              </p>
              <h1 className="mt-1.5 text-base font-semibold text-white">Admin</h1>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 md:hidden"
              aria-label="Close navigation"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {supportsStorefrontScope ? "Access" : "Workspace"}
                </p>
                <p className="mt-1 text-xs text-slate-400">{currentStorefrontLabel}</p>
              </div>
              {supportsStorefrontScope || dashboardStorefront ? (
                <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                  {currentStorefrontScope}
                </span>
              ) : (
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                  SHARED
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {userEmail ?? "admin"}
                </p>
                <p className="text-xs text-slate-400">{userRole} access</p>
              </div>
              <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                LIVE SAFE
              </span>
            </div>
          </div>

          <nav className="mt-3 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {visibleNavGroups.map((group) => {
              const hasActiveItem = activeGroupIds.has(group.id);
              const expanded = expandedGroups[group.id] ?? hasActiveItem;
              const panelId = `admin-nav-group-${group.id}`;
              return (
                <section key={group.id} className="admin-sidebar-group">
                  <button
                    type="button"
                    className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                      expanded
                        ? "border-cyan-300/20 bg-cyan-300/10 text-white shadow-[inset_2px_0_0_rgba(103,232,249,0.75)]"
                        : hasActiveItem
                          ? "border-cyan-300/20 bg-white/[0.05] text-cyan-100"
                          : "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(group.id, expanded)}
                  >
                    <span className="font-medium">{group.label}</span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {group.items.length}
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                  {expanded ? (
                    <div id={panelId} className="mt-1 space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActive(pathname, item);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={navHref(item.href)}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                              active
                                ? "border border-cyan-300/20 bg-cyan-300/10 text-white shadow-[inset_2px_0_0_rgba(103,232,249,0.75)]"
                                : "border border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-slate-100"
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
            <AdminSavedViews
              pathname={pathname}
              searchParamsString={searchParams?.toString() ?? ""}
              currentTitle={currentTitle}
              currentStorefrontScope={currentStorefrontScope}
            />
          </nav>
        </aside>

        <div className="min-w-0 w-full overflow-x-hidden md:ml-[16.5rem] md:w-[calc(100%-16.5rem)]">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070a]/85 backdrop-blur">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-2.5 px-3 py-2.5 sm:px-5 xl:flex-nowrap xl:items-center xl:px-6">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 md:hidden"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 basis-full xl:basis-auto">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Internal Console
                </p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-white">
                    {currentTitle}
                  </h2>
                  <span
                    className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      supportsStorefrontScope
                        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                        : "border border-white/10 bg-white/[0.04] text-slate-300"
                    }`}
                  >
                    {currentStorefrontLabel}
                  </span>
                <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400 2xl:inline-flex">
                  Capability-scoped workspace
                </span>
                </div>
              </div>

              <div className="admin-header-controls flex w-full min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:ml-auto xl:w-auto xl:flex-nowrap xl:justify-end">
                <AdminCommandBar
                  key={pathname}
                  groups={visibleNavGroups}
                  pathname={pathname}
                  currentStorefrontScope={currentStorefrontScope}
                />

                {supportsStorefrontScope ? (
                  <div
                    className={`grid w-full shrink-0 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 sm:flex sm:w-auto sm:items-center ${
                      supportsAllStorefrontScope ? "grid-cols-3" : "grid-cols-2"
                    }`}
                  >
                    {(supportsAllStorefrontScope
                      ? (["ALL", "MAIN", "GROW"] as const)
                      : (["MAIN", "GROW"] as const)
                    ).map((scope) => (
                      <Link
                        key={scope}
                        href={storefrontHref(scope)}
                        aria-label={`Switch admin storefront scope to ${ADMIN_STOREFRONT_SCOPE_LABELS[scope]}`}
                        className={`inline-flex h-10 min-w-0 items-center justify-center rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.14em] transition sm:min-w-[3.25rem] sm:tracking-[0.18em] ${
                          currentStorefrontScope === scope
                            ? "bg-cyan-300/90 text-slate-950"
                            : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        {scope === "ALL" ? "All" : scope}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <AdminConnectionStatus />
          </header>

          <main className="relative">
            <div className="mx-auto max-w-[1600px] px-2.5 py-3 sm:px-4 sm:py-4 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
