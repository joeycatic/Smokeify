"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  BellAlertIcon,
  BanknotesIcon,
  CalculatorIcon,
  BeakerIcon,
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
import AdminCommandBar from "@/components/admin/AdminCommandBar";
import {
  hasAdminScope,
  type AdminScope,
} from "@/lib/adminPermissions";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  parseAdminStorefrontScope,
  type AdminStorefrontScope,
} from "@/lib/storefronts";
import AdminConnectionStatus from "@/components/admin/AdminConnectionStatus";

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
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon, exact: true, scope: "dashboard.read" },
      { href: "/admin/analytics", label: "Analytics", icon: ChartBarSquareIcon, scope: "analytics.read" },
      { href: "/admin/audit", label: "Audit Log", icon: ClipboardDocumentListIcon, scope: "audit.read" },
    ],
  },
  {
    label: "Control Layer",
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
      { href: "/admin/alerts", label: "Alerts", icon: BellAlertIcon, scope: "alerts.read" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: CubeIcon, scope: "catalog.read" },
      { href: "/admin/categories", label: "Categories", icon: SwatchIcon, scope: "catalog.write" },
      { href: "/admin/collections", label: "Collections", icon: FolderIcon, scope: "catalog.write" },
      { href: "/admin/landing-page", label: "Landing Page", icon: RectangleStackIcon, scope: "content.landing.manage" },
      { href: "/admin/discounts", label: "Discounts", icon: TagIcon, scope: "discounts.manage" },
      { href: "/admin/reviews", label: "Reviews", icon: ChatBubbleLeftRightIcon, scope: "catalog.write" },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/admin/orders", label: "Orders", icon: CreditCardIcon, scope: "orders.read" },
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
    label: "CRM",
    items: [
      { href: "/admin/customers", label: "Customers", icon: UsersIcon, scope: "customers.read" },
      { href: "/admin/users", label: "Users", icon: UsersIcon, scope: "users.manage" },
      { href: "/admin/suppliers", label: "Suppliers", icon: TruckIcon, scope: "suppliers.read" },
      { href: "/admin/support", label: "Support", icon: ChatBubbleLeftRightIcon, scope: "support.read" },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/recommendations",
        label: "Recommendations",
        icon: RectangleGroupIcon,
        scope: "pricing.review",
      },
      {
        href: "/admin/growvault",
        label: "Growvault",
        icon: HomeIcon,
        scope: "analytics.read",
      },
      {
        href: "/admin/analyzer",
        label: "Analyzer",
        icon: BeakerIcon,
        scope: "ops.read",
      },
      {
        href: "/admin/scripts",
        label: "Scripts",
        icon: CommandLineIcon,
        scope: "scripts.execute",
      },
      {
        href: "/admin/ops",
        label: "Ops",
        icon: ClipboardDocumentListIcon,
        scope: "ops.read",
      },
    ],
  },
  {
    label: "Utilities",
    items: [
      {
        href: "/admin/email-testing",
        label: "Email Testing",
        icon: ArrowTopRightOnSquareIcon,
        scope: "ops.read",
      },
    ],
  },
];

const HIDDEN_ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/catalog/", title: "Product Detail" },
  { prefix: "/admin/users/", title: "User Detail" },
  { prefix: "/admin/procurement/", title: "Purchase Order" },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminShell({ children, userEmail, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentStorefrontScope = parseAdminStorefrontScope(searchParams?.get("storefront"));
  const currentStorefrontLabel = ADMIN_STOREFRONT_SCOPE_LABELS[currentStorefrontScope];
  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => hasAdminScope(userRole, item.scope)),
      })).filter((group) => group.items.length > 0),
    [userRole],
  );

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
    const params = new URLSearchParams();
    params.set("storefront", currentStorefrontScope);
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
    <div className="admin-shell min-h-screen w-full overflow-x-hidden bg-[#05070a] text-slate-100">
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
          className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[18rem] max-w-[calc(100vw-1rem)] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#0a0d12]/95 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur md:translate-x-0 md:p-4 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-200 ease-out`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                {currentStorefrontScope === "ALL" ? "Shared admin" : currentStorefrontLabel}
              </p>
              <h1 className="mt-2 text-lg font-semibold text-white">Admin</h1>
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

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Access
                </p>
                <p className="mt-1 text-xs text-slate-400">{currentStorefrontLabel}</p>
              </div>
              <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                {currentStorefrontScope}
              </span>
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

          <nav className="mt-6 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {visibleNavGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {group.label}
                </p>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={navHref(item.href)}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          active
                            ? "border border-white/10 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                            : "border border-transparent text-slate-400 hover:border-white/8 hover:bg-white/[0.04] hover:text-slate-100"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-x-hidden md:pl-[18rem]">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070a]/85 backdrop-blur">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:flex-nowrap lg:items-center lg:px-8">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 md:hidden"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 basis-full lg:basis-auto">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Internal Console
                </p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <h2 className="truncate text-lg font-semibold text-white">
                    {currentTitle}
                  </h2>
                  <span className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 sm:inline-flex">
                    {currentStorefrontLabel}
                  </span>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400 sm:inline-flex">
                    Capability-scoped workspace
                  </span>
                </div>
              </div>

              <div className="admin-header-controls -mx-3 flex w-[calc(100%+1.5rem)] min-w-0 items-center gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:w-auto sm:pb-0 lg:ml-auto lg:flex-nowrap lg:justify-end lg:overflow-visible lg:px-0">
                <AdminCommandBar
                  key={pathname}
                  groups={visibleNavGroups}
                  pathname={pathname}
                  currentStorefrontScope={currentStorefrontScope}
                />

                <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  {(["ALL", "MAIN", "GROW"] as const).map((scope) => (
                    <Link
                      key={scope}
                      href={storefrontHref(scope)}
                      aria-label={`Switch admin storefront scope to ${ADMIN_STOREFRONT_SCOPE_LABELS[scope]}`}
                      className={`inline-flex h-10 min-w-[3.25rem] items-center justify-center rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.14em] transition sm:tracking-[0.18em] ${
                        currentStorefrontScope === scope
                          ? "bg-cyan-300/90 text-slate-950"
                          : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      {scope === "ALL" ? "All" : scope}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <AdminConnectionStatus />
          </header>

          <main className="relative">
            <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
