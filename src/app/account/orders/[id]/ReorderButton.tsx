"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/CartProvider";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { addManyToCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          try {
            const res = await fetch(`/api/account/orders/${orderId}/reorder`, {
              method: "POST",
            });
            const data = (await res.json().catch(() => ({}))) as {
              items?: Array<{
                variantId: string;
                quantity: number;
                options?: Array<{ name: string; value: string }>;
              }>;
              error?: string;
            };
            if (!res.ok) {
              setMessage(data.error ?? "Erneut bestellen fehlgeschlagen.");
              return;
            }
            const items = data.items ?? [];
            if (items.length === 0) {
              setMessage("Keine verfügbaren Artikel zum erneuten Bestellen.");
              return;
            }
            await addManyToCart(items);
            router.push("/cart");
          } catch {
            setMessage("Erneut bestellen fehlgeschlagen.");
          } finally {
            setLoading(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-emerald-400/50 hover:bg-emerald-500/15 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1713]"
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" className="border-white/40 border-t-white" />
            Wird hinzugefügt...
          </>
        ) : (
          "Erneut bestellen"
        )}
      </button>
      {message && <p className="mt-2 text-xs text-emerald-200/75">{message}</p>}
    </div>
  );
}
