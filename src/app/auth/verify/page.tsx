"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "limited" | "error"
  >("idle");

  useEffect(() => {
    const initialEmail = searchParams.get("email");
    if (initialEmail) {
      setIdentifier(initialEmail);
      return;
    }
    const storedEmail = sessionStorage.getItem("smokeify_verify_email");
    if (storedEmail) setIdentifier(storedEmail);
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
                  body: JSON.stringify({ identifier, code }),
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
                  sessionStorage.getItem("smokeify_verify_email") || identifier;
                const returnTo =
                  searchParams.get("returnTo") ||
                  sessionStorage.getItem("smokeify_return_to") ||
                  "/account";

                const loginRes = await signIn("credentials", {
                  email: storedEmail,
                  redirect: false,
                  callbackUrl: returnTo,
                });
                if (loginRes?.ok) {
                  sessionStorage.removeItem("smokeify_verify_email");
                  sessionStorage.removeItem("smokeify_return_to");
                  router.push(returnTo);
                  return;
                }

                setError(
                  "Code bestaetigt, aber automatischer Login fehlgeschlagen. Bitte manuell einloggen."
                );
              } finally {
                setLoading(false);
              }
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-semibold text-stone-600">
              Email oder Username *
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
            />
            <label className="block text-xs font-semibold text-stone-600">
              Code *
            </label>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <input
                  key={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  required
                  value={code[index] ?? ""}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, "");
                    if (!next) {
                      const chars = code.split("");
                      chars[index] = "";
                      setCode(chars.join(""));
                      return;
                    }
                    const chars = code.split("");
                    chars[index] = next[0];
                    setCode(chars.join("").slice(0, 6));
                    const nextField = codeRefs.current[index + 1];
                    if (nextField) nextField.focus();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Backspace") return;
                    if (code[index]) {
                      const chars = code.split("");
                      chars[index] = "";
                      setCode(chars.join(""));
                      return;
                    }
                    const prevField = codeRefs.current[index - 1];
                    if (prevField) prevField.focus();
                  }}
                  onPaste={(event) => {
                    event.preventDefault();
                    const pasted = event.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, 6);
                    if (!pasted) return;
                    setCode(pasted);
                    const nextIndex = Math.min(pasted.length, 6) - 1;
                    const target = codeRefs.current[nextIndex];
                    if (target) target.focus();
                  }}
                  ref={(el) => {
                    codeRefs.current[index] = el;
                  }}
                  className="h-12 w-full rounded-md border border-black/10 text-center text-lg font-semibold text-stone-800 outline-none focus:border-black/30"
                />
              ))}
            </div>
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
                if (!identifier) {
                  setError("Bitte Email oder Username eingeben.");
                  return;
                }
                setResendStatus("sending");
                try {
                  const res = await fetch("/api/auth/resend-verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ identifier }),
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

