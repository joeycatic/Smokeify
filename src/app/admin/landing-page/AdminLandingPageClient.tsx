"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminMetricCard,
  AdminNotice,
  AdminPageIntro,
  AdminPanel,
} from "@/components/admin/AdminWorkspace";
import { STOREFRONT_LABELS, type StorefrontCode } from "@/lib/storefronts";

type LandingPageProduct = {
  id: string;
  title: string;
  handle: string;
  manufacturer: string | null;
  status: string;
  storefronts: string[];
  imageUrl: string | null;
};

type LandingPageSection = {
  storefront: StorefrontCode;
  key: string;
  title: string;
  description: string;
  maxItems: number;
  isManual: boolean;
  draftIsManual: boolean;
  updatedAt: string | null;
  lastPublishedAt: string | null;
  scheduledPublishAt: string | null;
  publishedRevisionId: string | null;
  scheduledRevisionId: string | null;
  scheduledDraftDiffers: boolean;
  scheduledRevision: {
    id: string;
    isManual: boolean;
    productIds: string[];
    createdAt: string;
    createdByEmail: string | null;
  } | null;
  products: LandingPageProduct[];
  draftProducts: LandingPageProduct[];
  revisions: Array<{
    id: string;
    isManual: boolean;
    productIds: string[];
    createdAt: string;
    createdByEmail: string | null;
  }>;
};

type ProductSearchResult = {
  id: string;
  title: string;
  handle: string;
  manufacturer: string | null;
  storefronts: string[];
  imageUrl: string | null;
};

type Props = {
  initialSections: LandingPageSection[];
  initialScheduledSections: LandingPageSection[];
  initialStorefront: StorefrontCode;
};

const toLocalDateTimeInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const areDraftsEqual = (left: LandingPageSection, right: LandingPageSection) =>
  left.draftIsManual === right.draftIsManual &&
  left.draftProducts.length === right.draftProducts.length &&
  left.draftProducts.every((product, index) => product.id === right.draftProducts[index]?.id);

const getSectionActionKey = (storefront: StorefrontCode, key: string) => `${storefront}:${key}`;

const pickDefined = <T,>(value: T | undefined, fallback: T) =>
  value === undefined ? fallback : value;

function LandingPageSectionEditor({
  section,
  initialSection,
  storefront,
  storefrontLabel,
  saving,
  acting,
  onToggleManual,
  onAddProduct,
  onMoveProduct,
  onRemoveProduct,
  onReset,
  onSave,
  onPublish,
  onSchedule,
  onClearSchedule,
  onRestoreDraft,
  onRestoreLive,
}: {
  section: LandingPageSection;
  initialSection: LandingPageSection;
  storefront: StorefrontCode;
  storefrontLabel: string;
  saving: boolean;
  acting: boolean;
  onToggleManual: (value: boolean) => void;
  onAddProduct: (product: ProductSearchResult) => void;
  onMoveProduct: (fromIndex: number, toIndex: number) => void;
  onRemoveProduct: (productId: string) => void;
  onReset: () => void;
  onSave: () => void;
  onPublish: () => void;
  onSchedule: (value: string) => void;
  onClearSchedule: () => void;
  onRestoreDraft: (revisionId: string) => void;
  onRestoreLive: (revisionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(toLocalDateTimeInput(section.scheduledPublishAt));

  useEffect(() => {
    setScheduleAt(toLocalDateTimeInput(section.scheduledPublishAt));
  }, [section.scheduledPublishAt]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/products/search?q=${encodeURIComponent(query.trim())}&storefront=${storefront}`,
          { signal: controller.signal },
        );
        const data = (await response.json().catch(() => [])) as ProductSearchResult[];
        if (!controller.signal.aborted) {
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query, storefront]);

  const isDirty = !areDraftsEqual(section, initialSection);
  const selectedIds = new Set(section.draftProducts.map((product) => product.id));

  return (
    <AdminPanel
      eyebrow="Homepage section"
      title={section.title}
      description={section.description}
      actions={
        <div className="flex flex-col items-end gap-1 text-right text-xs text-slate-400">
          <span>{section.draftProducts.length}/{section.maxItems} in draft</span>
          {section.lastPublishedAt ? (
            <span>Published {new Date(section.lastPublishedAt).toLocaleString("de-DE")}</span>
          ) : null}
          {section.scheduledPublishAt ? (
            <>
              <span className="text-cyan-200">
                Scheduled {new Date(section.scheduledPublishAt).toLocaleString("de-DE")}
              </span>
              {section.scheduledRevision ? (
                <span className="text-slate-400">
                  Revision {section.scheduledRevision.id.slice(0, 8)}
                  {section.scheduledDraftDiffers ? " · draft changed since scheduling" : ""}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Live
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {section.isManual ? "Manual section is live" : "Automatic fallback is live"}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {section.products.length} product(s) are currently visible on the storefront.
            </div>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Draft
            </div>
            <div className="mt-2 text-sm font-semibold text-white">
              {section.draftIsManual ? "Manual draft ready" : "Draft keeps automatic fallback"}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Save changes here first, then preview, publish, or schedule them.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">Draft manual override</div>
            <div className="mt-1 text-sm text-slate-400">
              {section.draftIsManual
                ? "The draft will use the exact product order saved here."
                : "The draft will fall back to the automatic default selection."}
            </div>
          </div>
          <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-200">
            <input
              type="checkbox"
              checked={section.draftIsManual}
              onChange={(event) => onToggleManual(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5"
            />
            Manual draft
          </label>
        </div>

        <div className="space-y-3">
          {section.draftProducts.length > 0 ? (
            section.draftProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#070a0f] p-3"
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{product.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    /products/{product.handle}
                    {product.manufacturer ? ` · ${product.manufacturer}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                      {product.status}
                    </span>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                      {product.storefronts
                        .map((entry) => STOREFRONT_LABELS[entry as StorefrontCode] ?? entry)
                        .join(" + ")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMoveProduct(index, index - 1)}
                    disabled={index === 0}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                    aria-label={`Move ${product.title} up`}
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveProduct(index, index + 1)}
                    disabled={index === section.draftProducts.length - 1}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-40"
                    aria-label={`Move ${product.title} down`}
                  >
                    <ArrowDownIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveProduct(product.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-200 transition hover:bg-red-400/15"
                    aria-label={`Remove ${product.title}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-sm text-slate-500">
              No draft products selected. Add products below, then save the draft before you publish.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <AdminField label="Search products">
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <AdminInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Find active ${storefrontLabel} products to feature on the homepage`}
                className="pl-11"
              />
            </div>
          </AdminField>
          <div className="mt-3 space-y-2">
            {searching ? <div className="text-sm text-slate-500">Searching products...</div> : null}
            {!searching && query.trim() && searchResults.length === 0 ? (
              <div className="text-sm text-slate-500">
                No matching active {storefrontLabel} products found.
              </div>
            ) : null}
            {searchResults.map((result) => {
              const alreadySelected = selectedIds.has(result.id);
              const isFull = section.draftProducts.length >= section.maxItems;
              return (
                <div
                  key={result.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#070a0f] px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {result.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">/products/{result.handle}</div>
                  </div>
                  <AdminButton
                    tone="secondary"
                    disabled={alreadySelected || isFull}
                    onClick={() => onAddProduct(result)}
                  >
                    {alreadySelected ? "Added" : isFull ? "Full" : "Add"}
                  </AdminButton>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarDaysIcon className="h-4 w-4 text-cyan-200" />
            Publishing controls
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <AdminInput
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
            <AdminButton
              tone="secondary"
              disabled={saving || acting}
              onClick={() => onSchedule(scheduleAt)}
            >
              {acting ? "Working..." : "Schedule"}
            </AdminButton>
            <AdminButton
              tone="secondary"
              disabled={!section.scheduledPublishAt || saving || acting}
              onClick={onClearSchedule}
            >
              Clear schedule
            </AdminButton>
          </div>
          <div className="mt-3 text-sm text-slate-400">
            Publishing uses the saved draft state. Save the draft first if you changed products or override mode.
          </div>
          {section.scheduledRevision ? (
            <div className="mt-2 text-xs text-cyan-200/80">
              Scheduled publish is pinned to revision {section.scheduledRevision.id.slice(0, 8)}
              {" · "}
              saved {new Date(section.scheduledRevision.createdAt).toLocaleString("de-DE")}
              {section.scheduledRevision.createdByEmail
                ? ` by ${section.scheduledRevision.createdByEmail}`
                : ""}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-sm font-semibold text-white">Revision history</div>
          <div className="mt-1 text-sm text-slate-400">
            Each draft save creates a frozen snapshot. Scheduled publishes stay pinned to the revision selected at schedule time.
          </div>
          <div className="mt-4 space-y-3">
            {section.revisions.length === 0 ? (
              <div className="text-sm text-slate-500">
                No revisions saved yet. Save the current draft to create the first snapshot.
              </div>
            ) : (
              section.revisions.map((revision) => (
                <div
                  key={revision.id}
                  className="rounded-2xl border border-white/10 bg-[#070a0f] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {revision.isManual ? "Manual revision" : "Automatic fallback revision"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {revision.productIds.length} product(s) ·{" "}
                        {new Date(revision.createdAt).toLocaleString("de-DE")}
                        {revision.createdByEmail ? ` · ${revision.createdByEmail}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                      {section.publishedRevisionId === revision.id ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-emerald-200">
                          Live
                        </span>
                      ) : null}
                      {section.scheduledRevisionId === revision.id ? (
                        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                          Scheduled
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminButton tone="secondary" onClick={() => onRestoreDraft(revision.id)}>
                      Restore draft
                    </AdminButton>
                    <AdminButton tone="secondary" onClick={() => onRestoreLive(revision.id)}>
                      Publish revision
                    </AdminButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <AdminButton tone="secondary" disabled={!isDirty || saving || acting} onClick={onReset}>
            Revert draft
          </AdminButton>
          <AdminButton disabled={!isDirty || saving || acting} onClick={onSave}>
            {saving ? "Saving..." : "Save draft"}
          </AdminButton>
          <AdminButton disabled={saving || acting} onClick={onPublish}>
            {acting ? "Working..." : "Publish now"}
          </AdminButton>
        </div>
      </div>
    </AdminPanel>
  );
}

export default function AdminLandingPageClient({
  initialSections,
  initialScheduledSections,
  initialStorefront,
}: Props) {
  const [sections, setSections] = useState(initialSections);
  const [savedSections, setSavedSections] = useState(initialSections);
  const [scheduledSections, setScheduledSections] = useState(initialScheduledSections);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [queueScheduleDrafts, setQueueScheduleDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const storefrontLabel = STOREFRONT_LABELS[initialStorefront];

  useEffect(() => {
    setSections(initialSections);
    setSavedSections(initialSections);
    setScheduledSections(initialScheduledSections);
    setSavingKey(null);
    setActingKey(null);
    setMessage("");
    setError("");
  }, [initialScheduledSections, initialSections, initialStorefront]);

  const sectionsByKey = useMemo(
    () => Object.fromEntries(sections.map((section) => [section.key, section])),
    [sections],
  );
  const savedSectionsByKey = useMemo(
    () => Object.fromEntries(savedSections.map((section) => [section.key, section])),
    [savedSections],
  );

  const manualSectionCount = sections.filter((section) => section.isManual).length;
  const draftManualSectionCount = sections.filter((section) => section.draftIsManual).length;
  const scheduledSectionCount = sections.filter((section) => Boolean(section.scheduledPublishAt)).length;

  const upsertScheduledSection = (
    storefront: StorefrontCode,
    key: string,
    updater: (section: LandingPageSection | null) => LandingPageSection | null,
  ) => {
    setScheduledSections((current) => {
      const existing = current.find(
        (section) => section.storefront === storefront && section.key === key,
      ) ?? null;
      const next = updater(existing);
      const remaining = current.filter(
        (section) => !(section.storefront === storefront && section.key === key),
      );
      return next && next.scheduledPublishAt ? [...remaining, next] : remaining;
    });
  };

  const updateSection = (
    key: string,
    updater: (section: LandingPageSection) => LandingPageSection,
  ) => {
    setSections((current) =>
      current.map((section) => (section.key === key ? updater(section) : section)),
    );
  };

  const replaceSection = (
    storefront: StorefrontCode,
    key: string,
    payload: {
      draftIsManual: boolean;
      draftProductIds: string[];
      isManual: boolean;
      productIds: string[];
      updatedAt?: string | null;
      lastPublishedAt?: string | null;
      scheduledPublishAt?: string | null;
      publishedRevisionId?: string | null;
      scheduledRevisionId?: string | null;
      scheduledDraftDiffers?: boolean;
      scheduledRevision?: LandingPageSection["scheduledRevision"];
      revisions?: LandingPageSection["revisions"];
    },
  ) => {
    setSections((current) =>
      current.map((entry) => {
        if (entry.key !== key || entry.storefront !== storefront) return entry;
        const productById = new Map(
          [...entry.draftProducts, ...entry.products].map((product) => [product.id, product]),
        );
        return {
          ...entry,
          draftIsManual: payload.draftIsManual,
          draftProducts: payload.draftProductIds
            .map((id) => productById.get(id))
            .filter((product): product is LandingPageProduct => Boolean(product)),
          isManual: payload.isManual,
          products: payload.productIds
            .map((id) => productById.get(id))
            .filter((product): product is LandingPageProduct => Boolean(product)),
          updatedAt: payload.updatedAt ?? entry.updatedAt,
          lastPublishedAt: payload.lastPublishedAt ?? entry.lastPublishedAt,
          scheduledPublishAt: pickDefined(payload.scheduledPublishAt, entry.scheduledPublishAt),
          publishedRevisionId: pickDefined(payload.publishedRevisionId, entry.publishedRevisionId),
          scheduledRevisionId: pickDefined(payload.scheduledRevisionId, entry.scheduledRevisionId),
          scheduledDraftDiffers: pickDefined(
            payload.scheduledDraftDiffers,
            entry.scheduledDraftDiffers,
          ),
          scheduledRevision: pickDefined(payload.scheduledRevision, entry.scheduledRevision),
          revisions: pickDefined(payload.revisions, entry.revisions),
        };
      }),
    );
  };

  const saveSection = async (key: string) => {
    const sectionActionKey = getSectionActionKey(initialStorefront, key);
    const section = sectionsByKey[key] as LandingPageSection | undefined;
    if (!section) return;

    if (section.draftIsManual && section.draftProducts.length === 0) {
      setError("Manual draft overrides need at least one selected product.");
      setMessage("");
      return;
    }

    setSavingKey(sectionActionKey);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/landing-page/sections/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storefront: initialStorefront,
          draftIsManual: section.draftIsManual,
          productIds: section.draftProducts.map((product) => product.id),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        section?: {
          isManual: boolean;
          productIds: string[];
          draftIsManual: boolean;
          draftProductIds: string[];
          updatedAt?: string | null;
          lastPublishedAt?: string | null;
          scheduledPublishAt?: string | null;
          publishedRevisionId?: string | null;
          scheduledRevisionId?: string | null;
          scheduledDraftDiffers?: boolean;
          scheduledRevision?: LandingPageSection["scheduledRevision"];
          revisions?: LandingPageSection["revisions"];
        };
      };
      if (!response.ok || !data.section) {
        setError(data.error ?? "Failed to save landing page draft.");
        return;
      }

      replaceSection(initialStorefront, key, data.section);
      upsertScheduledSection(initialStorefront, key, (existing) => {
        const source =
          sectionsByKey[key] ?? savedSectionsByKey[key] ?? existing;
        if (!source) return existing;
        return {
          ...source,
          storefront: initialStorefront,
          scheduledPublishAt: pickDefined(data.section?.scheduledPublishAt, source.scheduledPublishAt),
          scheduledRevisionId: pickDefined(
            data.section?.scheduledRevisionId,
            source.scheduledRevisionId,
          ),
          scheduledDraftDiffers: pickDefined(
            data.section?.scheduledDraftDiffers,
            source.scheduledDraftDiffers,
          ),
          scheduledRevision: pickDefined(data.section?.scheduledRevision, source.scheduledRevision),
          revisions: pickDefined(data.section?.revisions, source.revisions),
        };
      });
      setSavedSections((current) =>
        current.map((entry) =>
          entry.key === key
            ? {
                ...sectionsByKey[key],
                updatedAt: data.section?.updatedAt ?? entry.updatedAt,
                scheduledPublishAt: pickDefined(
                  data.section?.scheduledPublishAt,
                  entry.scheduledPublishAt,
                ),
                lastPublishedAt: data.section?.lastPublishedAt ?? entry.lastPublishedAt,
                publishedRevisionId: pickDefined(
                  data.section?.publishedRevisionId,
                  entry.publishedRevisionId,
                ),
                scheduledRevisionId: pickDefined(
                  data.section?.scheduledRevisionId,
                  entry.scheduledRevisionId,
                ),
                scheduledDraftDiffers: pickDefined(
                  data.section?.scheduledDraftDiffers,
                  entry.scheduledDraftDiffers,
                ),
                scheduledRevision: pickDefined(
                  data.section?.scheduledRevision,
                  entry.scheduledRevision,
                ),
                revisions: pickDefined(data.section?.revisions, entry.revisions),
              }
            : entry,
        ),
      );
      setMessage(`Saved ${storefrontLabel} draft for ${section.title.toLowerCase()}.`);
    } catch {
      setError("Failed to save landing page draft.");
    } finally {
      setSavingKey(null);
    }
  };

  const runAction = async (
    key: string,
    action:
      | "publish_now"
      | "schedule"
      | "clear_schedule"
      | "rollback_draft"
      | "rollback_live",
    scheduledPublishAt?: string,
    revisionId?: string,
    storefront: StorefrontCode = initialStorefront,
  ) => {
    const sectionActionKey = getSectionActionKey(storefront, key);
    const targetStorefrontLabel = STOREFRONT_LABELS[storefront];
    setActingKey(sectionActionKey);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/landing-page/sections/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storefront,
          action,
          scheduledPublishAt: scheduledPublishAt
            ? new Date(scheduledPublishAt).toISOString()
            : undefined,
          revisionId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        section?: {
          isManual: boolean;
          productIds: string[];
          draftIsManual: boolean;
          draftProductIds: string[];
          updatedAt?: string | null;
          lastPublishedAt?: string | null;
          scheduledPublishAt?: string | null;
          publishedRevisionId?: string | null;
          scheduledRevisionId?: string | null;
          scheduledDraftDiffers?: boolean;
          scheduledRevision?: LandingPageSection["scheduledRevision"];
          revisions?: LandingPageSection["revisions"];
        };
      };
      if (!response.ok || !data.section) {
        setError(data.error ?? "Landing page action failed.");
        return;
      }

      if (storefront === initialStorefront) {
        replaceSection(storefront, key, data.section);
      }
      upsertScheduledSection(storefront, key, (existing) => {
        const source =
          (storefront === initialStorefront ? sectionsByKey[key] : existing) ??
          existing;
        if (!source) return existing;
        return {
          ...source,
          storefront,
          isManual: data.section!.isManual,
          draftIsManual: data.section!.draftIsManual,
          updatedAt: data.section!.updatedAt ?? source.updatedAt,
          lastPublishedAt: data.section!.lastPublishedAt ?? source.lastPublishedAt,
          scheduledPublishAt: pickDefined(data.section!.scheduledPublishAt, source.scheduledPublishAt),
          publishedRevisionId: pickDefined(
            data.section!.publishedRevisionId,
            source.publishedRevisionId,
          ),
          scheduledRevisionId: pickDefined(
            data.section!.scheduledRevisionId,
            source.scheduledRevisionId,
          ),
          scheduledDraftDiffers: pickDefined(
            data.section!.scheduledDraftDiffers,
            source.scheduledDraftDiffers,
          ),
          scheduledRevision: pickDefined(
            data.section!.scheduledRevision,
            source.scheduledRevision,
          ),
          revisions: pickDefined(data.section!.revisions, source.revisions),
        };
      });
      if (storefront === initialStorefront) {
        setSavedSections((current) =>
          current.map((entry) =>
            entry.key === key
              ? {
                  ...entry,
                  isManual: data.section!.isManual,
                  products: data.section!.productIds
                    .map((id) =>
                      sectionsByKey[key]?.draftProducts.find((product) => product.id === id) ??
                      sectionsByKey[key]?.products.find((product) => product.id === id) ??
                      entry.products.find((product) => product.id === id),
                    )
                    .filter((product): product is LandingPageProduct => Boolean(product)),
                  draftIsManual: data.section!.draftIsManual,
                  draftProducts: data.section!.draftProductIds
                    .map((id) =>
                      sectionsByKey[key]?.draftProducts.find((product) => product.id === id) ??
                      entry.draftProducts.find((product) => product.id === id),
                    )
                    .filter((product): product is LandingPageProduct => Boolean(product)),
                  updatedAt: data.section!.updatedAt ?? entry.updatedAt,
                  lastPublishedAt: data.section!.lastPublishedAt ?? entry.lastPublishedAt,
                  scheduledPublishAt: pickDefined(
                    data.section!.scheduledPublishAt,
                    entry.scheduledPublishAt,
                  ),
                  publishedRevisionId: pickDefined(
                    data.section!.publishedRevisionId,
                    entry.publishedRevisionId,
                  ),
                  scheduledRevisionId: pickDefined(
                    data.section!.scheduledRevisionId,
                    entry.scheduledRevisionId,
                  ),
                  scheduledDraftDiffers: pickDefined(
                    data.section!.scheduledDraftDiffers,
                    entry.scheduledDraftDiffers,
                  ),
                  scheduledRevision: pickDefined(
                    data.section!.scheduledRevision,
                    entry.scheduledRevision,
                  ),
                  revisions: pickDefined(data.section!.revisions, entry.revisions),
                }
              : entry,
          ),
        );
      }
      setQueueScheduleDrafts((current) => {
        if (!(sectionActionKey in current)) return current;
        const next = { ...current };
        delete next[sectionActionKey];
        return next;
      });
      setMessage(
        action === "publish_now"
          ? `Published ${targetStorefrontLabel} landing-page draft.`
          : action === "schedule"
            ? `Scheduled ${targetStorefrontLabel} landing-page draft.`
            : action === "clear_schedule"
              ? `Cleared ${targetStorefrontLabel} landing-page schedule.`
              : action === "rollback_draft"
                ? `Restored the ${targetStorefrontLabel} draft from the selected revision.`
                : `Published the selected ${targetStorefrontLabel} revision.`,
      );
    } catch {
      setError("Landing page action failed.");
    } finally {
      setActingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageIntro
        eyebrow="Admin / Landing Page"
        title="Homepage merchandising"
        description={`Manage ${storefrontLabel} homepage product sections with a safer workflow: edit the draft, then publish immediately or schedule it for later.`}
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(["MAIN", "GROW"] as const).map((storefront) => {
                const active = storefront === initialStorefront;
                return (
                  <Link
                    key={storefront}
                    href={
                      storefront === "MAIN"
                        ? "/admin/landing-page"
                        : `/admin/landing-page?storefront=${storefront}`
                    }
                    className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition ${
                      active
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {STOREFRONT_LABELS[storefront]}
                  </Link>
                );
              })}
            </div>
            {initialStorefront === "MAIN" ? (
              <Link
                href="/?landingPreview=draft"
                target="_blank"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/15"
              >
                Preview draft homepage
              </Link>
            ) : null}
          </>
        }
        metrics={
          <div className="grid gap-3 md:grid-cols-6">
            <AdminMetricCard
              label="Storefront"
              value={storefrontLabel}
              detail="Active merchandising workspace"
            />
            <AdminMetricCard
              label="Sections"
              value={String(sections.length)}
              detail="Homepage product zones"
            />
            <AdminMetricCard
              label="Live Manual"
              value={String(manualSectionCount)}
              detail="Sections currently overriding defaults"
            />
            <AdminMetricCard
              label="Draft Manual"
              value={String(draftManualSectionCount)}
              detail="Draft sections ready to override defaults"
            />
            <AdminMetricCard
              label="Scheduled"
              value={String(scheduledSectionCount)}
              detail="Sections queued for timed publish"
            />
            <AdminMetricCard
              label="Hero Draft"
              value={`${sectionsByKey.hero?.draftProducts.length ?? 0}/${sectionsByKey.hero?.maxItems ?? 3}`}
              detail="Products in the hero draft stack"
            />
          </div>
        }
      />

      {message ? <AdminNotice tone="success">{message}</AdminNotice> : null}
      {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}

      <AdminPanel
        eyebrow="Schedule Queue"
        title="Scheduled publishes"
        description="Timed publishes are pinned to a saved revision. Clear or reschedule them here without reopening each editor."
      >
        <div className="space-y-3">
          {scheduledSections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-slate-500">
              No landing-page sections are currently scheduled.
            </div>
          ) : (
            scheduledSections
              .slice()
              .sort((left, right) =>
                new Date(left.scheduledPublishAt ?? 0).getTime() -
                new Date(right.scheduledPublishAt ?? 0).getTime(),
              )
              .map((section) => {
                const queueKey = `${section.storefront}:${section.key}`;
                const scheduledValue =
                  queueScheduleDrafts[queueKey] ??
                  toLocalDateTimeInput(section.scheduledPublishAt);
                return (
                  <div
                    key={queueKey}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {STOREFRONT_LABELS[section.storefront]} · {section.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Scheduled {new Date(section.scheduledPublishAt ?? "").toLocaleString("de-DE")}
                          {section.scheduledRevision
                            ? ` · revision ${section.scheduledRevision.id.slice(0, 8)}`
                            : ""}
                        </div>
                        {section.scheduledDraftDiffers ? (
                          <div className="mt-2 text-xs text-amber-200">
                            Current draft differs from the frozen scheduled revision.
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                        <AdminInput
                          type="datetime-local"
                          value={scheduledValue}
                          onChange={(event) =>
                            setQueueScheduleDrafts((current) => ({
                              ...current,
                              [queueKey]: event.target.value,
                            }))
                          }
                        />
                        <AdminButton
                          tone="secondary"
                          disabled={actingKey === queueKey}
                          onClick={() =>
                            void runAction(
                              section.key,
                              "schedule",
                              scheduledValue,
                              section.scheduledRevisionId ?? undefined,
                              section.storefront,
                            )
                          }
                        >
                          {actingKey === queueKey ? "Working..." : "Reschedule"}
                        </AdminButton>
                        <AdminButton
                          tone="secondary"
                          disabled={actingKey === queueKey}
                          onClick={() =>
                            void runAction(
                              section.key,
                              "clear_schedule",
                              undefined,
                              undefined,
                              section.storefront,
                            )
                          }
                        >
                          Clear
                        </AdminButton>
                        <Link
                          href={
                            section.storefront === "MAIN"
                              ? "/admin/landing-page"
                              : `/admin/landing-page?storefront=${section.storefront}`
                          }
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.05]"
                        >
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </AdminPanel>

      <div className="space-y-6">
        {sections.map((section) => (
          <LandingPageSectionEditor
            key={section.key}
            section={section}
            initialSection={savedSectionsByKey[section.key] as LandingPageSection}
            storefront={initialStorefront}
            storefrontLabel={storefrontLabel}
            saving={savingKey === getSectionActionKey(initialStorefront, section.key)}
            acting={actingKey === getSectionActionKey(initialStorefront, section.key)}
            onToggleManual={(value) =>
              updateSection(section.key, (current) => ({ ...current, draftIsManual: value }))
            }
            onAddProduct={(product) =>
              updateSection(section.key, (current) => {
                if (
                  current.draftProducts.some((entry) => entry.id === product.id) ||
                  current.draftProducts.length >= current.maxItems
                ) {
                  return current;
                }
                return {
                  ...current,
                  draftProducts: [
                    ...current.draftProducts,
                    {
                      id: product.id,
                      title: product.title,
                      handle: product.handle,
                      manufacturer: product.manufacturer,
                      status: "ACTIVE",
                      storefronts: product.storefronts,
                      imageUrl: product.imageUrl,
                    },
                  ],
                };
              })
            }
            onMoveProduct={(fromIndex, toIndex) =>
              updateSection(section.key, (current) => {
                if (
                  fromIndex < 0 ||
                  toIndex < 0 ||
                  fromIndex >= current.draftProducts.length ||
                  toIndex >= current.draftProducts.length
                ) {
                  return current;
                }
                const nextProducts = [...current.draftProducts];
                const [moved] = nextProducts.splice(fromIndex, 1);
                nextProducts.splice(toIndex, 0, moved);
                return { ...current, draftProducts: nextProducts };
              })
            }
            onRemoveProduct={(productId) =>
              updateSection(section.key, (current) => ({
                ...current,
                draftProducts: current.draftProducts.filter((product) => product.id !== productId),
              }))
            }
            onReset={() =>
              setSections((current) =>
                current.map((entry) =>
                  entry.key === section.key
                    ? { ...(savedSectionsByKey[section.key] as LandingPageSection) }
                    : entry,
                ),
              )
            }
            onSave={() => void saveSection(section.key)}
            onPublish={() => void runAction(section.key, "publish_now")}
            onSchedule={(value) => void runAction(section.key, "schedule", value)}
            onClearSchedule={() => void runAction(section.key, "clear_schedule")}
            onRestoreDraft={(revisionId) =>
              void runAction(section.key, "rollback_draft", undefined, revisionId)
            }
            onRestoreLive={(revisionId) =>
              void runAction(section.key, "rollback_live", undefined, revisionId)
            }
          />
        ))}
      </div>
    </div>
  );
}
