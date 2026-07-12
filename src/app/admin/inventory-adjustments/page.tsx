import Link from "next/link";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  isMissingInventoryStorageError,
  isMissingProcurementStorageError,
} from "@/lib/adminStorageGuards";
import { prisma } from "@/lib/prisma";
import AdminInventoryAdjustmentsClient from "./AdminInventoryAdjustmentsClient";
import { AdminPage, AdminPageHeader, AdminPrimaryGrid } from "@/components/admin/ui";

const PAGE_SIZE = 50;

const inventoryAdjustmentSelect = Prisma.validator<Prisma.InventoryAdjustmentSelect>()({
  id: true,
  variantId: true,
  productId: true,
  orderId: true,
  sourceType: true,
  sourceId: true,
  actorId: true,
  note: true,
  sourceReference: true,
  quantityDelta: true,
  reason: true,
  createdAt: true,
  product: {
    select: {
      id: true,
      title: true,
      manufacturer: true,
      supplierId: true,
      supplierRef: { select: { name: true } },
    },
  },
  variant: { select: { title: true, sku: true } },
  order: { select: { id: true, orderNumber: true } },
});

const purchaseOrderReceiptInclude =
  Prisma.validator<Prisma.PurchaseOrderReceiptInclude>()({
    purchaseOrder: {
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  });

type InventoryAdjustmentRow = Prisma.InventoryAdjustmentGetPayload<{
  select: typeof inventoryAdjustmentSelect;
}>;

type PurchaseOrderReceiptRow = Prisma.PurchaseOrderReceiptGetPayload<{
  include: typeof purchaseOrderReceiptInclude;
}>;

const formatDate = (value: Date | string | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function parsePositiveInt(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function getParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminInventoryAdjustmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await requireAdminScope("inventory.read"))) notFound();

  const resolvedSearchParams = (await searchParams) ?? {};
  const page = parsePositiveInt(resolvedSearchParams.page);
  const query = getParam(resolvedSearchParams, "query").trim();
  const sourceType = getParam(resolvedSearchParams, "sourceType").trim();
  const supplierId = getParam(resolvedSearchParams, "supplierId").trim();
  const reference = getParam(resolvedSearchParams, "reference").trim();
  let inventoryStorageAvailable = true;

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let totalCount = 0;
  let adjustments: InventoryAdjustmentRow[] = [];
  let purchaseReceipts: PurchaseOrderReceiptRow[] = [];

  try {
    const referenceNumeric = Number(reference);
    const orderIdsForReference =
      reference && Number.isFinite(referenceNumeric)
        ? (
            await prisma.order.findMany({
              where: { orderNumber: Math.floor(referenceNumeric) },
              select: { id: true },
            })
          ).map((order) => order.id)
        : [];
    const purchaseReceiptIdsForReference =
      reference && Number.isFinite(referenceNumeric)
        ? (
            await prisma.purchaseOrderReceipt.findMany({
              where: {
                purchaseOrder: {
                  purchaseOrderNumber: Math.floor(referenceNumeric),
                },
              },
              select: { id: true },
            })
          ).map((receipt) => receipt.id)
        : [];
    const purchaseReceiptIdsForSupplier = supplierId
      ? (
          await prisma.purchaseOrderReceipt.findMany({
            where: {
              purchaseOrder: {
                supplierId,
              },
            },
            select: { id: true },
          })
        ).map((receipt) => receipt.id)
      : [];

    const whereClauses: Prisma.InventoryAdjustmentWhereInput[] = [];

    if (query) {
      whereClauses.push({
        OR: [
          { product: { title: { contains: query, mode: "insensitive" } } },
          { product: { manufacturer: { contains: query, mode: "insensitive" } } },
          { variant: { title: { contains: query, mode: "insensitive" } } },
          { variant: { sku: { contains: query, mode: "insensitive" } } },
        ],
      });
    }

    if (sourceType === "ORDER") {
      whereClauses.push({
        OR: [{ sourceType: "ORDER" }, { orderId: { not: null } }],
      });
    } else if (sourceType === "PURCHASE_ORDER_RECEIPT") {
      whereClauses.push({ sourceType: "PURCHASE_ORDER_RECEIPT" });
    }

    if (supplierId) {
      whereClauses.push({
        OR: [
          { product: { supplierId } },
          {
            sourceId: {
              in: purchaseReceiptIdsForSupplier.length
                ? purchaseReceiptIdsForSupplier
                : ["__none__"],
            },
          },
        ],
      });
    }

    if (reference) {
      whereClauses.push({
        OR: [
          {
            orderId: { in: orderIdsForReference.length ? orderIdsForReference : ["__none__"] },
          },
          {
            sourceId: {
              in: purchaseReceiptIdsForReference.length
                ? purchaseReceiptIdsForReference
                : ["__none__"],
            },
          },
        ],
      });
    }

    const where: Prisma.InventoryAdjustmentWhereInput =
      whereClauses.length > 0 ? { AND: whereClauses } : {};

    [totalCount, adjustments] = await Promise.all([
      prisma.inventoryAdjustment.count({ where }),
      prisma.inventoryAdjustment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: inventoryAdjustmentSelect,
      }),
    ]);

    const purchaseReceiptIds = Array.from(
      new Set(
        adjustments
          .filter(
            (adjustment) =>
              adjustment.sourceType === "PURCHASE_ORDER_RECEIPT" && adjustment.sourceId,
          )
          .map((adjustment) => adjustment.sourceId as string),
      ),
    );
    purchaseReceipts = purchaseReceiptIds.length
      ? await prisma.purchaseOrderReceipt.findMany({
          where: { id: { in: purchaseReceiptIds } },
          include: purchaseOrderReceiptInclude,
        })
      : [];
  } catch (error) {
    if (
      !isMissingInventoryStorageError(error) &&
      !isMissingProcurementStorageError(error)
    ) {
      throw error;
    }

    inventoryStorageAvailable = false;
  }

  const purchaseReceiptById = new Map(purchaseReceipts.map((receipt) => [receipt.id, receipt]));
  const actorIds = Array.from(
    new Set(
      adjustments.map((entry) => entry.actorId).filter((entry): entry is string => Boolean(entry)),
    ),
  );
  const actorRows = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const actorById = new Map(
    actorRows.map((actor) => [actor.id, actor.name ?? actor.email ?? actor.id]),
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const buildPageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (sourceType) params.set("sourceType", sourceType);
    if (supplierId) params.set("supplierId", supplierId);
    if (reference) params.set("reference", reference);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/admin/inventory-adjustments${params.toString() ? `?${params.toString()}` : ""}`;
  };

  return (
    <AdminPage layout="master-detail" className="admin-console-page">
      {!inventoryStorageAvailable ? (
        <div className="rounded-xl border border-[#e2a136] bg-[#fff4dd] px-4 py-3 text-sm text-[#81560e]">
          Inventory-Ledger-Storage ist in der aktuellen Datenbank nicht vollst&auml;ndig
          verf&uuml;gbar. Bewegungen mit Purchase-Order-Referenzen und neuere Ledger-Felder
          bleiben leer, bis die fehlenden Inventory- und Procurement-Migrationen angewendet
          wurden.
        </div>
      ) : null}

      <AdminPageHeader
        eyebrow="Admin / Inventory"
        title="Stock adjustments and ledger"
        description="Create audited corrections and trace movements by product, supplier, source, or reference."
        actions={<span className="inline-flex h-8 items-center rounded-[10px] border border-[var(--adm-border)] bg-[var(--adm-surface-2)] px-3 text-[13px] font-semibold text-[var(--adm-text-muted)]">{totalCount} adjustments</span>}
      >
        <form className="grid gap-2 lg:grid-cols-[1.8fr_1fr_1fr_1fr_auto]">
          <input
            name="query"
            defaultValue={query}
            placeholder="Search product, manufacturer, variant, SKU..."
            className="h-9 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)] focus:border-[var(--adm-primary)]"
          />
          <select
            name="sourceType"
            defaultValue={sourceType}
            className="h-9 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none focus:border-[var(--adm-primary)]"
          >
            <option value="">All sources</option>
            <option value="ORDER">Orders</option>
            <option value="PURCHASE_ORDER_RECEIPT">PO receipts</option>
          </select>
          <select
            name="supplierId"
            defaultValue={supplierId}
            className="h-9 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none focus:border-[var(--adm-primary)]"
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <input
            name="reference"
            defaultValue={reference}
            placeholder="Order # or PO #"
            className="h-9 rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm text-[var(--adm-text)] outline-none placeholder:text-[var(--adm-text-faint)] focus:border-[var(--adm-primary)]"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--adm-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--adm-primary-dim)]"
          >
            Apply filters
          </button>
        </form>
      </AdminPageHeader>

      <AdminPrimaryGrid rail="balanced">
      <AdminInventoryAdjustmentsClient
        inventoryStorageAvailable={inventoryStorageAvailable}
      />

      <section className="min-w-0">
      {adjustments.length === 0 ? (
        <div className="rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-sm text-[var(--adm-text-faint)]">
          No inventory adjustments match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--adm-border)] bg-[var(--adm-surface)] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-1 gap-3 border-b border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--adm-text-faint)] sm:grid-cols-[1.45fr_1fr_1fr_0.7fr_1.35fr_1.2fr]">
            <div>Item</div>
            <div>Reference</div>
            <div>Supplier</div>
            <div>Delta</div>
            <div>Source</div>
            <div>Time</div>
          </div>
          <div className="divide-y divide-[var(--adm-border)]">
            {adjustments.map((entry) => {
              const productName = entry.product.manufacturer
                ? `${entry.product.manufacturer} ${entry.product.title}`
                : entry.product.title;
              const purchaseReceipt =
                entry.sourceType === "PURCHASE_ORDER_RECEIPT" && entry.sourceId
                  ? purchaseReceiptById.get(entry.sourceId)
                  : null;
              const sourceLabel =
                entry.sourceType === "PURCHASE_ORDER_RECEIPT"
                  ? "PO receipt"
                  : entry.orderId || entry.sourceType === "ORDER"
                    ? "Order"
                    : entry.sourceType || entry.reason;

              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-[var(--adm-text-muted)] sm:grid-cols-[1.45fr_1fr_1fr_0.7fr_1.35fr_1.2fr]"
                >
                  <div>
                    <div className="font-semibold text-[var(--adm-text)]">{productName}</div>
                    <div className="text-xs text-[var(--adm-text-faint)]">
                      {entry.variant.title}
                      {entry.variant.sku ? ` · SKU ${entry.variant.sku}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--adm-text-muted)]">
                    {entry.order ? (
                      <Link
                        href={`/admin/orders/${entry.order.id}`}
                        className="text-[var(--adm-primary)] transition hover:text-[var(--adm-primary)]"
                      >
                        Order #{entry.order.orderNumber}
                      </Link>
                    ) : purchaseReceipt ? (
                      <Link
                        href={`/admin/procurement/${purchaseReceipt.purchaseOrderId}`}
                        className="text-[var(--adm-primary)] transition hover:text-[var(--adm-primary)]"
                      >
                        PO #{purchaseReceipt.purchaseOrder.purchaseOrderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-xs text-[var(--adm-text-muted)]">
                    {purchaseReceipt?.purchaseOrder.supplier.name ??
                      entry.product.supplierRef?.name ??
                      "—"}
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      entry.quantityDelta >= 0 ? "text-[var(--adm-success)]" : "text-[#81560e]"
                    }`}
                  >
                    {entry.quantityDelta > 0 ? `+${entry.quantityDelta}` : entry.quantityDelta}
                  </div>
                  <div className="text-xs text-[var(--adm-primary)]">
                    <div>{sourceLabel}</div>
                    <div className="mt-1 text-[var(--adm-text-faint)]">{entry.reason}</div>
                    {entry.sourceReference ? (
                      <div className="mt-1 text-[var(--adm-text-faint)]">Ref: {entry.sourceReference}</div>
                    ) : null}
                    {entry.note ? <div className="mt-1 text-[var(--adm-text-faint)]">{entry.note}</div> : null}
                    {entry.actorId ? (
                      <div className="mt-1 text-[var(--adm-text-faint)]">
                        Actor: {actorById.get(entry.actorId) ?? entry.actorId}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--adm-text-faint)]">{formatDate(entry.createdAt)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </section>
      </AdminPrimaryGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[var(--adm-text-faint)]">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={buildPageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`inline-flex h-8 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              page <= 1
                ? "pointer-events-none border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-faint)]"
                : "border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
            }`}
          >
            Previous
          </Link>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`inline-flex h-8 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              page >= totalPages
                ? "pointer-events-none border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text-faint)]"
                : "border border-[var(--adm-border)] bg-[var(--adm-surface)] text-[var(--adm-text)] transition hover:border-[var(--adm-border-strong)] hover:bg-[var(--adm-surface-2)]"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </AdminPage>
  );
}
