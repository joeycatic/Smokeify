"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BoltIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FlagIcon,
  LinkIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminPanel,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminWorkspace";
import { AdminKpiStrip, AdminPage, AdminPageHeader, AdminStat } from "@/components/admin/ui";
import styles from "./SupplierImportClient.module.css";

type Category = {
  id: string;
  name: string;
  handle: string;
  parentId: string | null;
};

type Batch = {
  id: string;
  sourceUrl: string;
  status: "FETCHING" | "READY" | "PARTIAL" | "FAILED";
  fetchedCount: number;
  changedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  createdAt: string | Date;
  _count?: { items: number };
};

type LinkedProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
};

type CatalogChange = {
  label: string;
  currentValue: string;
  incomingValue: string;
};

type SourceChange = CatalogChange & {
  field: string;
};

type ImportItem = {
  id: string;
  batchId: string;
  sourceUrl: string;
  title: string;
  manufacturer: string | null;
  handle: string;
  shortDescription: string | null;
  description: string | null;
  technicalDetails: string | null;
  gtin: string | null;
  sku: string | null;
  costCents: number | null;
  priceCents: number | null;
  compareAtCents: number | null;
  stockQuantity: number;
  weightGrams: number | null;
  imageUrls: string[];
  sourceChanges: SourceChange[] | null;
  sourceChangedAt: string | Date | null;
  status: "PENDING" | "APPROVED" | "DECLINED" | "IMPORT_ERROR";
  linkedProductId: string | null;
  linkedProduct: LinkedProduct | null;
  catalogProduct: LinkedProduct | null;
  catalogChanges: CatalogChange[];
  importError: string | null;
  updatedAt: string | Date;
  batch: Batch;
};

type WorkspaceData = {
  categories: Category[];
  batches: Batch[];
  items: ImportItem[];
};

type EditDraft = {
  title: string;
  manufacturer: string;
  handle: string;
  shortDescription: string;
  description: string;
  technicalDetails: string;
  gtin: string;
  sku: string;
  cost: string;
  price: string;
  compareAt: string;
  stockQuantity: string;
  weightGrams: string;
  imageUrls: string;
};

const formatMoney = (cents: number | null) =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(cents / 100);

const toEditDraft = (item: ImportItem): EditDraft => ({
  title: item.title,
  manufacturer: item.manufacturer ?? "",
  handle: item.handle,
  shortDescription: item.shortDescription ?? "",
  description: item.description ?? "",
  technicalDetails: item.technicalDetails ?? "",
  gtin: item.gtin ?? "",
  sku: item.sku ?? "",
  cost: item.costCents === null ? "" : (item.costCents / 100).toFixed(2),
  price: item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
  compareAt:
    item.compareAtCents === null ? "" : (item.compareAtCents / 100).toFixed(2),
  stockQuantity: String(item.stockQuantity),
  weightGrams: item.weightGrams === null ? "" : String(item.weightGrams),
  imageUrls: item.imageUrls.join("\n"),
});

const parseEuroCents = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

const statusTone = (status: ImportItem["status"]) => {
  if (status === "APPROVED") return "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]";
  if (status === "DECLINED") return "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]";
  if (status === "IMPORT_ERROR") return "border-[#e2a136] bg-[#fff4dd] text-[#81560e]";
  return "border-[var(--adm-primary)] bg-[var(--adm-primary-soft)] text-[var(--adm-primary)]";
};

const compactNumber = (value: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);

export default function SupplierImportClient({
  initialData,
}: {
  initialData: WorkspaceData;
}) {
  const [data, setData] = useState(initialData);
  const [sourceUrl, setSourceUrl] = useState("");
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [additionalCategoryIds, setAdditionalCategoryIds] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swipeAxis = useRef<"x" | "y" | null>(null);
  const pendingDeckDecisions = useRef(
    new Map<string, "APPROVED" | "DECLINED">(),
  );
  const [historyFilter, setHistoryFilter] = useState<"ALL" | ImportItem["status"]>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ImportItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleting, setDeleting] = useState(false);

  const pendingItems = useMemo(
    () => data.items.filter((item) => item.status === "PENDING"),
    [data.items],
  );
  const currentItem = pendingItems[0] ?? null;
  const visibleHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (historyFilter !== "ALL" && item.status !== historyFilter) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.manufacturer, item.sku, item.gtin]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [data.items, historyFilter, query]);

  const counts = useMemo(
    () => ({
      pending: data.items.filter((item) => item.status === "PENDING").length,
      approved: data.items.filter((item) => item.status === "APPROVED").length,
      declined: data.items.filter((item) => item.status === "DECLINED").length,
      errors: data.items.filter((item) => item.status === "IMPORT_ERROR").length,
      changed: data.items.filter(
        (item) => Array.isArray(item.sourceChanges) && item.sourceChanges.length > 0,
      ).length,
    }),
    [data.items],
  );
  const selectedMainCategory = useMemo(
    () => data.categories.find((category) => category.id === mainCategoryId) ?? null,
    [data.categories, mainCategoryId],
  );
  const selectedAdditionalCategories = useMemo(
    () => data.categories.filter((category) => additionalCategoryIds.includes(category.id)),
    [data.categories, additionalCategoryIds],
  );
  const reviewedCount = counts.approved + counts.declined + counts.errors;
  const reviewCompletion = data.items.length
    ? Math.round((reviewedCount / data.items.length) * 100)
    : 0;
  const intakeReady = Boolean(sourceUrl.trim() && mainCategoryId);
  const deckStatus = fetching
    ? "Scanning"
    : counts.pending > 0
      ? "Reviewing"
      : "Clear";
  const visibleItemIds = visibleHistory.map((item) => item.id);
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((itemId) => selectedItemIds.has(itemId));
  const selectedHasPendingDecision = data.items.some(
    (item) =>
      selectedItemIds.has(item.id) &&
      pendingDeckDecisions.current.has(item.id),
  );

  const refreshWorkspace = async () => {
    const response = await fetch("/api/admin/supplier-import", { cache: "no-store" });
    const next = (await response.json()) as WorkspaceData & { error?: string };
    if (!response.ok) throw new Error(next.error ?? "Could not refresh supplier imports.");
    setData({
      ...next,
      items: next.items.map((item) => {
        const pendingDecision = pendingDeckDecisions.current.get(item.id);
        return pendingDecision ? { ...item, status: pendingDecision } : item;
      }),
    });
  };

  const requestItemUpdate = async (
    item: ImportItem,
    payload: {
      decision?: "APPROVED" | "DECLINED" | "PENDING";
      edits?: Record<string, unknown>;
    },
  ) => {
    const response = await fetch(`/api/admin/supplier-import/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { item?: ImportItem; error?: string };
    if (!response.ok || !result.item) {
      throw new Error(result.error ?? "Item update failed.");
    }
    return result.item;
  };

  const fetchCategory = async () => {
    if (!sourceUrl.trim() || !mainCategoryId) {
      setNotice({ tone: "error", text: "Enter a Bloomtech category URL and choose a main category." });
      return;
    }
    setFetching(true);
    setNotice({ tone: "info", text: "Bloomtech is being scanned. Large categories can take several minutes." });
    try {
      const response = await fetch("/api/admin/supplier-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl, mainCategoryId, additionalCategoryIds }),
      });
      const result = (await response.json()) as {
        error?: string;
        batch?: Batch & { items: ImportItem[] };
      };
      if (!response.ok || !result.batch) {
        throw new Error(result.error ?? "Bloomtech fetch failed.");
      }
      await refreshWorkspace();
      setNotice({
        tone: "success",
        text: `${result.batch.fetchedCount} products added, ${result.batch.changedCount} changed products flagged for review, and ${result.batch.skippedCount} unchanged products skipped.`,
      });
      setSourceUrl("");
    } catch (error) {
      await refreshWorkspace().catch(() => undefined);
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Bloomtech fetch failed.",
      });
    } finally {
      setFetching(false);
    }
  };

  const updateItem = async (
    item: ImportItem,
    payload: {
      decision?: "APPROVED" | "DECLINED" | "PENDING";
      edits?: Record<string, unknown>;
    },
  ) => {
    setBusyItemId(item.id);
    try {
      const updatedItem = await requestItemUpdate(item, payload);
      setData((current) => ({
        ...current,
        items: current.items.map((entry) =>
          entry.id === updatedItem.id ? updatedItem : entry,
        ),
      }));
      return updatedItem;
    } catch (error) {
      await refreshWorkspace().catch(() => undefined);
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Item update failed.",
      });
      throw error;
    } finally {
      setBusyItemId(null);
    }
  };

  const removeItems = async (items: ImportItem[]) => {
    if (items.length === 0 || deleting) return;
    if (items.some((item) => pendingDeckDecisions.current.has(item.id))) {
      setNotice({
        tone: "info",
        text: "Wait for the pending swipe decision before removing this item.",
      });
      return;
    }

    const confirmation =
      items.length === 1
        ? `Remove "${items[0].title}" from the supplier import queue?\n\nLinked catalog products will not be deleted.`
        : `Remove ${items.length} selected items from the supplier import queue?\n\nLinked catalog products will not be deleted.`;
    if (!window.confirm(confirmation)) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/admin/supplier-import/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: items.map((item) => item.id) }),
      });
      const result = (await response.json()) as {
        deletedCount?: number;
        deletedIds?: string[];
        error?: string;
      };
      if (!response.ok || !result.deletedIds) {
        throw new Error(result.error ?? "Queue items could not be removed.");
      }

      const deletedIds = new Set(result.deletedIds);
      setData((current) => ({
        ...current,
        items: current.items.filter((item) => !deletedIds.has(item.id)),
      }));
      setSelectedItemIds((current) => {
        const next = new Set(current);
        result.deletedIds!.forEach((itemId) => next.delete(itemId));
        return next;
      });
      if (expandedId && deletedIds.has(expandedId)) setExpandedId(null);
      if (editingItem && deletedIds.has(editingItem.id)) {
        setEditingItem(null);
        setEditDraft(null);
      }
      setNotice({
        tone: "success",
        text: `${result.deletedCount ?? result.deletedIds.length} ${
          result.deletedIds.length === 1 ? "item was" : "items were"
        } removed from the queue. Linked catalog products were kept.`,
      });
    } catch (error) {
      await refreshWorkspace().catch(() => undefined);
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Queue items could not be removed.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleItemIds.forEach((itemId) => next.delete(itemId));
      } else {
        visibleItemIds.forEach((itemId) => next.add(itemId));
      }
      return next;
    });
  };

  const decideCurrent = async (decision: "APPROVED" | "DECLINED") => {
    if (
      !currentItem ||
      exitDirection ||
      pendingDeckDecisions.current.has(currentItem.id)
    ) {
      return;
    }
    const decidedItem = currentItem;
    const direction = decision === "APPROVED" ? "right" : "left";
    pendingDeckDecisions.current.set(decidedItem.id, decision);
    setExitDirection(direction);
    window.setTimeout(() => {
      setData((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === decidedItem.id ? { ...item, status: decision } : item,
        ),
      }));
      setExitDirection(null);
      setDrag({ x: 0, y: 0, active: false });

      void requestItemUpdate(decidedItem, { decision })
        .then((updatedItem) => {
          pendingDeckDecisions.current.delete(decidedItem.id);
          setData((current) => ({
            ...current,
            items: current.items.map((item) =>
              item.id === updatedItem.id ? updatedItem : item,
            ),
          }));
          setNotice({
            tone: "success",
            text:
              decision === "APPROVED"
                ? `${decidedItem.title} was transferred to Catalog as a draft.`
                : `${decidedItem.title} was declined and retained in review history.`,
          });
        })
        .catch(async (error) => {
          pendingDeckDecisions.current.delete(decidedItem.id);
          await refreshWorkspace().catch(() => undefined);
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Item update failed.",
          });
        });
    }, 230);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !currentItem ||
      exitDirection ||
      pendingDeckDecisions.current.has(currentItem.id)
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStart.current = { x: event.clientX, y: event.clientY };
    swipeAxis.current = null;
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || !drag.active) return;
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (!swipeAxis.current) {
      if (Math.max(absX, absY) < 8) return;
      swipeAxis.current = absX > absY * 1.15 ? "x" : "y";
    }
    if (swipeAxis.current === "y") {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      pointerStart.current = null;
      swipeAxis.current = null;
      setDrag({ x: 0, y: 0, active: false });
      return;
    }
    event.preventDefault();
    setDrag({
      x: deltaX,
      y: deltaY * 0.18,
      active: true,
    });
  };

  const finishPointer = () => {
    pointerStart.current = null;
    const threshold =
      typeof window === "undefined"
        ? 105
        : Math.min(105, Math.max(72, window.innerWidth * 0.24));
    if (swipeAxis.current === "x" && drag.x > threshold) void decideCurrent("APPROVED");
    else if (swipeAxis.current === "x" && drag.x < -threshold) void decideCurrent("DECLINED");
    else setDrag({ x: 0, y: 0, active: false });
    swipeAxis.current = null;
  };

  const openSupplierProduct = () => {
    window.open(currentItem?.sourceUrl, "_blank", "noopener,noreferrer");
  };

  const toggleAdditionalCategory = (categoryId: string) => {
    setAdditionalCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const openEditor = (item: ImportItem) => {
    setEditingItem(item);
    setEditDraft(toEditDraft(item));
  };

  const saveEditor = async () => {
    if (!editingItem || !editDraft) return;
    const edits = {
      title: editDraft.title,
      manufacturer: editDraft.manufacturer || null,
      handle: editDraft.handle,
      shortDescription: editDraft.shortDescription || null,
      description: editDraft.description || null,
      technicalDetails: editDraft.technicalDetails || null,
      gtin: editDraft.gtin || null,
      sku: editDraft.sku || null,
      costCents: editDraft.cost ? parseEuroCents(editDraft.cost) : null,
      priceCents: editDraft.price ? parseEuroCents(editDraft.price) : null,
      compareAtCents: editDraft.compareAt ? parseEuroCents(editDraft.compareAt) : null,
      stockQuantity: Number(editDraft.stockQuantity),
      weightGrams: editDraft.weightGrams ? Number(editDraft.weightGrams) : null,
      imageUrls: editDraft.imageUrls.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean),
    };
    try {
      await updateItem(editingItem, { edits });
      setNotice({ tone: "success", text: `${editDraft.title} was saved.` });
      setEditingItem(null);
      setEditDraft(null);
    } catch {
      // Error notice is handled by updateItem.
    }
  };

  const dragStrength = Math.min(1, Math.abs(drag.x) / 140);
  const cardStyle = {
    "--drag-x": `${drag.x}px`,
    "--drag-y": `${drag.y}px`,
    "--drag-rotate": `${drag.x / 22}deg`,
  } as CSSProperties;
  const currentCatalogProduct = currentItem?.catalogProduct ?? null;
  const currentCatalogChanges = currentItem?.catalogChanges ?? [];
  const currentSourceChanges = currentItem?.sourceChanges ?? [];

  return (
    <AdminPage layout="queue" className={styles.workspace}>
      <AdminPageHeader
        eyebrow="Catalog / Supplier Import"
        title="Bloomtech review queue"
        description="Controlled supplier intake with draft creation, traceable decisions, and queue telemetry."
        actions={
          <span className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 text-[13px] font-semibold text-[var(--adm-text-muted)]">
            <BoltIcon className={`h-4 w-4 ${fetching ? "animate-pulse" : ""}`} />
            {deckStatus}
          </span>
        }
      >
        <AdminKpiStrip>
          <AdminStat label="Pending" value={compactNumber(counts.pending)} />
          <AdminStat label="Reviewed" value={`${reviewCompletion}%`} delta="queue completion" />
          <AdminStat label="Approved" value={compactNumber(counts.approved)} deltaTone="success" />
          <AdminStat label="Declined" value={compactNumber(counts.declined)} deltaTone="error" />
          <AdminStat label="Changed" value={compactNumber(counts.changed)} deltaTone="warning" />
          <AdminStat label="Errors" value={compactNumber(counts.errors)} deltaTone="error" />
        </AdminKpiStrip>
      </AdminPageHeader>

      {notice ? <AdminNotice tone={notice.tone}>{notice.text}</AdminNotice> : null}

      <AdminPanel
        eyebrow="01 / Intake"
        title="Fetch a Bloomtech category"
        description="Batch category mapping is attached before review so approved products land in the right catalog draft state."
        className={styles.intake}
      >
        <div className={styles.intakeGrid}>
          <div className={styles.sourceColumn}>
            <AdminField label="Bloomtech category URL">
              <div className={styles.inputShell}>
                <LinkIcon className="h-4 w-4" aria-hidden="true" />
                <AdminInput
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://bloomtech.de/Biobizz_1"
                  disabled={fetching}
                  className={styles.decoratedInput}
                />
              </div>
            </AdminField>
            <div className={styles.intakeMeta}>
              <span>{sourceUrl.trim() ? "Source locked" : "Waiting for source"}</span>
              <span>{selectedMainCategory ? selectedMainCategory.name : "No main category"}</span>
              <span>{selectedAdditionalCategories.length} extra</span>
            </div>
          </div>

          <div className={styles.categoryColumn}>
            <AdminField label="Main category">
              <AdminSelect
                value={mainCategoryId}
                onChange={(event) => {
                  setMainCategoryId(event.target.value);
                  setAdditionalCategoryIds((current) =>
                    current.filter((id) => id !== event.target.value),
                  );
                }}
                disabled={fetching}
                className={styles.mainSelect}
              >
                <option value="">Choose category</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </AdminSelect>
            </AdminField>

            <div className={styles.additionalCategoryField}>
              <AdminField
                label="Additional categories"
                optional={
                  selectedAdditionalCategories.length
                    ? `${selectedAdditionalCategories.length} selected`
                    : "Optional"
                }
              >
                <AdminSelect
                  value=""
                  onChange={(event) => {
                    if (event.target.value) {
                      toggleAdditionalCategory(event.target.value);
                    }
                  }}
                  disabled={fetching}
                  className={styles.mainSelect}
                  aria-label="Add or remove an additional category"
                >
                  <option value="">
                    {selectedAdditionalCategories.length
                      ? "Choose another category"
                      : "Choose additional category"}
                  </option>
                  {data.categories
                    .filter((category) => category.id !== mainCategoryId)
                    .map((category) => {
                      const selected = additionalCategoryIds.includes(category.id);
                      return (
                        <option key={category.id} value={category.id}>
                          {selected ? `✓ ${category.name}` : category.name}
                        </option>
                      );
                    })}
                </AdminSelect>
              </AdminField>
              {selectedAdditionalCategories.length ? (
                <div className={styles.additionalSelection}>
                  <span>
                    {selectedAdditionalCategories
                      .map((category) => category.name)
                      .join(", ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdditionalCategoryIds([])}
                    disabled={fetching}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.launchColumn}>
            <div className={styles.launchState} data-ready={intakeReady}>
              <span>{intakeReady ? "Ready" : "Missing input"}</span>
              <strong>{fetching ? "Scanning Bloomtech" : "Create review batch"}</strong>
            </div>
            <AdminButton
              onClick={() => void fetchCategory()}
              disabled={fetching}
              className={styles.fetchButton}
            >
              <ArrowPathIcon className={`mr-2 h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching…" : "Fetch products"}
            </AdminButton>
          </div>
        </div>
      </AdminPanel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <AdminPanel
          eyebrow="02 / Review"
          title={currentItem ? `${pendingItems.length} products waiting` : "Review queue complete"}
          description="Drag right to approve, left to decline, or use the accessible controls below."
          className={styles.reviewPanel}
        >
          <div className={styles.deck} aria-live="polite">
            {pendingItems.slice(1, 3).map((item, index) => (
              <div
                key={item.id}
                className={styles.ghostCard}
                style={{
                  "--deck-offset": `${34 + index * 15}px`,
                  "--deck-scale": String(0.96 - index * 0.035),
                } as CSSProperties}
                aria-hidden="true"
              >
                {item.imageUrls[0] ? (
                  <Image
                    src={item.imageUrls[0]}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 540px"
                    className={styles.ghostImage}
                    loading="eager"
                  />
                ) : null}
              </div>
            ))}

            {currentItem ? (
              <div
                className={`${styles.card} ${drag.active ? styles.dragging : ""} ${
                  exitDirection === "right" ? styles.exitRight : ""
                } ${exitDirection === "left" ? styles.exitLeft : ""}`}
                style={cardStyle}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight") void decideCurrent("APPROVED");
                  if (event.key === "ArrowLeft") void decideCurrent("DECLINED");
                }}
                role="group"
                tabIndex={0}
                aria-label={`${currentItem.title}. Press right arrow to approve or left arrow to decline.`}
              >
                <article className={styles.cardSurface}>
                  <div className={styles.cardMedia}>
                    {currentSourceChanges.length ? (
                      <div
                        className={`${styles.existingProductFlag} ${styles.sourceChangeFlag}`}
                        title={`${currentSourceChanges.length} supplier fields changed since the previous scan`}
                      >
                        <FlagIcon className="h-3.5 w-3.5" />
                        <span>{currentSourceChanges.length} source changes</span>
                      </div>
                    ) : null}
                    {currentCatalogProduct ? (
                      <div
                        className={`${styles.existingProductFlag} ${
                          currentSourceChanges.length ? styles.secondaryFlag : ""
                        }`}
                        title={`Matched catalog product: ${currentCatalogProduct.title}`}
                      >
                        <FlagIcon className="h-3.5 w-3.5" />
                        <span>Already in catalog</span>
                      </div>
                    ) : null}
                    {currentItem.imageUrls[0] ? (
                      <Image
                        src={currentItem.imageUrls[0]}
                        alt={currentItem.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 540px"
                        className="object-contain p-7"
                        priority
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--adm-text-faint)]">
                        <PhotoIcon className="h-20 w-20" />
                      </div>
                    )}
                    <div className={`absolute inset-0 ${styles.imageShade}`} />
                    <div
                      className={styles.approveWash}
                      style={{ "--wash-opacity": drag.x > 0 ? dragStrength : 0 } as CSSProperties}
                    />
                    <div
                      className={styles.declineWash}
                      style={{ "--wash-opacity": drag.x < 0 ? dragStrength : 0 } as CSSProperties}
                    />
                    <div
                      className={`${styles.stamp} right-7 text-[var(--adm-success)]`}
                      style={{
                        "--stamp-opacity": drag.x > 0 ? dragStrength : 0,
                        "--stamp-rotate": "8deg",
                      } as CSSProperties}
                    >
                      APPROVE
                    </div>
                    <div
                      className={`${styles.stamp} left-7 text-[var(--adm-error)]`}
                      style={{
                        "--stamp-opacity": drag.x < 0 ? dragStrength : 0,
                        "--stamp-rotate": "-8deg",
                      } as CSSProperties}
                    >
                      DECLINE
                    </div>
                    <div className={styles.scanline} />
                    <div className="absolute inset-x-5 bottom-4 z-[2] flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[var(--adm-primary)]">
                          {currentItem.manufacturer || "Bloomtech"}
                        </p>
                        <h3 className="mt-1 max-w-md text-xl font-black leading-tight text-[var(--adm-text)] sm:text-2xl">
                          {currentItem.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openSupplierProduct();
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onPointerUp={(event) => event.stopPropagation()}
                        className="inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--adm-border-strong)] bg-black/40 text-[var(--adm-text)] backdrop-blur hover:bg-black/60"
                        aria-label="Open supplier product"
                        title="Open original Bloomtech product"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardStats}>
                      {[
                        ["Supplier cost", formatMoney(currentItem.costCents)],
                        ["Sell price", formatMoney(currentItem.priceCents)],
                        ["Stock", String(currentItem.stockQuantity)],
                      ].map(([label, value]) => (
                        <div key={label} className={styles.cardStat}>
                          <p>{label}</p>
                          <strong>{value}</strong>
                          {label === "Sell price" && currentItem.compareAtCents ? (
                            <del>{formatMoney(currentItem.compareAtCents)}</del>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {currentSourceChanges.length ? (
                      <div className={styles.changePreview}>
                        <div className={styles.changePreviewHeader}>
                          <span>Supplier changed since last scan</span>
                          <strong>
                            {currentSourceChanges.length}{" "}
                            {currentSourceChanges.length === 1 ? "field" : "fields"}
                          </strong>
                        </div>
                        <div className={styles.changeRows}>
                          {currentSourceChanges.map((change) => (
                            <div key={change.field} className={styles.changeRow}>
                              <span>{change.label}</span>
                              <p>
                                <del>{change.currentValue}</del>
                                <strong>{change.incomingValue}</strong>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {currentCatalogProduct ? (
                      <div className={styles.changePreview}>
                        <div className={styles.changePreviewHeader}>
                          <span>Approve overwrites</span>
                          <strong>
                            {currentCatalogChanges.length}{" "}
                            {currentCatalogChanges.length === 1 ? "change" : "changes"}
                          </strong>
                        </div>
                        {currentCatalogChanges.length ? (
                          <div className={styles.changeRows}>
                            {currentCatalogChanges.map((change) => (
                              <div key={change.label} className={styles.changeRow}>
                                <span>{change.label}</span>
                                <p>
                                  <del>{change.currentValue}</del>
                                  <strong>{change.incomingValue}</strong>
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.noChangeCopy}>No catalog fields would change.</p>
                        )}
                      </div>
                    ) : (
                      <p className="line-clamp-3 text-sm leading-5 text-[var(--adm-text-muted)]">
                        {currentItem.shortDescription || currentItem.technicalDetails || "No supplier description available."}
                      </p>
                    )}
                    <div className={styles.cardMetaLine}>
                      <span>SKU {currentItem.sku || "—"}</span>
                      <span>•</span>
                      <span>GTIN {currentItem.gtin || "—"}</span>
                      <span>•</span>
                      <span>{currentItem.imageUrls.length} images</span>
                    </div>
                  </div>
                </article>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="max-w-md rounded-xl border border-dashed border-[var(--adm-success)] bg-emerald-400/[0.04] p-10 text-center">
                  <CheckIcon className="mx-auto h-14 w-14 text-[var(--adm-success)]" />
                  <h3 className="mt-4 text-xl font-bold text-[var(--adm-text)]">The deck is clear</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--adm-text-muted)]">
                    Fetch another category or revise decisions in the review history below.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={styles.swipeActions}>
            <button
              type="button"
              onClick={() => void decideCurrent("DECLINED")}
              disabled={!currentItem || Boolean(exitDirection) || deleting}
              className={`${styles.actionButton} inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--adm-error)] bg-[#fae7e3] px-4 font-bold text-[var(--adm-error)] disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <XMarkIcon className="mr-2 h-5 w-5" /> Decline
            </button>
            <button
              type="button"
              onClick={() => void decideCurrent("APPROVED")}
              disabled={!currentItem || Boolean(exitDirection) || deleting}
              className={`${styles.actionButton} inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--adm-success)] bg-emerald-300 px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <CheckIcon className="mr-2 h-5 w-5" /> Approve draft
            </button>
          </div>
        </AdminPanel>

        <AdminPanel
          eyebrow="Live queue"
          title="Batch telemetry"
          description="Recent supplier scans and their review coverage."
        >
          <div className="space-y-3">
            {fetching ? (
              <div className={`${styles.pulse} rounded-xl border border-[var(--adm-primary)] bg-[var(--adm-primary)]/[0.06] p-4`}>
                <p className="text-sm font-semibold text-[var(--adm-primary)]">Scanning Bloomtech</p>
                <p className="mt-1 text-xs leading-5 text-[var(--adm-primary)]/65">
                  Supplier authentication, listing discovery, and product extraction are running.
                </p>
              </div>
            ) : null}
            {data.batches.length ? data.batches.map((batch) => (
              <div key={batch.id} className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--adm-text)]">
                      {new URL(batch.sourceUrl).pathname.replace(/^\/+/, "") || "Bloomtech"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--adm-text-faint)]">
                      {new Date(batch.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-bold tracking-[0.14em] ${
                    batch.status === "FAILED"
                      ? "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]"
                      : batch.status === "PARTIAL"
                        ? "border-[#e2a136] bg-[#fff4dd] text-[#81560e]"
                        : "border-[var(--adm-success)] bg-[var(--adm-primary-soft)] text-[var(--adm-success)]"
                  }`}>
                    {batch.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text-muted)]">
                    Added <strong className="float-right text-[var(--adm-text)]">{batch.fetchedCount}</strong>
                  </div>
                  <div className="rounded-lg bg-amber-400/[0.06] px-3 py-2 text-[#81560e]/75">
                    Changed <strong className="float-right text-[#81560e]">{batch.changedCount}</strong>
                  </div>
                  <div className="rounded-lg bg-[var(--adm-surface-2)] px-3 py-2 text-[var(--adm-text-muted)]">
                    Skipped <strong className="float-right text-[var(--adm-text)]">{batch.skippedCount}</strong>
                  </div>
                </div>
                {batch.errorMessage ? <p className="mt-2 text-xs text-[var(--adm-error)]">{batch.errorMessage}</p> : null}
              </div>
            )) : (
              <p className="rounded-xl border border-dashed border-[var(--adm-border)] p-6 text-center text-sm text-[var(--adm-text-faint)]">
                No supplier batches yet.
              </p>
            )}
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        eyebrow="03 / Review history"
        title="Approved, declined, and pending products"
        description="Every decision remains editable and traceable. Approved edits synchronize with the linked catalog product."
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["ALL", "PENDING", "APPROVED", "DECLINED", "IMPORT_ERROR"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setHistoryFilter(filter)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold tracking-wide transition ${
                  historyFilter === filter
                    ? "border-[var(--adm-primary)] bg-cyan-300/12 text-[var(--adm-primary)]"
                    : "border-[var(--adm-border)] bg-[var(--adm-surface-2)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                }`}
              >
                {filter === "ALL" ? "All" : filter.replace("_", " ")}
              </button>
            ))}
          </div>
          <AdminInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, SKU, GTIN…"
            className="lg:max-w-sm"
          />
        </div>

        <div className="mt-4 flex min-h-12 flex-col gap-3 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-[var(--adm-text-muted)]">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisibleSelection}
              disabled={visibleHistory.length === 0 || deleting}
              className="h-4 w-4 rounded border-[var(--adm-border-strong)] bg-black/30 accent-cyan-300"
            />
            Select all visible ({visibleHistory.length})
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--adm-text-faint)]">
              {selectedItemIds.size} selected
            </span>
            {selectedItemIds.size > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedItemIds(new Set())}
                disabled={deleting}
                className="rounded-lg px-3 py-2 text-xs font-bold text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface-2)] hover:text-[var(--adm-text)] disabled:opacity-40"
              >
                Clear selection
              </button>
            ) : null}
            <AdminButton
              tone="danger"
              onClick={() =>
                void removeItems(
                  data.items.filter((item) => selectedItemIds.has(item.id)),
                )
              }
              disabled={
                selectedItemIds.size === 0 ||
                selectedHasPendingDecision ||
                deleting ||
                Boolean(busyItemId)
              }
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              {deleting ? "Removing…" : "Remove selected"}
            </AdminButton>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--adm-border)]">
          <div className="hidden grid-cols-[32px_minmax(260px,1fr)_130px_120px_120px_150px_48px] gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--adm-text-faint)] xl:grid">
            <span /><span>Product</span><span>Status</span><span>Cost</span><span>Sell price</span><span>Catalog</span><span />
          </div>
          <div className="divide-y divide-white/10">
            {visibleHistory.map((item) => (
              <div key={item.id}>
                <div className="grid gap-3 bg-[var(--adm-surface)] px-3 py-3 xl:grid-cols-[32px_minmax(260px,1fr)_130px_120px_120px_150px_48px] xl:items-center xl:px-4">
                  <label className="flex items-center xl:justify-center">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      disabled={deleting}
                      className="h-4 w-4 rounded border-[var(--adm-border-strong)] bg-black/30 accent-cyan-300"
                      aria-label={`Select ${item.title}`}
                    />
                    <span className="ml-2 text-xs font-semibold text-[var(--adm-text-faint)] xl:hidden">
                      Select
                    </span>
                  </label>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)]">
                      {item.imageUrls[0] ? (
                        <Image src={item.imageUrls[0]} alt="" fill sizes="56px" className="object-contain p-1.5" />
                      ) : <PhotoIcon className="m-4 h-6 w-6 text-[var(--adm-text-faint)]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--adm-text)]">{item.title}</p>
                        {item.sourceChanges?.length ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e2a136] bg-[#fff4dd] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#81560e]"
                            title={`${item.sourceChanges.length} supplier fields changed`}
                          >
                            <FlagIcon className="h-3 w-3" />
                            {item.sourceChanges.length} changed
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--adm-text-faint)]">
                        {item.manufacturer || "Bloomtech"} · {item.sku || item.handle}
                      </p>
                      {item.importError ? <p className="mt-1 text-xs text-[#81560e]">{item.importError}</p> : null}
                    </div>
                  </div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${statusTone(item.status)}`}>{item.status.replace("_", " ")}</span></div>
                  <p className="text-sm font-semibold text-[var(--adm-text)]"><span className="mr-2 text-xs text-[var(--adm-text-faint)] xl:hidden">Cost</span>{formatMoney(item.costCents)}</p>
                  <p className="text-sm font-semibold text-[var(--adm-text)]">
                    <span className="mr-2 text-xs text-[var(--adm-text-faint)] xl:hidden">Sell</span>
                    {formatMoney(item.priceCents)}
                    {item.compareAtCents ? (
                      <del className="ml-2 text-xs font-medium text-[var(--adm-text-faint)]">
                        {formatMoney(item.compareAtCents)}
                      </del>
                    ) : null}
                  </p>
                  <div>
                    {item.linkedProduct ? (
                      <Link href={`/admin/catalog/${item.linkedProduct.id}`} className="inline-flex items-center text-xs font-semibold text-[var(--adm-primary)] hover:text-[var(--adm-primary)]">
                        Open draft <ArrowTopRightOnSquareIcon className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    ) : <span className="text-xs text-[var(--adm-text-faint)]">Not linked</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
                    className="inline-flex h-8 w-10 items-center justify-center rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                    aria-label={`${expandedId === item.id ? "Collapse" : "Expand"} ${item.title}`}
                  >
                    {expandedId === item.id ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                  </button>
                </div>
                {expandedId === item.id ? (
                  <div className="grid gap-4 bg-[var(--adm-surface-2)] px-4 py-4 lg:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm leading-6 text-[var(--adm-text-muted)]">
                        {item.shortDescription || item.technicalDetails || "No description available."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--adm-text-faint)]">
                        <span>Stock: {item.stockQuantity}</span>
                        <span>Weight: {item.weightGrams ? `${item.weightGrams} g` : "—"}</span>
                        <span>GTIN: {item.gtin || "—"}</span>
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--adm-primary)] hover:text-[var(--adm-primary)]">Supplier page</a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <AdminButton
                        tone="secondary"
                        onClick={() => openEditor(item)}
                        disabled={pendingDeckDecisions.current.has(item.id)}
                      >
                        Edit fields
                      </AdminButton>
                      {item.status !== "APPROVED" ? (
                        <AdminButton
                          onClick={() => void updateItem(item, { decision: "APPROVED" })}
                          disabled={
                            busyItemId === item.id ||
                            pendingDeckDecisions.current.has(item.id)
                          }
                        >
                          {item.status === "IMPORT_ERROR" ? "Retry import" : "Approve"}
                        </AdminButton>
                      ) : null}
                      {item.status !== "DECLINED" ? (
                        <AdminButton
                          tone="danger"
                          onClick={() => void updateItem(item, { decision: "DECLINED" })}
                          disabled={
                            busyItemId === item.id ||
                            pendingDeckDecisions.current.has(item.id)
                          }
                        >
                          Decline
                        </AdminButton>
                      ) : (
                        <AdminButton
                          tone="secondary"
                          onClick={() => void updateItem(item, { decision: "PENDING" })}
                          disabled={
                            busyItemId === item.id ||
                            pendingDeckDecisions.current.has(item.id)
                          }
                        >
                          Return to queue
                        </AdminButton>
                      )}
                      <AdminButton
                        tone="danger"
                        onClick={() => void removeItems([item])}
                        disabled={
                          deleting ||
                          busyItemId === item.id ||
                          pendingDeckDecisions.current.has(item.id)
                        }
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        Remove
                      </AdminButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {visibleHistory.length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--adm-text-faint)]">No review items match these filters.</p>
            ) : null}
          </div>
        </div>
      </AdminPanel>

      {editingItem && editDraft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close editor" onClick={() => setEditingItem(null)} />
          <section role="dialog" aria-modal="true" aria-labelledby="supplier-edit-title" className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--adm-primary)]">Review copy</p>
                <h2 id="supplier-edit-title" className="mt-1 text-xl font-bold text-[var(--adm-text)]">Edit product fields</h2>
                <p className="mt-1 text-sm text-[var(--adm-text-muted)]">Approved items synchronize these fields to their linked catalog product.</p>
              </div>
              <button type="button" onClick={() => setEditingItem(null)} className="inline-flex h-8 w-10 items-center justify-center rounded-lg border border-[var(--adm-border)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]" aria-label="Close editor">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <AdminField label="Title"><AdminInput value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })} /></AdminField>
              <AdminField label="Manufacturer"><AdminInput value={editDraft.manufacturer} onChange={(event) => setEditDraft({ ...editDraft, manufacturer: event.target.value })} /></AdminField>
              <AdminField label="Handle"><AdminInput value={editDraft.handle} onChange={(event) => setEditDraft({ ...editDraft, handle: event.target.value })} /></AdminField>
              <AdminField label="SKU"><AdminInput value={editDraft.sku} onChange={(event) => setEditDraft({ ...editDraft, sku: event.target.value })} /></AdminField>
              <AdminField label="GTIN"><AdminInput value={editDraft.gtin} onChange={(event) => setEditDraft({ ...editDraft, gtin: event.target.value })} /></AdminField>
              <AdminField label="Weight (grams)"><AdminInput type="number" min="0" value={editDraft.weightGrams} onChange={(event) => setEditDraft({ ...editDraft, weightGrams: event.target.value })} /></AdminField>
              <AdminField label="Supplier cost (€)"><AdminInput inputMode="decimal" value={editDraft.cost} onChange={(event) => setEditDraft({ ...editDraft, cost: event.target.value })} /></AdminField>
              <AdminField label="Sell price (€)"><AdminInput inputMode="decimal" value={editDraft.price} onChange={(event) => setEditDraft({ ...editDraft, price: event.target.value })} /></AdminField>
              <AdminField label="Compare-at price (€)" optional="Original price before discount"><AdminInput inputMode="decimal" value={editDraft.compareAt} onChange={(event) => setEditDraft({ ...editDraft, compareAt: event.target.value })} /></AdminField>
              <AdminField label="Stock quantity"><AdminInput type="number" min="0" value={editDraft.stockQuantity} onChange={(event) => setEditDraft({ ...editDraft, stockQuantity: event.target.value })} /></AdminField>
              <AdminField label="Image URLs" optional="One per line"><AdminTextarea rows={4} value={editDraft.imageUrls} onChange={(event) => setEditDraft({ ...editDraft, imageUrls: event.target.value })} /></AdminField>
              <div className="md:col-span-2"><AdminField label="Short description"><AdminTextarea rows={3} value={editDraft.shortDescription} onChange={(event) => setEditDraft({ ...editDraft, shortDescription: event.target.value })} /></AdminField></div>
              <div className="md:col-span-2"><AdminField label="Description"><AdminTextarea rows={6} value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} /></AdminField></div>
              <div className="md:col-span-2"><AdminField label="Technical details"><AdminTextarea rows={5} value={editDraft.technicalDetails} onChange={(event) => setEditDraft({ ...editDraft, technicalDetails: event.target.value })} /></AdminField></div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AdminButton tone="secondary" onClick={() => setEditingItem(null)}>Cancel</AdminButton>
              <AdminButton onClick={() => void saveEditor()} disabled={busyItemId === editingItem.id}>
                {busyItemId === editingItem.id ? "Saving…" : "Save changes"}
              </AdminButton>
            </div>
          </section>
        </div>
      ) : null}
    </AdminPage>
  );
}
