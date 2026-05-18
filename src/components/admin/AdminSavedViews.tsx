"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookmarkIcon,
  ClockIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { fetchAdminJson } from "@/lib/adminClientFetch";
import type { AdminStorefrontScope } from "@/lib/storefronts";

type SavedView = {
  id: string;
  route: string;
  label: string;
  filters: Record<string, string>;
  storefrontScope: string | null;
  pinned: boolean;
  updatedAt: string;
};

type RecentView = {
  href: string;
  label: string;
  seenAt: number;
};

type Props = {
  pathname: string;
  searchParamsString: string;
  currentTitle: string;
  currentStorefrontScope: AdminStorefrontScope;
};

const RECENT_VIEWS_KEY = "smokeify-admin-recent-views";
const MY_WORK_LINKS = [
  { href: "/admin/support?status=WAITING_CUSTOMER", label: "Waiting support" },
  { href: "/admin/customers?task=1", label: "Customer tasks" },
  { href: "/admin/compliance", label: "Compliance queue" },
  { href: "/admin/alerts", label: "Open alerts" },
];

const buildSavedViewHref = (view: SavedView) => {
  const params = new URLSearchParams(view.filters);
  const query = params.toString();
  return query ? `${view.route}?${query}` : view.route;
};

const readRecentViews = (): RecentView[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentView => {
        if (!entry || typeof entry !== "object") return false;
        const candidate = entry as Partial<RecentView>;
        return (
          typeof candidate.href === "string" &&
          candidate.href.startsWith("/admin") &&
          typeof candidate.label === "string" &&
          typeof candidate.seenAt === "number"
        );
      })
      .slice(0, 8);
  } catch {
    window.localStorage.removeItem(RECENT_VIEWS_KEY);
    return [];
  }
};

export default function AdminSavedViews({
  pathname,
  searchParamsString,
  currentTitle,
  currentStorefrontScope,
}: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const currentHref = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

  useEffect(() => {
    const nextRecent = [
      { href: currentHref, label: currentTitle, seenAt: Date.now() },
      ...readRecentViews().filter((entry) => entry.href !== currentHref),
    ].slice(0, 6);
    window.localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(nextRecent));
    setRecentViews(nextRecent);
  }, [currentHref, currentTitle]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { response, data } = await fetchAdminJson<{ views?: SavedView[] }>(
        `/api/admin/saved-views?route=${encodeURIComponent(pathname)}`,
        {
          failureMessage: "Saved views failed to load.",
          failureDetail: "Use the page normally and retry saved views later.",
        },
      );
      if (active && response.ok) {
        setViews(data.views ?? []);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [pathname]);

  const filters = useMemo(() => Object.fromEntries(new URLSearchParams(searchParamsString)), [
    searchParamsString,
  ]);

  const saveCurrentView = async () => {
    setSaving(true);
    setError("");
    try {
      const { response, data } = await fetchAdminJson<{ view?: SavedView; error?: string }>(
        "/api/admin/saved-views",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            route: pathname,
            label: currentTitle,
            filters,
            storefrontScope: currentStorefrontScope,
            pinned: false,
          }),
          failureMessage: "Saved view failed.",
          failureDetail: "The view was not persisted. Retry after the admin connection recovers.",
        },
      );
      if (!response.ok || !data.view) {
        setError(data.error ?? "Saved view failed.");
        return;
      }
      setViews((current) => [data.view!, ...current.filter((view) => view.id !== data.view!.id)]);
    } finally {
      setSaving(false);
    }
  };

  const togglePinned = async (view: SavedView) => {
    const { response, data } = await fetchAdminJson<{ view?: SavedView }>(
      `/api/admin/saved-views/${view.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !view.pinned }),
        failureMessage: "Saved view update failed.",
        failureDetail: "The pinned state did not persist.",
      },
    );
    if (response.ok && data.view) {
      setViews((current) =>
        current
          .map((entry) => (entry.id === data.view!.id ? data.view! : entry))
          .sort((left, right) => Number(right.pinned) - Number(left.pinned)),
      );
    }
  };

  const deleteView = async (viewId: string) => {
    const { response } = await fetchAdminJson(`/api/admin/saved-views/${viewId}`, {
      method: "DELETE",
      failureMessage: "Saved view delete failed.",
      failureDetail: "The view is still available until deletion succeeds.",
    });
    if (response.ok) {
      setViews((current) => current.filter((view) => view.id !== viewId));
    }
  };

  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <div>
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          My Work
        </p>
        <div className="mt-2 space-y-1">
          {MY_WORK_LINKS.map((view) => (
            <Link
              key={view.href}
              href={view.href}
              className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100"
            >
              <BookmarkIcon className="h-4 w-4 shrink-0 text-slate-600" />
              <span className="truncate">{view.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Saved Views
          </p>
          <button
            type="button"
            onClick={() => void saveCurrentView()}
            disabled={saving}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
            aria-label="Save current admin view"
            title="Save current view"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
        {error ? <p className="mt-2 px-2 text-xs text-rose-200">{error}</p> : null}
        <div className="mt-2 space-y-1">
          {views.slice(0, 5).map((view) => (
            <div
              key={view.id}
              className="group flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
            >
              <button
                type="button"
                onClick={() => void togglePinned(view)}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  view.pinned ? "text-amber-200" : "text-slate-500 hover:text-slate-200"
                }`}
                aria-label={view.pinned ? "Unpin saved view" : "Pin saved view"}
                title={view.pinned ? "Unpin saved view" : "Pin saved view"}
              >
                <BookmarkIcon className="h-4 w-4" />
              </button>
              <Link href={buildSavedViewHref(view)} className="min-w-0 flex-1 truncate">
                {view.label}
              </Link>
              <button
                type="button"
                onClick={() => void deleteView(view.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 opacity-0 transition hover:text-rose-200 group-hover:opacity-100"
                aria-label="Delete saved view"
                title="Delete saved view"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          {views.length === 0 ? (
            <p className="px-2 py-1 text-xs text-slate-600">No saved views for this page.</p>
          ) : null}
        </div>
      </div>

      <div>
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Recent
        </p>
        <div className="mt-2 space-y-1">
          {recentViews.slice(1, 5).map((view) => (
            <Link
              key={view.href}
              href={view.href}
              className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-100"
            >
              <ClockIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{view.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
