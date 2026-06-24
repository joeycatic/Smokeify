"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BoltIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ArchiveBoxArrowDownIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FlagIcon,
  InboxStackIcon,
  LinkIcon,
  PhotoIcon,
  QueueListIcon,
  Squares2X2Icon,
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
  stockQuantity: number;
  weightGrams: number | null;
  imageUrls: string[];
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
  stockQuantity: String(item.stockQuantity),
  weightGrams: item.weightGrams === null ? "" : String(item.weightGrams),
  imageUrls: item.imageUrls.join("\n"),
});

const parseEuroCents = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

const statusTone = (status: ImportItem["status"]) => {
  if (status === "APPROVED") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (status === "DECLINED") return "border-rose-400/20 bg-rose-400/10 text-rose-200";
  if (status === "IMPORT_ERROR") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
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
  const [historyFilter, setHistoryFilter] = useState<"ALL" | ImportItem["status"]>("ALL");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ImportItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

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
  const latestBatch = data.batches[0] ?? null;
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

  const refreshWorkspace = async () => {
    const response = await fetch("/api/admin/supplier-import", { cache: "no-store" });
    const next = (await response.json()) as WorkspaceData & { error?: string };
    if (!response.ok) throw new Error(next.error ?? "Could not refresh supplier imports.");
    setData(next);
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
        text: `${result.batch.fetchedCount} products added to review. ${result.batch.skippedCount} previously reviewed products skipped.`,
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
      const response = await fetch(`/api/admin/supplier-import/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { item?: ImportItem; error?: string };
      if (!response.ok || !result.item) throw new Error(result.error ?? "Item update failed.");
      setData((current) => ({
        ...current,
        items: current.items.map((entry) => (entry.id === result.item!.id ? result.item! : entry)),
      }));
      return result.item;
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

  const decideCurrent = async (decision: "APPROVED" | "DECLINED") => {
    if (!currentItem || busyItemId) return;
    const direction = decision === "APPROVED" ? "right" : "left";
    setExitDirection(direction);
    window.setTimeout(async () => {
      try {
        await updateItem(currentItem, { decision });
        setNotice({
          tone: "success",
          text:
            decision === "APPROVED"
              ? `${currentItem.title} was transferred to Catalog as a draft.`
              : `${currentItem.title} was declined and retained in review history.`,
        });
      } catch {
        // The API error is already surfaced and the refreshed item remains available.
      } finally {
        setExitDirection(null);
        setDrag({ x: 0, y: 0, active: false });
      }
    }, 230);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!currentItem || busyItemId) return;
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

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <section className={styles.hero} aria-labelledby="supplier-import-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.kicker}>
              <ArchiveBoxArrowDownIcon className="h-4 w-4" />
              <span>Catalog / Supplier Import</span>
            </div>
            <h1 id="supplier-import-title">Bloomtech review deck</h1>
            <p>
              Controlled supplier intake with draft creation, traceable decisions, and
              queue telemetry in one workspace.
            </p>
            <div className={styles.heroChips} aria-label="Supplier import status">
              <span className={fetching ? styles.liveChip : ""}>
                <BoltIcon className="h-3.5 w-3.5" />
                {deckStatus}
              </span>
              <span>
                <QueueListIcon className="h-3.5 w-3.5" />
                {compactNumber(counts.pending)} pending
              </span>
              <span>
                <Squares2X2Icon className="h-3.5 w-3.5" />
                {reviewCompletion}% reviewed
              </span>
            </div>
          </div>
          <div className={styles.heroPanel} aria-label="Review queue summary">
            <div className={styles.heroPanelTop}>
              <div>
                <p>Active queue</p>
                <strong>{compactNumber(counts.pending)}</strong>
              </div>
              <div className={styles.orbitBadge}>
                <InboxStackIcon className="h-5 w-5" />
              </div>
            </div>
            <div className={styles.progressTrack} aria-hidden="true">
              <span style={{ width: `${reviewCompletion}%` }} />
            </div>
            <div className={styles.metricGrid}>
              {[
                ["Approved", counts.approved, "emerald"],
                ["Declined", counts.declined, "rose"],
                ["Errors", counts.errors, "amber"],
              ].map(([label, value, tone]) => (
                <div key={label} className={styles.metricTile} data-tone={tone}>
                  <span>{label}</span>
                  <strong>{compactNumber(value as number)}</strong>
                </div>
              ))}
            </div>
            <div className={styles.latestBatch}>
              <span>Latest batch</span>
              <strong>
                {latestBatch
                  ? `${latestBatch.status} · ${compactNumber(latestBatch.fetchedCount)} added`
                  : "No supplier scans yet"}
              </strong>
            </div>
          </div>
        </div>
      </section>

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

            <div className={styles.categoryPicker}>
              <div className={styles.categoryPickerHeader}>
                <span>Additional categories</span>
                {selectedAdditionalCategories.length ? (
                  <button
                    type="button"
                    onClick={() => setAdditionalCategoryIds([])}
                    disabled={fetching}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className={styles.categoryChips}>
                {data.categories
                  .filter((category) => category.id !== mainCategoryId)
                  .map((category) => {
                    const selected = additionalCategoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleAdditionalCategory(category.id)}
                        disabled={fetching}
                        className={selected ? styles.categoryChipSelected : ""}
                        aria-pressed={selected}
                      >
                        {category.name}
                      </button>
                    );
                  })}
              </div>
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
              />
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
                    {currentCatalogProduct ? (
                      <div
                        className={styles.existingProductFlag}
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
                      <div className="flex h-full items-center justify-center text-slate-600">
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
                      className={`${styles.stamp} right-7 text-emerald-300`}
                      style={{
                        "--stamp-opacity": drag.x > 0 ? dragStrength : 0,
                        "--stamp-rotate": "8deg",
                      } as CSSProperties}
                    >
                      APPROVE
                    </div>
                    <div
                      className={`${styles.stamp} left-7 text-rose-300`}
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
                        <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-cyan-300">
                          {currentItem.manufacturer || "Bloomtech"}
                        </p>
                        <h3 className="mt-1 max-w-md text-xl font-black leading-tight text-white sm:text-2xl">
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
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur hover:bg-black/60"
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
                        </div>
                      ))}
                    </div>
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
                      <p className="line-clamp-3 text-sm leading-5 text-slate-400">
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
                <div className="max-w-md rounded-[28px] border border-dashed border-emerald-400/25 bg-emerald-400/[0.04] p-10 text-center">
                  <CheckIcon className="mx-auto h-14 w-14 text-emerald-300" />
                  <h3 className="mt-4 text-xl font-bold text-white">The deck is clear</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
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
              disabled={!currentItem || Boolean(busyItemId)}
              className={`${styles.actionButton} inline-flex min-h-12 items-center justify-center rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 font-bold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <XMarkIcon className="mr-2 h-5 w-5" /> Decline
            </button>
            <button
              type="button"
              onClick={() => void decideCurrent("APPROVED")}
              disabled={!currentItem || Boolean(busyItemId)}
              className={`${styles.actionButton} inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-300 px-4 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40`}
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
              <div className={`${styles.pulse} rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4`}>
                <p className="text-sm font-semibold text-cyan-100">Scanning Bloomtech</p>
                <p className="mt-1 text-xs leading-5 text-cyan-200/65">
                  Supplier authentication, listing discovery, and product extraction are running.
                </p>
              </div>
            ) : null}
            {data.batches.length ? data.batches.map((batch) => (
              <div key={batch.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {new URL(batch.sourceUrl).pathname.replace(/^\/+/, "") || "Bloomtech"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(batch.createdAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[9px] font-bold tracking-[0.14em] ${
                    batch.status === "FAILED"
                      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                      : batch.status === "PARTIAL"
                        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                        : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  }`}>
                    {batch.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-black/20 px-3 py-2 text-slate-400">
                    Added <strong className="float-right text-white">{batch.fetchedCount}</strong>
                  </div>
                  <div className="rounded-lg bg-black/20 px-3 py-2 text-slate-400">
                    Skipped <strong className="float-right text-white">{batch.skippedCount}</strong>
                  </div>
                </div>
                {batch.errorMessage ? <p className="mt-2 text-xs text-rose-300">{batch.errorMessage}</p> : null}
              </div>
            )) : (
              <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
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
                    ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.025] text-slate-400 hover:text-white"
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

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[minmax(260px,1fr)_130px_120px_120px_150px_48px] gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 xl:grid">
            <span>Product</span><span>Status</span><span>Cost</span><span>Sell price</span><span>Catalog</span><span />
          </div>
          <div className="divide-y divide-white/10">
            {visibleHistory.map((item) => (
              <div key={item.id}>
                <div className="grid gap-3 bg-[#070b10] px-3 py-3 xl:grid-cols-[minmax(260px,1fr)_130px_120px_120px_150px_48px] xl:items-center xl:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                      {item.imageUrls[0] ? (
                        <Image src={item.imageUrls[0]} alt="" fill sizes="56px" className="object-contain p-1.5" />
                      ) : <PhotoIcon className="m-4 h-6 w-6 text-slate-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {item.manufacturer || "Bloomtech"} · {item.sku || item.handle}
                      </p>
                      {item.importError ? <p className="mt-1 text-xs text-amber-300">{item.importError}</p> : null}
                    </div>
                  </div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] ${statusTone(item.status)}`}>{item.status.replace("_", " ")}</span></div>
                  <p className="text-sm font-semibold text-slate-200"><span className="mr-2 text-xs text-slate-500 xl:hidden">Cost</span>{formatMoney(item.costCents)}</p>
                  <p className="text-sm font-semibold text-slate-200"><span className="mr-2 text-xs text-slate-500 xl:hidden">Sell</span>{formatMoney(item.priceCents)}</p>
                  <div>
                    {item.linkedProduct ? (
                      <Link href={`/admin/catalog/${item.linkedProduct.id}`} className="inline-flex items-center text-xs font-semibold text-cyan-300 hover:text-cyan-200">
                        Open draft <ArrowTopRightOnSquareIcon className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    ) : <span className="text-xs text-slate-600">Not linked</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => current === item.id ? null : item.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white"
                    aria-label={`${expandedId === item.id ? "Collapse" : "Expand"} ${item.title}`}
                  >
                    {expandedId === item.id ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                  </button>
                </div>
                {expandedId === item.id ? (
                  <div className="grid gap-4 bg-white/[0.018] px-4 py-4 lg:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm leading-6 text-slate-400">
                        {item.shortDescription || item.technicalDetails || "No description available."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                        <span>Stock: {item.stockQuantity}</span>
                        <span>Weight: {item.weightGrams ? `${item.weightGrams} g` : "—"}</span>
                        <span>GTIN: {item.gtin || "—"}</span>
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200">Supplier page</a>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <AdminButton tone="secondary" onClick={() => openEditor(item)}>Edit fields</AdminButton>
                      {item.status !== "APPROVED" ? (
                        <AdminButton onClick={() => void updateItem(item, { decision: "APPROVED" })} disabled={busyItemId === item.id}>
                          {item.status === "IMPORT_ERROR" ? "Retry import" : "Approve"}
                        </AdminButton>
                      ) : null}
                      {item.status !== "DECLINED" ? (
                        <AdminButton tone="danger" onClick={() => void updateItem(item, { decision: "DECLINED" })} disabled={busyItemId === item.id}>
                          Decline
                        </AdminButton>
                      ) : (
                        <AdminButton tone="secondary" onClick={() => void updateItem(item, { decision: "PENDING" })} disabled={busyItemId === item.id}>
                          Return to queue
                        </AdminButton>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {visibleHistory.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">No review items match these filters.</p>
            ) : null}
          </div>
        </div>
      </AdminPanel>

      {editingItem && editDraft ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close editor" onClick={() => setEditingItem(null)} />
          <section role="dialog" aria-modal="true" aria-labelledby="supplier-edit-title" className="relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#090e14] p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300">Review copy</p>
                <h2 id="supplier-edit-title" className="mt-1 text-xl font-bold text-white">Edit product fields</h2>
                <p className="mt-1 text-sm text-slate-400">Approved items synchronize these fields to their linked catalog product.</p>
              </div>
              <button type="button" onClick={() => setEditingItem(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:text-white" aria-label="Close editor">
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
    </div>
  );
}
