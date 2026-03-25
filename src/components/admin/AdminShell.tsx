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
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  CommandLineIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  PresentationChartLineIcon,
  RectangleGroupIcon,
  SwatchIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import AdminCommandBar from "@/components/admin/AdminCommandBar";

type AdminShellProps = {
  children: React.ReactNode;
  userEmail: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function FlagBadge({ country }: { country: "de" | "gb" }) {
  if (country === "de") {
    return (
      <span
        aria-hidden="true"
        className="h-4 w-6 rounded-[4px] border border-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        style={{
          background:
            "linear-gradient(to bottom, #111827 0 33.333%, #dc2626 33.333% 66.666%, #facc15 66.666% 100%)",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="relative h-4 w-6 overflow-hidden rounded-[4px] border border-white/15 bg-[#012169] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      <span className="absolute inset-0 bg-[linear-gradient(32deg,transparent_43%,white_43%,white_57%,transparent_57%),linear-gradient(148deg,transparent_43%,white_43%,white_57%,transparent_57%),linear-gradient(-32deg,transparent_43%,white_43%,white_57%,transparent_57%),linear-gradient(-148deg,transparent_43%,white_43%,white_57%,transparent_57%)]" />
      <span className="absolute inset-0 bg-[linear-gradient(32deg,transparent_47%,#c8102e_47%,#c8102e_53%,transparent_53%),linear-gradient(148deg,transparent_47%,#c8102e_47%,#c8102e_53%,transparent_53%),linear-gradient(-32deg,transparent_47%,#c8102e_47%,#c8102e_53%,transparent_53%),linear-gradient(-148deg,transparent_47%,#c8102e_47%,#c8102e_53%,transparent_53%)] opacity-90" />
      <span className="absolute left-1/2 top-0 h-full w-[28%] -translate-x-1/2 bg-white" />
      <span className="absolute left-0 top-1/2 h-[28%] w-full -translate-y-1/2 bg-white" />
      <span className="absolute left-1/2 top-0 h-full w-[16%] -translate-x-1/2 bg-[#c8102e]" />
      <span className="absolute left-0 top-1/2 h-[16%] w-full -translate-y-1/2 bg-[#c8102e]" />
    </span>
  );
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: HomeIcon, exact: true },
      { href: "/admin/analytics", label: "Analytics", icon: ChartBarSquareIcon },
      { href: "/admin/audit", label: "Audit Log", icon: ClipboardDocumentListIcon },
    ],
  },
  {
    label: "Control Layer",
    items: [
      { href: "/admin/finance", label: "Finance", icon: BanknotesIcon },
      { href: "/admin/vat", label: "VAT Monitor", icon: CalculatorIcon },
      { href: "/admin/expenses", label: "Expenses", icon: DocumentTextIcon },
      {
        href: "/admin/profitability",
        label: "Profitability",
        icon: PresentationChartLineIcon,
      },
      { href: "/admin/alerts", label: "Alerts", icon: BellAlertIcon },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/catalog", label: "Catalog", icon: CubeIcon },
      { href: "/admin/categories", label: "Categories", icon: SwatchIcon },
      { href: "/admin/collections", label: "Collections", icon: FolderIcon },
      { href: "/admin/discounts", label: "Discounts", icon: TagIcon },
    ],
  },
  {
    label: "Orders",
    items: [
      { href: "/admin/orders", label: "Orders", icon: CreditCardIcon },
      { href: "/admin/returns", label: "Returns", icon: ArchiveBoxIcon },
      {
        href: "/admin/inventory-adjustments",
        label: "Inventory",
        icon: TruckIcon,
      },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/admin/customers", label: "Customers", icon: UsersIcon },
      { href: "/admin/users", label: "Users", icon: UsersIcon },
      { href: "/admin/suppliers", label: "Suppliers", icon: TruckIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/recommendations",
        label: "Recommendations",
        icon: RectangleGroupIcon,
      },
      {
        href: "/admin/scripts",
        label: "Scripts",
        icon: CommandLineIcon,
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
      },
    ],
  },
];

const HIDDEN_ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/admin/catalog/", title: "Product Detail" },
  { prefix: "/admin/users/", title: "User Detail" },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminShell({ children, userEmail }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentLanguage = searchParams?.get("lang") === "de" ? "de" : "en";

  const currentTitle = useMemo(() => {
    const hiddenMatch = HIDDEN_ROUTE_TITLES.find((item) =>
      pathname.startsWith(item.prefix)
    );
    if (hiddenMatch) return hiddenMatch.title;

    for (const group of NAV_GROUPS) {
      const match = group.items.find((item) => isActive(pathname, item));
      if (match) return match.label;
    }

    return "Admin";
  }, [pathname]);

  const languageHref = (nextLanguage: "de" | "en") => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("lang", nextLanguage);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const navHref = (href: string) => {
    const params = new URLSearchParams();
    params.set("lang", currentLanguage);
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  };

  return (
    <div className="admin-shell min-h-screen bg-[#05070a] text-slate-100">
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
          className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex max-h-screen w-[18rem] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#0a0d12]/95 p-4 backdrop-blur md:sticky md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } transition-transform duration-200 ease-out`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">
                Smokeify
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Access
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {userEmail ?? "admin"}
                </p>
                <p className="text-xs text-slate-400">ADMIN only</p>
              </div>
              <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                LIVE SAFE
              </span>
            </div>
          </div>

          <nav className="mt-6 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {NAV_GROUPS.map((group) => (
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

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070a]/85 backdrop-blur">
            <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 md:hidden"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Internal Console
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <h2 className="truncate text-lg font-semibold text-white">
                    {currentTitle}
                  </h2>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400 sm:inline-flex">
                    Admin-only workspace
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AdminCommandBar
                  key={pathname}
                  groups={NAV_GROUPS}
                  pathname={pathname}
                  currentLanguage={currentLanguage}
                />

                <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                  <Link
                    href={languageHref("de")}
                    aria-label="Switch admin page language to German"
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      currentLanguage === "de"
                        ? "bg-cyan-300/90 text-slate-950"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <FlagBadge country="de" />
                  </Link>
                  <Link
                    href={languageHref("en")}
                    aria-label="Switch admin page language to British English"
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                      currentLanguage === "en"
                        ? "bg-cyan-300/90 text-slate-950"
                        : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <FlagBadge country="gb" />
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main className="relative">
            <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
