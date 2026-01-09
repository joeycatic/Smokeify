"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "limited" | "error"
  >("idle");

  useEffect(() => {
    const initialEmail = searchParams.get("email");
    if (initialEmail) {
      setEmail(initialEmail);
      return;
    }
    const storedEmail = sessionStorage.getItem("smokeify_verify_email");
    if (storedEmail) setEmail(storedEmail);
  }, [searchParams]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <div className="rounded-md border border-black/10 bg-white p-6">
          <div className="text-center">
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: "#2f3e36" }}
            >
              Verifizierung
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Gib den 6-stelligen Code aus der Email ein.
            </p>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setLoading(true);
              try {
                const res = await fetch("/api/auth/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, code }),
                });
                if (!res.ok) {
                  if (res.status === 429) {
                    setError(
                      "Zu viele Versuche. Bitte in 10 Minuten erneut versuchen."
                    );
                    return;
                  }
                  const data = (await res.json()) as { error?: string };
                  setError(data.error ?? "Code ungueltig.");
                  return;
                }
                const storedEmail =
                  sessionStorage.getItem("smokeify_verify_email") || email;
                const returnTo =
                  searchParams.get("returnTo") ||
                  sessionStorage.getItem("smokeify_return_to") ||
                  "/account";

                sessionStorage.removeItem("smokeify_verify_email");
                sessionStorage.removeItem("smokeify_return_to");

                router.push(
                  `/auth/signin?verified=1&email=${encodeURIComponent(
                    storedEmail
                  )}&returnTo=${encodeURIComponent(returnTo)}`
                );
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-semibold text-stone-600">
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
            <label className="block text-xs font-semibold text-stone-600">
              Code *
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={6}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm tracking-[0.3em] outline-none focus:border-black/30"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            {resendStatus === "sent" && (
              <p className="text-xs text-green-700">
                Wenn ein Konto existiert, wurde ein Code gesendet.
              </p>
            )}
            {resendStatus === "limited" && (
              <p className="text-xs text-red-600">
                Zu viele Versuche. Bitte spaeter erneut versuchen.
              </p>
            )}
            {resendStatus === "error" && (
              <p className="text-xs text-red-600">
                Senden fehlgeschlagen. Bitte spaeter erneut versuchen.
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full cursor-pointer rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner
                    size="sm"
                    className="border-white/40 border-t-white"
                  />
                  Bitte warten...
                </span>
              ) : (
                "Bestätigen"
              )}
            </button>
            <button
              type="button"
              disabled={resendStatus === "sending"}
              onClick={async () => {
                if (!email) {
                  setError("Bitte Email eingeben.");
                  return;
                }
                setResendStatus("sending");
                try {
                  const res = await fetch("/api/auth/resend-verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  if (res.status === 429) {
                    setResendStatus("limited");
                    return;
                  }
                  if (!res.ok) {
                    setResendStatus("error");
                    return;
                  }
                  setResendStatus("sent");
                } catch {
                  setResendStatus("error");
                }
              }}
              className="h-12 w-full cursor-pointer rounded-md border border-black/20 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90 disabled:opacity-60"
            >
              {resendStatus === "sending" ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Senden...
                </span>
              ) : (
                "Code erneut senden"
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push("/auth/signin")}
              className="h-12 w-full cursor-pointer rounded-md border border-black/20 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
            >
              Zurück zum Login
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}

