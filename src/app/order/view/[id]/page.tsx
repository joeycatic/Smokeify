import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyOrderViewToken } from "@/lib/orderViewLink";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

const normalizeOptions = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const name = typeof entry?.name === "string" ? entry.name : "";
      const val = typeof entry?.value === "string" ? entry.value : "";
      return name && val ? { name, value: val } : null;
    })
    .filter(
      (entry): entry is { name: string; value: string } => Boolean(entry)
    );
};

const formatItemOptions = (options?: Array<{ name: string; value: string }>) => {
  if (!options?.length) return "";
  return options
    .map((opt) => `${opt.name}: ${opt.value}`)
    .filter(Boolean)
    .join(" · ");
};

const formatOrderItemName = (name: string, manufacturer?: string | null) => {
  const defaultSuffix = /\s*[-—]\s*Default( Title)?(?=\s*\(|$)/i;
  if (!defaultSuffix.test(name)) return name;
  const trimmedManufacturer = manufacturer?.trim();
  if (trimmedManufacturer) {
    return name.replace(defaultSuffix, ` - ${trimmedManufacturer}`);
  }
  return name.replace(defaultSuffix, "").trim();
};

export default async function GuestOrderViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; expires?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const expiresAt = query.expires ? Number(query.expires) : NaN;
  const hasValidToken =
    typeof query.token === "string" &&
    Number.isFinite(expiresAt) &&
    verifyOrderViewToken(id, expiresAt, query.token);

  const session = hasValidToken ? null : await getServerSession(authOptions);
  if (!hasValidToken && !session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/order/view/${id}`)}`);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) {
    notFound();
  }

  if (!hasValidToken) {
    const isAdmin = session?.user?.role === "ADMIN";
    if (!isAdmin && order.userId !== session?.user?.id) {
      notFound();
    }
  }

  const productIds = Array.from(
    new Set(order.items.map((item) => item.productId).filter(Boolean))
  ) as string[];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, manufacturer: true },
      })
    : [];
  const manufacturerByProductId = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null])
  );

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-6 py-10 text-stone-800">
        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
                Bestellung
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-stone-900">
                {order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                {new Date(order.createdAt).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Gesamt
              </p>
              <p className="text-lg font-semibold text-emerald-900">
                {formatPrice(order.amountTotal, order.currency)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Versandadresse
              </h2>
              <div className="mt-2 text-sm text-stone-700">
                {order.shippingName && <div>{order.shippingName}</div>}
                {order.shippingLine1 && <div>{order.shippingLine1}</div>}
                {order.shippingLine2 && <div>{order.shippingLine2}</div>}
                {(order.shippingPostalCode || order.shippingCity) && (
                  <div>
                    {order.shippingPostalCode ?? ""} {order.shippingCity ?? ""}
                  </div>
                )}
                {order.shippingCountry && <div>{order.shippingCountry}</div>}
              </div>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Kontakt
              </h2>
              <div className="mt-2 text-sm text-stone-700">
                {order.customerEmail ?? "-"}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Artikel
            </h2>
            <ul className="mt-2 space-y-2">
              {order.items.map((item) => {
                const itemName = formatOrderItemName(
                  item.name,
                  item.productId
                    ? manufacturerByProductId.get(item.productId)
                    : null
                );
                const options = normalizeOptions(item.options);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{itemName}</div>
                      {options.length > 0 && (
                        <div className="text-[11px] text-stone-500">
                          {formatItemOptions(options)}
                        </div>
                      )}
                      <div className="text-xs text-stone-500">Qty {item.quantity}</div>
                    </div>
                    <div className="font-semibold text-stone-900">
                      {formatPrice(item.totalAmount, item.currency)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 rounded-xl border border-black/10 bg-stone-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Zwischensumme</span>
              <span>{formatPrice(order.amountSubtotal, order.currency)}</span>
            </div>
            {order.amountDiscount > 0 && (
              <div className="mt-1 flex items-center justify-between">
                <span>
                  Rabatt{order.discountCode ? ` (${order.discountCode})` : ""}
                </span>
                <span>-{formatPrice(order.amountDiscount, order.currency)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between">
              <span>Versand</span>
              <span>{formatPrice(order.amountShipping, order.currency)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Steuern</span>
              <span>{formatPrice(order.amountTax, order.currency)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2 font-semibold">
              <span>Gesamt</span>
              <span>{formatPrice(order.amountTotal, order.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
