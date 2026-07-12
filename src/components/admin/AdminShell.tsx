"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bars3Icon,
  ClockIcon,
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

const ADMIN_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ADMIN_IDLE_TICK_MS = 1000;
const ADMIN_ACTIVITY_THROTTLE_MS = 1000;
const ADMIN_IDLE_TIMER_VISIBLE_AFTER_MS = 60 * 1000;

type AdminShellProps = {
  children: React.ReactNode;
  userEmail: string | null;
  userRole: "USER" | "ADMIN" | "STAFF";
  fontClassName?: string;
  monoFontClassName?: string;
};

function formatIdleRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function AdminShell({
  children,
  userEmail,
  userRole,
  fontClassName = "",
  monoFontClassName = "",
}: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams?.toString() ?? "";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [idleRemainingMs, setIdleRemainingMs] = useState(ADMIN_IDLE_TIMEOUT_MS);
  const expiresAtRef = useRef(Date.now() + ADMIN_IDLE_TIMEOUT_MS);
  const lastActivityRef = useRef(Date.now());
  const signingOutRef = useRef(false);
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
  const returnTo = `${pathname}${searchParamString ? `?${searchParamString}` : ""}`;
  const adminLoginUrl = `/auth/admin?returnTo=${encodeURIComponent(returnTo)}`;

  const currentTitle = useMemo(() => {
    const hiddenTitle = getAdminHiddenRouteTitle(pathname);
    if (hiddenTitle) return hiddenTitle;

    if (activeItem) return activeItem.label;

    return "Admin";
  }, [activeItem, pathname]);
  const idleElapsedMs = Math.max(0, ADMIN_IDLE_TIMEOUT_MS - idleRemainingMs);
  const showIdleTimer = idleElapsedMs >= ADMIN_IDLE_TIMER_VISIBLE_AFTER_MS;
  const userInitials = (userEmail ?? "A")
    .split(/[@._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

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

  const startAdminSignOut = useCallback(() => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIdleRemainingMs(0);
    void signOut({ callbackUrl: adminLoginUrl });
  }, [adminLoginUrl]);

  const refreshIdleDeadline = useCallback(() => {
    if (signingOutRef.current) return;
    const now = Date.now();
    if (now >= expiresAtRef.current) {
      startAdminSignOut();
      return;
    }
    if (now - lastActivityRef.current < ADMIN_ACTIVITY_THROTTLE_MS) return;
    lastActivityRef.current = now;
    expiresAtRef.current = now + ADMIN_IDLE_TIMEOUT_MS;
    setIdleRemainingMs(ADMIN_IDLE_TIMEOUT_MS);
  }, [startAdminSignOut]);

  useEffect(() => {
    expiresAtRef.current = Date.now() + ADMIN_IDLE_TIMEOUT_MS;
    lastActivityRef.current = Date.now();
    setIdleRemainingMs(ADMIN_IDLE_TIMEOUT_MS);
  }, [pathname, searchParamString]);

  useEffect(() => {
    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
      "scroll",
      "focus",
    ] as const;
    const options: AddEventListenerOptions = { passive: true, capture: true };
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, refreshIdleDeadline, options);
    });

    const intervalId = window.setInterval(() => {
      const remaining = expiresAtRef.current - Date.now();
      setIdleRemainingMs(Math.max(0, remaining));
      if (remaining > 0) return;
      startAdminSignOut();
    }, ADMIN_IDLE_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, refreshIdleDeadline, options);
      });
    };
  }, [refreshIdleDeadline, startAdminSignOut]);

  return (
    <div className={`admin-theme admin-light admin-shell min-h-screen w-full overflow-x-hidden bg-[var(--adm-bg)] text-[var(--adm-text)] ${fontClassName}`}>
      <div className="relative flex min-h-screen">
        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-[#16241a]/30 md:hidden"
            aria-label="Close admin navigation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[18rem] max-w-[calc(100vw-0.5rem)] flex-col border-r border-[var(--adm-border)] bg-[var(--adm-surface)] p-3 transition-transform duration-200 ease-out md:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between border-b border-[var(--adm-border)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--adm-primary)] text-sm font-bold text-[var(--adm-text)]">S</span>
              <div>
                <p className="text-sm font-semibold text-[var(--adm-text)]">Smokeify Admin</p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">{userRole} access</p>
              </div>
            </div>
            <button type="button" className="admin-icon-button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-3 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
            {visibleWorkspaces.map((workspace) => {
              const WorkspaceIcon = workspace.icon;
              return (
                <section key={workspace.id}>
                  <div className="mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">
                    <WorkspaceIcon className="h-4 w-4" />
                    {workspace.label}
                  </div>
                  <div className="space-y-0.5">
                    {workspace.items.map((item) => {
                      const active = isAdminNavItemActive(pathname, item);
                      return (
                        <Link
                          key={item.href}
                          href={navHref(item.href)}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex min-h-8 items-center rounded-[10px] px-3 text-[13px] font-medium transition ${active ? "bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]" : "text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)]"}`}
                          aria-current={active ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </nav>
        </aside>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center border-r border-[var(--adm-border)] bg-[var(--adm-surface)] py-2 md:flex">
          <Link href="/admin" className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--adm-primary)] text-sm font-bold text-[var(--adm-text)]" aria-label="Admin dashboard">S</Link>
          <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Admin workspaces">
            {visibleWorkspaces.map((workspace) => {
              const active = activeWorkspace?.id === workspace.id;
              const WorkspaceIcon = workspace.icon;
              return (
                <Link
                  key={workspace.id}
                  href={navHref(workspace.items[0].href)}
                  className={`admin-rail-link group relative inline-flex h-8 w-10 items-center justify-center rounded-[10px] transition ${active ? "bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]" : "text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)]"}`}
                  aria-label={workspace.label}
                  aria-current={active ? "page" : undefined}
                >
                  <WorkspaceIcon className="h-5 w-5" />
                  <span className="admin-rail-tooltip pointer-events-none absolute left-[3.15rem] z-50 whitespace-nowrap rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--adm-text)] opacity-0 shadow-[var(--adm-shadow)] transition-opacity delay-150 group-hover:opacity-100 group-focus-visible:opacity-100">{workspace.label}</span>
                </Link>
              );
            })}
          </nav>
          <button type="button" className="admin-icon-button mb-2" onClick={() => setSettingsOpen(true)} aria-label="Open admin settings">
            <Cog6ToothIcon className="h-4 w-4" />
          </button>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--adm-primary)] text-[10px] font-bold text-[var(--adm-text)]" onClick={() => setSettingsOpen(true)} aria-label={`Open settings for ${userEmail ?? "admin"}`}>
            {userInitials}
          </button>
        </aside>

        <div className="min-w-0 w-full overflow-x-hidden md:ml-16 md:w-[calc(100%-4rem)]">
          <header className="sticky top-0 z-20 border-b border-[var(--adm-border)] bg-[var(--adm-surface)]">
            <div className="flex h-[52px] min-w-0 items-center gap-2 px-2.5 sm:px-4 lg:px-5">
              <button type="button" className="admin-icon-button shrink-0 md:hidden" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)] sm:block">{activeWorkspace?.label ?? "Internal Console"}</p>
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-base font-semibold leading-5 text-[var(--adm-text)] sm:text-lg">{currentTitle}</h1>
                  <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:inline-flex ${supportsStorefrontScope ? "border-[var(--adm-primary)] text-[var(--adm-primary)]" : "border-[var(--adm-border)] text-[var(--adm-text-muted)]"}`}>{currentStorefrontLabel}</span>
                </div>
              </div>
              <div className="admin-header-controls flex shrink-0 items-center gap-1.5">
                {showIdleTimer ? (
                  <div
                    className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] border px-2 font-mono text-xs font-semibold tabular-nums ${idleRemainingMs <= 60_000 ? "border-[#c0432c44] bg-[#fae7e3] text-[var(--adm-error)]" : idleRemainingMs <= 120_000 ? "border-[#e2a13655] bg-[#fff4dd] text-[#81560e]" : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)]"}`}
                    title="Admin AFK timer resets on activity. At 0:00 you must log in again."
                    aria-label={`Admin AFK logout in ${formatIdleRemaining(idleRemainingMs)}`}
                  >
                    <ClockIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">AFK</span>
                    {formatIdleRemaining(idleRemainingMs)}
                  </div>
                ) : null}
                <AdminCommandBar key={pathname} groups={visibleWorkspaces} pathname={pathname} currentStorefrontScope={currentStorefrontScope} />
                <button type="button" className="admin-icon-button" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)} aria-label="Open admin settings">
                  <Cog6ToothIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            {activeWorkspace && activeWorkspace.items.length > 1 ? (
              <nav className="admin-scroll-x admin-workspace-tabs flex h-8 w-full items-center gap-1 border-t border-[var(--adm-border)] px-2.5 sm:px-4 lg:px-5" aria-label={`${activeWorkspace.label} workspace sections`}>
                {activeWorkspace.items.map((item) => {
                  const active = isAdminNavItemActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={navHref(item.href)} className={`admin-workspace-tab ${active ? "admin-workspace-tab-active" : ""}`} aria-current={active ? "page" : undefined}>
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
            <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-start sm:justify-end sm:p-4">
              <button type="button" className="absolute inset-0 bg-[#16241a]/30" aria-label="Close admin settings" onClick={() => setSettingsOpen(false)} />
              <section role="dialog" aria-modal="true" aria-labelledby="admin-settings-title" className="relative w-full max-w-md rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[var(--adm-text)] shadow-[var(--adm-shadow-lg)] sm:mt-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">Admin Settings</p>
                    <h2 id="admin-settings-title" className="mt-1 text-sm font-semibold">Workspace controls</h2>
                  </div>
                  <button type="button" className="admin-icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><XMarkIcon className="h-5 w-5" /></button>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">Current context</p>
                    <dl className="mt-2 grid gap-2 text-[13px]">
                      {[["Page", currentTitle], ["Workspace", activeWorkspace?.label ?? currentStorefrontLabel], ["User", userEmail ?? "admin"]].map(([label, value]) => (
                        <div key={label} className="flex min-w-0 items-center justify-between gap-3"><dt className="text-[var(--adm-text-muted)]">{label}</dt><dd className="truncate font-medium">{value}</dd></div>
                      ))}
                      {showIdleTimer ? <div className="flex items-center justify-between gap-3"><dt className="text-[var(--adm-text-muted)]">AFK logout</dt><dd className={`font-mono font-semibold tabular-nums ${monoFontClassName}`}>{formatIdleRemaining(idleRemainingMs)}</dd></div> : null}
                    </dl>
                  </div>
                  {supportsStorefrontScope ? (
                    <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--adm-text-faint)]">Storefront scope</p>
                      <div className={`mt-2 grid gap-1 rounded-[10px] bg-[var(--adm-surface-2)] p-1 ${supportsAllStorefrontScope ? "grid-cols-3" : "grid-cols-2"}`}>
                        {(supportsAllStorefrontScope ? (["ALL", "MAIN", "GROW"] as const) : (["MAIN", "GROW"] as const)).map((scope) => (
                          <Link key={scope} href={storefrontHref(scope)} onClick={() => setSettingsOpen(false)} className={`inline-flex h-8 min-w-0 items-center justify-center rounded-[8px] px-2 text-[11px] font-semibold transition ${currentStorefrontScope === scope ? "bg-[var(--adm-primary)] text-[var(--adm-text)]" : "text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface)]"}`}>{ADMIN_STOREFRONT_SCOPE_LABELS[scope]}</Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          <main className="relative min-w-0">
            <div className="admin-route-frame mx-auto w-full max-w-[1680px] px-2 py-2.5 sm:px-4 sm:py-4 lg:px-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
