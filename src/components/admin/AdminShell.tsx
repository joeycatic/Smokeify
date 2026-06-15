"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bars3Icon,
  Cog6ToothIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getActiveAdminNavItem,
  getActiveAdminWorkspace,
  getAdminHiddenRouteTitle,
  getVisibleAdminWorkspaces,
  isAdminNavItemActive,
} from "@/components/admin/adminNavigation";
import {
  ADMIN_STOREFRONT_SCOPE_LABELS,
  adminPathSupportsAllStorefrontScope,
  adminPathSupportsStorefrontScope,
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

type AdminShellProps = {
  children: React.ReactNode;
  userEmail: string | null;
  userRole: "USER" | "ADMIN" | "STAFF";
};

export default function AdminShell({ children, userEmail, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const visibleWorkspaces = useMemo(
    () => getVisibleAdminWorkspaces(userRole),
    [userRole],
  );
  const activeWorkspace = useMemo(
    () => getActiveAdminWorkspace(pathname, visibleWorkspaces),
    [pathname, visibleWorkspaces],
  );
  const activeItem = useMemo(
    () => getActiveAdminNavItem(pathname, visibleWorkspaces, activeWorkspace),
    [activeWorkspace, pathname, visibleWorkspaces],
  );

  const currentTitle = useMemo(() => {
    const hiddenTitle = getAdminHiddenRouteTitle(pathname);
    if (hiddenTitle) return hiddenTitle;

    if (activeItem) return activeItem.label;

    return "Admin";
  }, [activeItem, pathname]);

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
          className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex h-dvh max-h-dvh w-[16.5rem] max-w-[calc(100vw-0.5rem)] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#0a0d12]/95 p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:p-3 md:translate-x-0 ${
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

          <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 sm:mt-3 sm:p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {supportsStorefrontScope ? "Access" : "Workspace"}
                </p>
                <p className="mt-1 text-xs text-slate-400">{currentStorefrontLabel}</p>
              </div>
              {supportsStorefrontScope || dashboardStorefront ? (
                <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                  {currentStorefrontLabel}
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

          <nav className="mt-2.5 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [-ms-overflow-style:none] sm:mt-3 sm:space-y-1.5 [&::-webkit-scrollbar]:hidden">
            {visibleWorkspaces.map((workspace) => {
              const isWorkspaceActive = activeWorkspace?.id === workspace.id;
              const WorkspaceIcon = workspace.icon;
              return (
                <Link
                  key={workspace.id}
                  href={navHref(workspace.items[0].href)}
                  onClick={() => setSidebarOpen(false)}
                  className={`admin-sidebar-workspace ${isWorkspaceActive ? "admin-sidebar-workspace-active" : ""}`}
                  aria-current={isWorkspaceActive ? "page" : undefined}
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <WorkspaceIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{workspace.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">
                        {workspace.description}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      isWorkspaceActive
                        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-slate-500"
                    }`}
                  >
                    {workspace.items.length}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 w-full overflow-x-hidden md:ml-[16.5rem] md:w-[calc(100%-16.5rem)]">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070a]/85 backdrop-blur">
            <div className="flex w-full flex-wrap items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-5 sm:py-2.5 xl:flex-nowrap xl:px-6">
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 md:hidden"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Bars3Icon className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 basis-0 xl:basis-auto">
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:block xl:tracking-[0.3em]">
                  {activeWorkspace?.label ?? "Internal Console"}
                </p>
                <div className="flex min-w-0 items-center gap-1.5 sm:mt-1 sm:flex-wrap sm:gap-2">
                  <h2 className="min-w-0 truncate text-sm font-semibold text-white sm:text-lg">
                    {currentTitle}
                  </h2>
                  <span
                    className={`hidden max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex sm:px-2.5 sm:py-1 sm:text-[11px] ${
                      supportsStorefrontScope
                        ? "border border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
                        : "border border-white/10 bg-white/[0.04] text-slate-300"
                    }`}
                  >
                    {currentStorefrontLabel}
                  </span>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-400 2xl:inline-flex">
                    Workspace tabs preserve existing admin routes
                  </span>
                </div>
              </div>

              <div className="admin-header-controls flex min-w-0 shrink-0 items-center gap-1.5 sm:ml-auto sm:gap-2 xl:w-auto xl:flex-nowrap xl:justify-end">
                <AdminCommandBar
                  key={pathname}
                  groups={visibleWorkspaces}
                  pathname={pathname}
                  currentStorefrontScope={currentStorefrontScope}
                />

                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-0 text-sm font-semibold text-slate-200 transition hover:border-white/15 hover:bg-white/[0.07] sm:h-10 sm:w-auto sm:px-3"
                  aria-haspopup="dialog"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen(true)}
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              </div>
            </div>
            {activeWorkspace && activeWorkspace.items.length > 1 ? (
              <nav
                className="admin-workspace-tabs flex w-full gap-1 overflow-x-auto px-2.5 pb-1.5 sm:px-5 sm:pb-2 xl:px-6"
                aria-label={`${activeWorkspace.label} workspace sections`}
              >
                {activeWorkspace.items.map((item) => {
                  const active = isAdminNavItemActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={navHref(item.href)}
                      className={`admin-workspace-tab ${active ? "admin-workspace-tab-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            ) : null}
            <AdminConnectionStatus />
          </header>

          {settingsOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-start sm:justify-end sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                aria-label="Close admin settings"
                onClick={() => setSettingsOpen(false)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-settings-title"
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#090d12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:mt-12"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Admin Settings
                    </p>
                    <h2 id="admin-settings-title" className="mt-1.5 text-lg font-semibold text-white">
                      Workspace controls
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label="Close settings"
                    onClick={() => setSettingsOpen(false)}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Current context
                    </p>
                    <div className="mt-2 grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Page</span>
                        <span className="truncate font-medium text-slate-100">{currentTitle}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Workspace</span>
                        <span className="truncate font-medium text-slate-100">
                          {activeWorkspace?.label ?? currentStorefrontLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">User</span>
                        <span className="truncate font-medium text-slate-100">{userEmail ?? "admin"}</span>
                      </div>
                    </div>
                  </div>

                  {supportsStorefrontScope ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Storefront scope
                      </p>
                      <div
                        className={`mt-3 grid gap-1 rounded-xl border border-white/10 bg-black/20 p-1 text-xs font-semibold ${
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
                            onClick={() => setSettingsOpen(false)}
                            className={`inline-flex h-10 min-w-0 items-center justify-center rounded-lg px-3 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                              currentStorefrontScope === scope
                                ? "bg-cyan-300/90 text-slate-950"
                                : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
                            }`}
                          >
                            {ADMIN_STOREFRONT_SCOPE_LABELS[scope]}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          <main className="relative">
            <div className="w-full px-2 py-2.5 sm:px-4 sm:py-4 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
