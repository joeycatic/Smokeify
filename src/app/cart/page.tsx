"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import PageLayout from "@/components/PageLayout";

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

export default function CartPage() {
  const { cart, loading, updateLine, removeLines } = useCart();

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-stone-600">Warenkorb wird geladen...</p>
      </div>
    );
  }

  if (!cart || cart.lines.length === 0) {
    return (
        <PageLayout>
            <div className="mx-auto max-w-4xl px-6 py-10 text-black/80">
                <h1 className="text-2xl font-semibold mb-2">Dein Warenkorb ist leer</h1>
                <p className="text-stone-600 mb-6">Fuge Produkte hinzu und komm hierher zur Ubersicht.</p>
                <Link href="/products" className="text-green-700 font-semibold">
                Zu den Produkten
                </Link>
            </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
        <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold mb-8 text-black/80">Warenkorb</h1>

        <div className="grid gap-6 text-black/80">
            {cart.lines.map((line) => (
            <div key={line.id} className="flex gap-4 rounded-xl border border-stone-200 p-4">
                {line.merchandise.image?.url ? (
                <img
                    src={line.merchandise.image.url}
                    alt={line.merchandise.image.altText ?? line.merchandise.product.title}
                    className="h-24 w-24 rounded-lg object-cover"
                />
                ) : (
                <div className="h-24 w-24 rounded-lg bg-stone-100" />
                )}

                <div className="flex-1">
                <p className="text-sm text-stone-500">{line.merchandise.product.title}</p>
                <p className="text-base font-semibold">{line.merchandise.product.title}</p>

                <div className="mt-3 flex items-center gap-3">
                    <button
                    type="button"
                    onClick={() => {
                        if (line.quantity <= 1) {
                        removeLines([line.id]);
                        } else {
                        updateLine(line.id, line.quantity - 1);
                        }
                    }}
                    className="h-9 w-9 rounded-md border border-stone-300"
                    >
                    -
                    </button>
                    <span className="min-w-8 text-center">{line.quantity}</span>
                    <button
                    type="button"
                    onClick={() => updateLine(line.id, line.quantity + 1)}
                    className="h-9 w-9 rounded-md border border-stone-300"
                    >
                    +
                    </button>
                    <button
                    type="button"
                    onClick={() => removeLines([line.id])}
                    className="ml-2 text-sm text-red-600"
                    >
                    Entfernen
                    </button>
                </div>
                </div>

                <div className="text-right">
                <p className="text-sm text-stone-500">Preis</p>
                <p className="text-base font-semibold">
                    {formatPrice(line.merchandise.price.amount, line.merchandise.price.currencyCode)}
                </p>
                </div>
            </div>
            ))}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-stone-200 pt-6">
            <div>
            <p className="text-sm text-stone-500">Zwischensumme</p>
            <p className="text-xl text-black/80 font-semibold">
                {formatPrice(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode)}
            </p>
            </div>
            <a
            href={cart.checkoutUrl}
            className="rounded-md bg-black px-5 py-3 text-sm font-semibold text-white"
            >
            Zur Kasse
            </a>
        </div>
        </div>
    </PageLayout>
  );
}
