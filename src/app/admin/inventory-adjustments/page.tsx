import Link from "next/link";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import {
  isMissingInventoryStorageError,
  isMissingProcurementStorageError,
} from "@/lib/adminStorageGuards";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

const inventoryAdjustmentInclude = Prisma.validator<Prisma.InventoryAdjustmentInclude>()({
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
  include: typeof inventoryAdjustmentInclude;
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
        include: inventoryAdjustmentInclude,
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
    <div className="admin-legacy-page space-y-6">
      {!inventoryStorageAvailable ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Inventory-Ledger-Storage ist in der aktuellen Datenbank nicht vollst&auml;ndig
          verf&uuml;gbar. Bewegungen mit Purchase-Order-Referenzen und neuere Ledger-Felder
          bleiben leer, bis die fehlenden Inventory- und Procurement-Migrationen angewendet
          wurden.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,29,0.98),rgba(8,12,18,0.98))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
              Admin / Inventory
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Stock ledger</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Filter inventory movements by product, variant, supplier, source type, order reference, or purchase-order receipt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
              {totalCount} adjustments
            </div>
          </div>
        </div>

        <form className="mt-6 grid gap-3 lg:grid-cols-[1.8fr_1fr_1fr_1fr_auto]">
          <input
            name="query"
            defaultValue={query}
            placeholder="Search product, manufacturer, variant, SKU..."
            className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/30"
          />
          <select
            name="sourceType"
            defaultValue={sourceType}
            className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none focus:border-cyan-400/30"
          >
            <option value="">All sources</option>
            <option value="ORDER">Orders</option>
            <option value="PURCHASE_ORDER_RECEIPT">PO receipts</option>
          </select>
          <select
            name="supplierId"
            defaultValue={supplierId}
            className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none focus:border-cyan-400/30"
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
            className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/30"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Apply filters
          </button>
        </form>
      </section>

      {adjustments.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-500">
          No inventory adjustments match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#090d12] shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
          <div className="grid grid-cols-1 gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:grid-cols-[1.5fr_1fr_1fr_0.7fr_1.15fr_1.2fr]">
            <div>Item</div>
            <div>Reference</div>
            <div>Supplier</div>
            <div>Delta</div>
            <div>Source</div>
            <div>Time</div>
          </div>
          <div className="divide-y divide-white/5">
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
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm text-slate-300 sm:grid-cols-[1.5fr_1fr_1fr_0.7fr_1.15fr_1.2fr]"
                >
                  <div>
                    <div className="font-semibold text-slate-100">{productName}</div>
                    <div className="text-xs text-slate-500">
                      {entry.variant.title}
                      {entry.variant.sku ? ` · SKU ${entry.variant.sku}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {entry.order ? (
                      <Link
                        href={`/admin/orders/${entry.order.id}`}
                        className="text-cyan-300 transition hover:text-cyan-200"
                      >
                        Order #{entry.order.orderNumber}
                      </Link>
                    ) : purchaseReceipt ? (
                      <Link
                        href={`/admin/procurement/${purchaseReceipt.purchaseOrderId}`}
                        className="text-cyan-300 transition hover:text-cyan-200"
                      >
                        PO #{purchaseReceipt.purchaseOrder.purchaseOrderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {purchaseReceipt?.purchaseOrder.supplier.name ??
                      entry.product.supplierRef?.name ??
                      "—"}
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      entry.quantityDelta >= 0 ? "text-emerald-300" : "text-amber-300"
                    }`}
                  >
                    {entry.quantityDelta > 0 ? `+${entry.quantityDelta}` : entry.quantityDelta}
                  </div>
                  <div className="text-xs text-cyan-300">
                    <div>{sourceLabel}</div>
                    <div className="mt-1 text-slate-500">{entry.reason}</div>
                    {entry.note ? <div className="mt-1 text-slate-500">{entry.note}</div> : null}
                  </div>
                  <div className="text-xs text-slate-500">{formatDate(entry.createdAt)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Page {page} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={buildPageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              page <= 1
                ? "pointer-events-none border border-white/10 bg-white/[0.03] text-slate-600"
                : "border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.05]"
            }`}
          >
            Previous
          </Link>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ${
              page >= totalPages
                ? "pointer-events-none border border-white/10 bg-white/[0.03] text-slate-600"
                : "border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.05]"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
