"use client";

import type { ComponentProps, ComponentType, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import type { AdminStorefrontScope } from "@/lib/storefronts";

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
    });

type AdminCommandBarProps = {
  groups: CommandNavGroup[];
  pathname: string;
  currentStorefrontScope: AdminStorefrontScope;
};

function buildHref(href: string, currentStorefrontScope: AdminStorefrontScope) {
  const params = new URLSearchParams();
  params.set("storefront", currentStorefrontScope);
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
  const normalizedQuery = query.trim();
  const displayCommands = useMemo<DisplayCommand[]>(() => {
    const pageResults = filteredCommands.map((item) => ({
      ...item,
      kind: "page" as const,
      title: item.label,
      subtitle: item.group,
      href: item.hrefWithState,
    }));

    if (normalizedQuery.length < 2) {
      return pageResults;
    }

    return [
      ...entityResults.map((result) => ({
        ...result,
        kind: "entity" as const,
      })),
      ...pageResults,
    ];
  }, [entityResults, filteredCommands, normalizedQuery.length]);
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

    const runSearch = async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as {
          results?: CommandSearchResult[];
        };
        if (active) {
          setEntityResults(data.results ?? []);
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

    void runSearch();

    return () => {
      active = false;
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

  const selectCommand = (command: DisplayCommand | undefined) => {
    if (!command) return;
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
      selectCommand(displayCommands[boundedActiveIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openCommandBar}
        className="hidden min-w-[20rem] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-slate-400 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-slate-200 lg:flex"
        aria-label="Open admin command bar"
      >
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Jump to workspace or page</span>
        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-500">
          Ctrl K
        </span>
      </button>

      <button
        type="button"
        onClick={openCommandBar}
        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition hover:border-white/15 hover:bg-white/[0.05] hover:text-white lg:hidden"
        aria-label="Open admin command bar"
      >
        <MagnifyingGlassIcon className="h-5 w-5" />
        <span className="hidden min-[360px]:inline">Search</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-3 py-4 sm:px-4 sm:pt-[10vh]">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close admin command bar"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin command bar"
            className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#090d12]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px]"
          >
            <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-3 py-3 sm:px-4 sm:py-4">
              <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-slate-500" />
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
                    : "Search admin pages"
                }
                className="h-11 w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                aria-label="Search admin commands"
              />
              <span className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-500 sm:inline-flex">
                Esc
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto p-3">
              {displayCommands.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
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
                        : pathname === command.href || pathname.startsWith(`${command.href}/`);

                    return (
                      <button
                        key={`${command.group}-${command.id}`}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectCommand(command)}
                        className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition sm:px-4 ${
                          active
                            ? "border-cyan-400/20 bg-cyan-400/10"
                            : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                        }`}
                      >
                        {Icon ? (
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                            <Icon className="h-5 w-5" />
                          </span>
                        ) : (
                          <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                            {command.group.slice(0, 2)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {command.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {command.subtitle}
                          </span>
                        </span>
                        {command.badge ? (
                          <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300 sm:inline-flex">
                            {command.badge}
                          </span>
                        ) : null}
                        {current ? (
                          <span className="hidden shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 sm:inline-flex">
                            Current
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {searchLoading && normalizedQuery.length >= 2 ? (
                <div className="mt-3 text-center text-xs text-slate-500">Searching records…</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
