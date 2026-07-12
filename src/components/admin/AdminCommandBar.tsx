"use client";

import type { ComponentProps, ComponentType, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { filterAdminCommandActions } from "@/lib/adminCommandActions";
import { fetchAdminJson } from "@/lib/adminClientFetch";
import {
  adminPathSupportsAllStorefrontScope,
  adminPathSupportsStorefrontScope,
  type AdminStorefrontScope,
} from "@/lib/storefronts";

type CommandNavItem = {
  href: string;
  label: string;
  icon: ComponentType<ComponentProps<"svg">>;
  exact?: boolean;
};

type CommandNavGroup = {
  label: string;
  items: CommandNavItem[];
};

type FlattenedCommand = CommandNavItem & {
  id: string;
  group: string;
  hrefWithState: string;
  searchValue: string;
};

type CommandSearchResult = {
  group: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

type DisplayCommand =
  | (FlattenedCommand & {
      kind: "page";
      title: string;
      subtitle: string;
      href: string;
      badge?: string;
    })
  | (CommandSearchResult & {
      kind: "entity";
    })
  | {
      kind: "action";
      id: string;
      group: string;
      title: string;
      subtitle: string;
      href?: string;
      badge?: string;
      run?: () => Promise<void> | void;
    };

type AdminCommandBarProps = {
  groups: CommandNavGroup[];
  pathname: string;
  currentStorefrontScope: AdminStorefrontScope;
};

type SearchCacheEntry = {
  results: CommandSearchResult[];
  createdAt: number;
};

const COMMAND_SEARCH_CACHE_TTL_MS = 30_000;
const commandSearchCache = new Map<string, SearchCacheEntry>();

function buildHref(href: string, currentStorefrontScope: AdminStorefrontScope) {
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
}

function isCurrentPath(pathname: string, item: CommandNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminCommandBar({
  groups,
  pathname,
  currentStorefrontScope,
}: AdminCommandBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [entityResults, setEntityResults] = useState<CommandSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const deferredQuery = useDeferredValue(query);

  const commands = useMemo<FlattenedCommand[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          id: `${group.label}:${item.href}`,
          ...item,
          group: group.label,
          hrefWithState: buildHref(item.href, currentStorefrontScope),
          searchValue: `${item.label} ${group.label} ${item.href.replaceAll("/", " ")}`.toLowerCase(),
        })),
      ),
    [currentStorefrontScope, groups],
  );

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return commands;
    return commands.filter((item) => item.searchValue.includes(normalizedQuery));
  }, [commands, query]);
  const normalizedQuery = deferredQuery.trim();
  const availableHrefs = useMemo(
    () => new Set(commands.map((command) => command.href)),
    [commands],
  );
  const actionCommands = useMemo<DisplayCommand[]>(() => {
    const actions = filterAdminCommandActions({
      query: normalizedQuery,
      availableHrefs,
    });

    return actions.slice(0, normalizedQuery ? undefined : 5).map((action) => ({
      kind: "action" as const,
      id: action.id,
      group: "Actions",
      title: action.queryMatch?.(normalizedQuery)
        ? `${action.label} #${normalizedQuery}`
        : action.label,
      subtitle: action.description,
      href: action.buildHref
        ? action.buildHref(normalizedQuery, currentStorefrontScope)
        : action.href,
      badge: action.badge,
      run:
        action.clientAction === "save-current-view"
          ? async () => {
              setNotice("");
              if (typeof window === "undefined") return;
          const filters = Object.fromEntries(new URLSearchParams(window.location.search));
          const response = await fetch("/api/admin/saved-views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              route: pathname,
              label: document.title?.replace(" | Smokeify", "") || "Saved view",
              filters,
              storefrontScope: currentStorefrontScope,
            }),
          });
          setNotice(response.ok ? "Saved current view." : "Saved view failed.");
            }
          : undefined,
    }));
  }, [availableHrefs, currentStorefrontScope, normalizedQuery, pathname]);

  const displayCommands = useMemo<DisplayCommand[]>(() => {
    const pageResults = filteredCommands.map((item) => ({
      ...item,
      kind: "page" as const,
      title: item.label,
      subtitle: item.group,
      href: item.hrefWithState,
    }));

    if (normalizedQuery.length < 2) {
      return [...actionCommands, ...pageResults];
    }

    return [
      ...actionCommands,
      ...entityResults.map((result) => ({
        ...result,
        kind: "entity" as const,
      })),
      ...pageResults,
    ];
  }, [actionCommands, entityResults, filteredCommands, normalizedQuery.length]);
  const boundedActiveIndex =
    displayCommands.length === 0 ? 0 : Math.min(activeIndex, displayCommands.length - 1);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (normalizedQuery.length < 2) return;

    let active = true;
    const controller = new AbortController();
    const cacheKey = normalizedQuery.toLowerCase();
    const cached = commandSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt <= COMMAND_SEARCH_CACHE_TTL_MS) {
      setEntityResults(cached.results);
      setSearchLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }

    const runSearch = async () => {
      setSearchLoading(true);
      try {
        const { response, data } = await fetchAdminJson<{
          results?: CommandSearchResult[];
        }>(`/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          slowThresholdMs: 4_000,
          slowMessage: "Admin search was slow.",
          slowDetail: "Search results may be delayed while the admin index catches up.",
          failureMessage: "Admin search failed.",
          failureDetail: "Reconnect and retry the command search.",
        });
        if (active) {
          const results = response.ok ? (data.results ?? []) : [];
          commandSearchCache.set(cacheKey, {
            results,
            createdAt: Date.now(),
          });
          setEntityResults(results);
        }
      } catch {
        if (active) {
          setEntityResults([]);
        }
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [normalizedQuery, open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openCommandBar = () => setOpen(true);

  const selectCommand = async (command: DisplayCommand | undefined) => {
    if (!command) return;
    if (command.kind === "action" && command.run) {
      await command.run();
      return;
    }
    if (!command.href) return;
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    setEntityResults([]);
    router.push(command.href);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (displayCommands.length === 0) return;
      setActiveIndex((current) => (current + 1) % displayCommands.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (displayCommands.length === 0) return;
      setActiveIndex((current) =>
        current === 0 ? displayCommands.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void selectCommand(displayCommands[boundedActiveIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openCommandBar}
        className="hidden h-8 min-w-[20rem] items-center gap-3 rounded-[10px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-left text-[13px] text-[var(--adm-text-muted)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)] xl:flex"
        aria-label="Open admin command bar"
      >
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search pages, records, or actions</span>
        <span className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--adm-text-faint)]">
          Ctrl K
        </span>
      </button>

      <button
        type="button"
        onClick={openCommandBar}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-0 text-[13px] font-medium text-[var(--adm-text-muted)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)] sm:w-auto sm:px-3 xl:hidden"
        aria-label="Open admin command bar"
      >
        <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        <span className="hidden sm:inline">Search</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-2.5 py-3 sm:px-4 sm:pt-[10vh]">
          <button
            type="button"
            className="absolute inset-0 bg-[#16241a]/30"
            onClick={() => setOpen(false)}
            aria-label="Close admin command bar"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin command bar"
            className="relative z-10 flex max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[var(--adm-shadow-lg)] sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="flex min-w-0 items-center gap-2.5 border-b border-[var(--adm-border)] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-4">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-[var(--adm-text-faint)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  setQuery(nextQuery);
                  setActiveIndex(0);
                  if (nextQuery.trim().length < 2) {
                    setEntityResults([]);
                    setSearchLoading(false);
                  }
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={
                  normalizedQuery.length >= 2
                    ? "Search pages, orders, customers, products, suppliers..."
                    : "Search admin pages and actions"
                }
                className="h-8 w-full bg-transparent text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)] sm:h-9"
                aria-label="Search admin commands"
              />
              <span className="hidden rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--adm-text-faint)] sm:inline-flex">
                Esc
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto p-2.5 sm:p-3">
              {notice ? (
                <div className="mb-3 rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-4 py-3 text-sm font-medium text-[var(--adm-primary)]">
                  {notice}
                </div>
              ) : null}
              {displayCommands.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-8 text-center text-sm text-[var(--adm-text-faint)]">
                  {normalizedQuery.length >= 2
                    ? "No admin pages or records match that search."
                    : "No admin pages match that search."}
                </div>
              ) : (
                <div className="space-y-1">
                  {displayCommands.map((command, index) => {
                    const Icon = command.kind === "page" ? command.icon : null;
                    const active = index === boundedActiveIndex;
                    const current =
                      command.kind === "page"
                        ? isCurrentPath(pathname, command)
                        : command.href
                          ? pathname === command.href || pathname.startsWith(`${command.href}/`)
                          : false;

                    return (
                      <button
                        key={`${command.group}-${command.id}`}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          void selectCommand(command);
                        }}
                        className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition sm:gap-3 sm:rounded-xl sm:px-4 sm:py-3 ${
                          active
                            ? "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)]"
                            : "border-transparent bg-[var(--adm-surface)] hover:border-[var(--adm-border)] hover:bg-[var(--adm-surface-2)]"
                        }`}
                      >
                        {Icon ? (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)] sm:h-8 sm:w-10 sm:rounded-xl">
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          </span>
                        ) : (
                          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--adm-text-muted)] sm:h-8 sm:min-w-10 sm:rounded-xl sm:px-2 sm:text-[10px] sm:tracking-[0.16em]">
                            {command.group.slice(0, 2)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--adm-text)]">
                            {command.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-[var(--adm-text-faint)]">
                            {command.subtitle}
                          </span>
                        </span>
                        {command.badge ? (
                          <span className="hidden shrink-0 rounded-full border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-text-muted)] sm:inline-flex">
                            {command.badge}
                          </span>
                        ) : null}
                        {current ? (
                          <span className="hidden shrink-0 rounded-full border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--adm-primary)] sm:inline-flex">
                            Current
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {searchLoading && normalizedQuery.length >= 2 ? (
                <div className="mt-3 text-center text-xs text-[var(--adm-text-faint)]">Searching records…</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
