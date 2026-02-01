import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReturnRequestForm from "./ReturnRequestForm";
import PageLayout from "@/components/PageLayout";

const formatPrice = (amount: number, currency: string) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    notFound();
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: { items: true, returnRequests: true },
  });

  if (!order) {
    notFound();
  }

  const productIds = Array.from(
    new Set(order.items.map((item) => item.productId).filter(Boolean)),
  ) as string[];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, manufacturer: true },
      })
    : [];
  const manufacturerByProductId = new Map(
    products.map((product) => [product.id, product.manufacturer ?? null]),
  );
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

  const itemsWithOptions = order.items.map((item) => ({
    ...item,
    options: normalizeOptions(item.options),
  }));

  const statusLabelMap: Record<string, string> = {
    PENDING_PAYMENT: "Ausstehend",
    PAID: "Bezahlt",
    FULFILLED: "Abgeschlossen",
    CANCELED: "Storniert",
    REFUNDED: "Erstattet",
  };
  const statusLabel = statusLabelMap[order.status] ?? order.status;
  const steps = ["Bestellt", "Versendet", "Zugestellt"];
  const activeStep =
    order.status === "FULFILLED" ? 2 : order.status === "PAID" ? 1 : 0;
  const defaultSuffix = / - Default( Title)?$/i;
  const formatItemName = (name: string, manufacturer?: string | null) => {
    if (!defaultSuffix.test(name)) return name;
    const trimmed = manufacturer?.trim();
    if (trimmed) return name.replace(defaultSuffix, ` - ${trimmed}`);
    return name.replace(defaultSuffix, "");
  };

  return (
    <PageLayout>
      <div className="relative mx-auto max-w-5xl px-6 py-10 text-stone-200">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(20,40,33,0.55),_transparent_60%),radial-gradient(circle_at_80%_20%,_rgba(17,60,46,0.4),_transparent_45%),radial-gradient(circle_at_10%_85%,_rgba(6,20,16,0.45),_transparent_55%)]" />
        <div className="rounded-3xl border border-white/10 bg-[#0f1713]/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-300/70">
                Bestellübersicht
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Bestellung {order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="mt-1 text-sm text-emerald-200/70">
                {new Date(order.createdAt).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-900/80 via-emerald-900/60 to-emerald-950/80 px-5 py-4 text-right shadow-lg">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">
                Gesamt
              </p>
              <p className="text-2xl font-bold text-emerald-50">
                {formatPrice(order.amountTotal, order.currency)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-[#121c17] px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-200/70">Status</span>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
                  {steps.map((label, index) => {
                    const isActive = index <= activeStep;
                    return (
                      <div key={label} className="flex flex-col items-center">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                            isActive
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                              : "border-emerald-900/60 bg-emerald-950/40 text-emerald-300/50"
                          }`}
                        >
                          {isActive ? "✓" : "•"}
                        </span>
                        <span
                          className={`mt-2 text-[11px] font-semibold ${
                            isActive ? "text-emerald-100" : "text-emerald-300/50"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121c17] px-5 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
                  Versandadresse
                </h2>
                <div className="mt-3 text-sm text-emerald-100/80">
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

              <div className="rounded-2xl border border-white/10 bg-[#121c17] px-5 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
                  Kontakt
                </h2>
                <div className="mt-3 text-sm text-emerald-100/80">
                  {order.customerEmail ?? "-"}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-[#121c17] px-5 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
                  Zahlungsübersicht
                </h2>
                <div className="mt-3 space-y-2 text-sm text-emerald-100/80">
                  <div className="flex items-center justify-between">
                    <span>Zwischensumme</span>
                    <span className="font-semibold text-emerald-50">
                      {formatPrice(order.amountSubtotal, order.currency)}
                    </span>
                  </div>
                  {order.amountDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <span>
                        Rabatt
                        {order.discountCode ? ` (${order.discountCode})` : ""}
                      </span>
                      <span className="font-semibold text-emerald-50">
                        -{formatPrice(order.amountDiscount, order.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Versand</span>
                    <span className="font-semibold text-emerald-50">
                      {formatPrice(order.amountShipping, order.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Steuern</span>
                    <span className="font-semibold text-emerald-50">
                      {formatPrice(order.amountTax, order.currency)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-base">
                    <span className="font-semibold text-emerald-100">Gesamt</span>
                    <span className="font-semibold text-emerald-50">
                      {formatPrice(order.amountTotal, order.currency)}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-200/50">
                    inkl. MwSt.
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`/api/orders/${order.id}/receipt`}
                    className="inline-flex items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
                  >
                    Beleg
                  </a>
                  <a
                    href={`/api/orders/${order.id}/invoice`}
                    className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-[#0f1713] px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-white/25 hover:bg-[#0b120f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
                  >
                    Rechnung
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#121c17] px-5 py-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
                  Versand-Tracking
                </h2>
                <div className="mt-3 space-y-2 text-sm text-emerald-100/70">
                  {[
                    { label: "Versanddienst", value: order.trackingCarrier ?? "-" },
                    { label: "Trackingnummer", value: order.trackingNumber ?? "-" },
                    { label: "Tracking-URL", value: order.trackingUrl ?? "-" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0c1410] px-3 py-2"
                    >
                      <span>{row.label}</span>
                      <span className="text-emerald-200/70">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#121c17] px-5 py-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
              Rückgabe
            </h2>
            <div className="mt-4">
              <ReturnRequestForm
                orderId={order.id}
                existingStatus={order.returnRequests[0]?.status ?? null}
                adminNote={order.returnRequests[0]?.adminNote ?? null}
                items={itemsWithOptions.map((item) => ({
                  id: item.id,
                  name: formatItemName(
                    item.name,
                    item.productId
                      ? manufacturerByProductId.get(item.productId)
                      : null,
                  ),
                  quantity: item.quantity,
                  imageUrl: item.imageUrl,
                  options: item.options,
                }))}
              />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
