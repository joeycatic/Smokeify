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
import { AdminPage } from "@/components/admin/ui";

type AdminPagePreviewsClientProps = {
  previews: AdminPagePreview[];
};

const statusLabel: Record<AdminPagePreviewStatus, string> = {
  ready: "Ready",
  contextual: "Context",
  "missing-context": "Needs data",
};

const statusClassName: Record<AdminPagePreviewStatus, string> = {
  ready: "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]",
  contextual: "border-[#e2a136] bg-[#fff4dd] text-[#81560e]",
  "missing-context": "border-slate-500/20 bg-[var(--adm-surface)] text-[var(--adm-text-muted)]",
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
    <AdminPage layout="console" className="admin-route-frame text-[var(--adm-text)]">
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
                className="inline-flex h-8 items-center justify-center gap-2 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 text-sm font-semibold text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                onClick={() => void copyUrl(selectedPreview.url)}
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy URL
              </button>
              <a
                href={selectedPreview.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-sm font-semibold text-white transition hover:bg-cyan-200"
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
            <label className="flex h-9 items-center gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-sm text-[var(--adm-text-muted)]">
              <MagnifyingGlassIcon className="h-4 w-4 text-[var(--adm-text-faint)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search checkout, auth, orders..."
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)]"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                className="h-8 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-sm text-[var(--adm-text)] outline-none"
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
                className="h-8 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 text-sm text-[var(--adm-text)] outline-none"
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
                        ? "border-cyan-300/35 bg-[var(--adm-primary-soft)]"
                        : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--adm-text)]">{preview.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--adm-text-muted)]">
                          {preview.description}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClassName[preview.status]}`}
                      >
                        {statusLabel[preview.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--adm-text-faint)]">
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
                <div className="rounded-xl border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-8 text-center text-sm text-[var(--adm-text-faint)]">
                  No preview routes match this filter.
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            {selectedPreview ? (
              <>
                <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--adm-text-faint)]">
                        Selected preview
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-[var(--adm-text)]">
                        {selectedPreview.title}
                      </h2>
                      <p className="mt-1 break-all text-xs text-[var(--adm-text-faint)]">{selectedPreview.url}</p>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName[selectedPreview.status]}`}
                    >
                      {statusLabel[selectedPreview.status]}
                    </span>
                  </div>
                  {copyNotice ? (
                    <p className="mt-3 rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] px-3 py-2 text-xs text-[var(--adm-primary)]">
                      {copyNotice}
                    </p>
                  ) : null}
                  {selectedPreview.status !== "ready" ? (
                    <div className="mt-3 flex gap-2 rounded-xl border border-[#e2a136] bg-[#fff4dd] px-3 py-2 text-xs leading-5 text-[#81560e]">
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        {selectedPreview.status === "contextual"
                          ? "This route may need a same-origin admin session or browser checkout state."
                          : "This route is whitelisted, but the sample data is missing."}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-black">
                  <div className="flex items-center justify-between border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 py-2">
                    <p className="text-xs font-semibold text-[var(--adm-text-muted)]">Live frame</p>
                    <p className="truncate text-xs text-[var(--adm-text-faint)]">{selectedPreview.storefrontLabel}</p>
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
              <div className="rounded-xl border border-dashed border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-12 text-center text-sm text-[var(--adm-text-faint)]">
                Select a preview route.
              </div>
            )}
          </div>
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
