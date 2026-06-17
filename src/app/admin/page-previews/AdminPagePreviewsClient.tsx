"use client";

import { useMemo, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import type { AdminPagePreview, AdminPagePreviewStatus } from "@/lib/adminPagePreviews";
import {
  AdminCompactMetric,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";

type AdminPagePreviewsClientProps = {
  previews: AdminPagePreview[];
};

const statusLabel: Record<AdminPagePreviewStatus, string> = {
  ready: "Ready",
  contextual: "Context",
  "missing-context": "Needs data",
};

const statusClassName: Record<AdminPagePreviewStatus, string> = {
  ready: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  contextual: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  "missing-context": "border-slate-500/20 bg-white/[0.03] text-slate-400",
};

export default function AdminPagePreviewsClient({
  previews,
}: AdminPagePreviewsClientProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [storefront, setStorefront] = useState("All");
  const [selectedId, setSelectedId] = useState(previews[0]?.id ?? "");
  const [copyNotice, setCopyNotice] = useState("");

  const groups = useMemo(
    () => ["All", ...Array.from(new Set(previews.map((preview) => preview.group)))],
    [previews],
  );
  const storefronts = useMemo(
    () => ["All", ...Array.from(new Set(previews.map((preview) => preview.storefrontLabel)))],
    [previews],
  );
  const filteredPreviews = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return previews.filter((preview) => {
      const matchesGroup = group === "All" || preview.group === group;
      const matchesStorefront = storefront === "All" || preview.storefrontLabel === storefront;
      const searchValue = [
        preview.title,
        preview.description,
        preview.group,
        preview.storefrontLabel,
        preview.path,
        preview.source,
        ...preview.tags,
      ]
        .join(" ")
        .toLowerCase();
      return matchesGroup && matchesStorefront && (!normalized || searchValue.includes(normalized));
    });
  }, [group, previews, query, storefront]);
  const selectedPreview =
    previews.find((preview) => preview.id === selectedId) ?? filteredPreviews[0] ?? previews[0];

  const readyCount = previews.filter((preview) => preview.status === "ready").length;
  const contextualCount = previews.filter((preview) => preview.status === "contextual").length;
  const missingCount = previews.filter((preview) => preview.status === "missing-context").length;

  const copyUrl = async (url: string) => {
    setCopyNotice("");
    try {
      await navigator.clipboard.writeText(url);
      setCopyNotice("Copied preview URL.");
    } catch {
      setCopyNotice("Copy failed. Open the page and copy it from the address bar.");
    }
  };

  return (
    <div className="admin-route-frame space-y-5 text-slate-100">
      <AdminPageIntro
        eyebrow="Utilities"
        title="Page previews"
        description="A whitelisted preview wall for checkout, auth, system, and storefront pages that are awkward to reach during normal admin work."
        metrics={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminCompactMetric label="Preview routes" value={String(previews.length)} />
            <AdminCompactMetric label="Ready now" value={String(readyCount)} />
            <AdminCompactMetric label="Context-dependent" value={String(contextualCount)} />
            <AdminCompactMetric label="Needs seed data" value={String(missingCount)} />
          </div>
        }
      />

      <AdminPanel
        eyebrow="Whitelist"
        title="Preview browser"
        description="Filter known states, copy URLs, or open the selected page in a dedicated tab."
        actions={
          selectedPreview ? (
            <>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                onClick={() => void copyUrl(selectedPreview.url)}
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy URL
              </button>
              <a
                href={selectedPreview.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open page
              </a>
            </>
          ) : null
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
          <div className="space-y-3">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-300">
              <MagnifyingGlassIcon className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search checkout, auth, orders..."
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-[#070b11] px-3 text-sm text-slate-200 outline-none"
                aria-label="Filter by preview group"
              >
                {groups.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <select
                value={storefront}
                onChange={(event) => setStorefront(event.target.value)}
                className="h-10 rounded-xl border border-white/10 bg-[#070b11] px-3 text-sm text-slate-200 outline-none"
                aria-label="Filter by storefront"
              >
                {storefronts.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
              {filteredPreviews.map((preview) => {
                const selected = selectedPreview?.id === preview.id;
                return (
                  <button
                    key={preview.id}
                    type="button"
                    onClick={() => setSelectedId(preview.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-cyan-300/35 bg-cyan-300/10"
                        : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{preview.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                          {preview.description}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClassName[preview.status]}`}
                      >
                        {statusLabel[preview.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{preview.storefrontLabel}</span>
                      <span>/</span>
                      <span>{preview.group}</span>
                      <span>/</span>
                      <span className="truncate">{preview.path}</span>
                    </div>
                  </button>
                );
              })}
              {filteredPreviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
                  No preview routes match this filter.
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {selectedPreview ? (
              <>
                <div className="rounded-xl border border-white/10 bg-[#070b11] p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Selected preview
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-white">
                        {selectedPreview.title}
                      </h2>
                      <p className="mt-1 break-all text-xs text-slate-500">{selectedPreview.url}</p>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName[selectedPreview.status]}`}
                    >
                      {statusLabel[selectedPreview.status]}
                    </span>
                  </div>
                  {copyNotice ? (
                    <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                      {copyNotice}
                    </p>
                  ) : null}
                  {selectedPreview.status !== "ready" ? (
                    <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        {selectedPreview.status === "contextual"
                          ? "This route may need a same-origin admin session or browser checkout state."
                          : "This route is whitelisted, but the sample data is missing."}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs font-semibold text-slate-400">Live frame</p>
                    <p className="truncate text-xs text-slate-500">{selectedPreview.storefrontLabel}</p>
                  </div>
                  <iframe
                    key={selectedPreview.id}
                    src={selectedPreview.url}
                    title={`${selectedPreview.title} preview`}
                    className="h-[34rem] w-full bg-white"
                    loading="lazy"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-12 text-center text-sm text-slate-500">
                Select a preview route.
              </div>
            )}
          </div>
        </div>
      </AdminPanel>
    </div>
  );
}
