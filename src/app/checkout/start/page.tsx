"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function CheckoutStartPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const start = async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country: "DE" }),
        });
        const data = (await res.json().catch(() => null)) as
          | { url?: string; error?: string }
          | null;
        if (!res.ok || !data?.url) {
          setError(data?.error ?? "Checkout konnte nicht gestartet werden.");
          return;
        }
        window.location.assign(data.url);
      } catch {
        setError("Checkout konnte nicht gestartet werden.");
      }
    };

    void start();
  }, []);

  return (
    <PageLayout>
      <div className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        {error ? (
          <>
            <p className="text-lg font-semibold text-stone-900">
              Checkout fehlgeschlagen
            </p>
            <p className="mt-2 text-sm text-stone-500">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/cart")}
              className="mt-5 rounded-xl bg-[#2f3e36] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24312b]"
            >
              Zum Warenkorb
            </button>
          </>
        ) : (
          <>
            <LoadingSpinner
              size="md"
              className="border-[#2f3e36]/30 border-t-[#2f3e36]"
            />
            <p className="mt-4 text-sm font-medium text-stone-700">
              Du wirst zum sicheren Checkout weitergeleitet...
            </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
