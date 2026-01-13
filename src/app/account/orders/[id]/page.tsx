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

  return (
    <PageLayout>
      <div className="relative mx-auto max-w-5xl px-6 py-12 text-stone-800">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(46,125,50,0.14),_transparent_55%),radial-gradient(circle_at_20%_30%,_rgba(255,193,7,0.18),_transparent_40%),radial-gradient(circle_at_90%_10%,_rgba(33,150,243,0.12),_transparent_40%)]" />
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.15)] backdrop-blur">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                Bestellübersicht
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#2f3e36]">
                Bestellung {order.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                {new Date(order.createdAt).toLocaleDateString("de-DE")}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-emerald-700">
                Gesamt
              </p>
              <p className="text-2xl font-bold text-emerald-900">
                {formatPrice(order.amountTotal, order.currency)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-white via-emerald-50 to-emerald-100 px-4 py-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-stone-600">Status</span>
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                  {order.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-stone-600">Zahlung</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {order.paymentStatus}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-gradient-to-br from-white via-amber-50 to-amber-100 px-4 py-4 text-sm shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">Zwischensumme</span>
                <span className="font-semibold text-stone-900">
                  {formatPrice(order.amountSubtotal, order.currency)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-stone-600">Versand</span>
                <span className="font-semibold text-stone-900">
                  {formatPrice(order.amountShipping, order.currency)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-stone-600">Steuern</span>
                <span className="font-semibold text-stone-900">
                  {formatPrice(order.amountTax, order.currency)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base">
                <span className="font-semibold text-stone-900">Gesamt</span>
                <span className="font-semibold text-stone-900">
                  {formatPrice(order.amountTotal, order.currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm">
              <h2 className="text-xs font-semibold tracking-widest text-emerald-700 mb-2">
                Versandadresse
              </h2>
              <div className="text-sm text-stone-700">
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
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm">
              <h2 className="text-xs font-semibold tracking-widest text-emerald-700 mb-2">
                Kontakt
              </h2>
              <div className="text-sm text-stone-700">
                {order.customerEmail ?? "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm">
              <h2 className="text-xs font-semibold tracking-widest text-emerald-700 mb-2">
                Versand-Tracking
              </h2>
              <div className="space-y-1 text-sm text-stone-700">
                <div>
                  <span className="font-semibold text-stone-500">Carrier:</span>{" "}
                  {order.trackingCarrier ?? "-"}
                </div>
                <div>
                  <span className="font-semibold text-stone-500">Nummer:</span>{" "}
                  {order.trackingNumber ?? "-"}
                </div>
                <div>
                  <span className="font-semibold text-stone-500">URL:</span>{" "}
                  {order.trackingUrl ? (
                    <a
                      href={order.trackingUrl}
                      className="text-emerald-700 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Tracking öffnen
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm">
            <h2 className="text-xs font-semibold tracking-widest text-emerald-700 mb-2">
              Rueckgabe
            </h2>
            <ReturnRequestForm
              orderId={order.id}
              existingStatus={order.returnRequests[0]?.status ?? null}
              adminNote={order.returnRequests[0]?.adminNote ?? null}
            />
          </div>

          <div className="mt-8">
            {order.items.some((item) => item.imageUrl) && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold tracking-widest text-emerald-700 mb-3">
                  Artikelbilder
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {order.items
                    .filter((item) => item.imageUrl)
                    .map((item) => (
                      <img
                        key={item.id}
                        src={item.imageUrl as string}
                        alt={item.name}
                        className="h-20 w-20 flex-shrink-0 rounded-xl border border-black/10 bg-white object-cover"
                      />
                    ))}
                </div>
              </div>
            )}
            <h2 className="text-xs font-semibold tracking-widest text-emerald-700 mb-3">
              Artikel
            </h2>
            <ul className="space-y-2 text-sm">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-black/10 bg-gradient-to-r from-white via-sky-50 to-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <div className="font-semibold text-stone-900">
                      {item.name}
                    </div>
                    <div className="text-xs text-stone-500">
                      Menge: {item.quantity}
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold text-stone-900">
                    {formatPrice(item.totalAmount, item.currency)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
