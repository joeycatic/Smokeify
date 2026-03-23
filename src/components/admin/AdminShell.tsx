"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  ChartBarSquareIcon,
  ClipboardDocumentListIcon,
  CreditCardIcon,
  CubeIcon,
  FolderIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  SwatchIcon,
  TagIcon,
  TruckIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          className={`admin-sidebar fixed inset-y-0 left-0 z-40 w-[18rem] shrink-0 border-r border-white/10 bg-[#0a0d12]/95 p-4 backdrop-blur md:sticky md:translate-x-0 ${
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

          <nav className="mt-6 space-y-6">
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
                        href={item.href}
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

              <div className="hidden min-w-[18rem] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-400 lg:flex">
                <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
                <span>Command bar placeholder</span>
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
