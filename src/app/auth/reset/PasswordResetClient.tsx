"use client";

import { useEffect, useRef, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

type Props = {
  initialEmail?: string;
  initialCode?: string;
  preferredSignInOrigin?: string | null;
  storefrontVariant?: "MAIN" | "GROW";
};

export default function PasswordResetClient({
  initialEmail = "",
  initialCode = "",
  preferredSignInOrigin = null,
  storefrontVariant = "MAIN",
}: Props) {
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestStatus, setRequestStatus] = useState<
    "idle" | "sending" | "sent" | "limited" | "error"
  >("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(initialEmail);
    setCode(initialCode);
    setNotice("");
  }, [initialCode, initialEmail]);

  useEffect(() => {
    if (initialCode.length !== 6) return;
    const timer = window.setTimeout(() => passwordRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [initialCode]);

  const prefilledFromLink = code.length === 6 && code === initialCode;
  const isGrowVariant = storefrontVariant === "GROW";
  const buildSignInDestination = (
    targetEmail: string,
    options?: { resetSuccess?: boolean }
  ) => {
    if (!preferredSignInOrigin) {
      const params = new URLSearchParams();
      if (targetEmail) {
        params.set("email", targetEmail);
      }
      if (options?.resetSuccess) {
        params.set("reset", "1");
      }
      const query = params.toString();
      return query ? `/auth/signin?${query}` : "/auth/signin";
    }

    const url = new URL("/auth/signin", preferredSignInOrigin);
    if (targetEmail) {
      url.searchParams.set("email", targetEmail);
    }
    if (options?.resetSuccess) {
      url.searchParams.set("reset", "1");
    }
    return url.toString();
  };

  const renderMessage = (
    tone: "success" | "error",
    message: string,
    secondary?: string
  ) =>
    isGrowVariant ? (
      <div
        className={`rounded-[18px] border px-4 py-3 text-sm leading-6 ${
          tone === "success"
            ? "border-[#3c6c49] bg-[#132418] text-[#d8ffe8]"
            : "border-[#6a2b2b] bg-[#2a1212] text-[#ffd7d7]"
        }`}
      >
        <p>{message}</p>
        {secondary ? <p className="mt-1 text-sm opacity-90">{secondary}</p> : null}
      </div>
    ) : (
      <p className={tone === "success" ? "text-xs text-green-700" : "text-xs text-red-600"}>
        {message}
      </p>
    );

  return (
    <div
      className={
        isGrowVariant
          ? "mx-auto max-w-3xl py-8 text-[#edf2ed] sm:py-10"
          : "mx-auto max-w-md px-6 py-12 text-stone-800"
      }
    >
      <div className={isGrowVariant ? "mx-auto max-w-[40rem]" : undefined}>
        <div
          className={
            isGrowVariant
              ? "relative overflow-hidden rounded-[30px] border border-[#243a28] bg-[radial-gradient(circle_at_top_left,rgba(163,230,53,0.12),transparent_28%),linear-gradient(180deg,#101b12,#081109)] px-6 py-6 text-[#edf2ed] shadow-[0_28px_90px_rgba(4,10,5,0.45)] sm:px-7 sm:py-7"
              : "rounded-md border border-black/10 bg-white p-6"
          }
        >
          {isGrowVariant ? (
            <>
              <div className="absolute left-0 top-0 h-32 w-32 -translate-x-8 -translate-y-8 rounded-full bg-[#a3e635]/12 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-36 w-36 translate-x-8 translate-y-10 rounded-full bg-[#7ddc53]/10 blur-3xl" />
            </>
          ) : null}
          <div className="text-center">
            {isGrowVariant ? (
              <>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a3e635]">
                  Smokeify Access
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#edf2ed]">
                  Passwort zurücksetzen
                </h1>
                <p className="mt-3 mb-6 text-sm leading-6 text-[#91a191]">
                  Öffne deinen Smokeify Zugang wieder mit einem Reset-Code und setze direkt ein neues Passwort.
                </p>
              </>
            ) : (
              <>
                <h1
                  className="mb-2 text-3xl font-bold"
                  style={{ color: "#2f3e36" }}
                >
                  Passwort zurücksetzen
                </h1>
                <p className="mb-6 text-sm text-stone-600">
                  Wir senden dir einen Code, mit dem du dein Passwort ändern kannst.
                </p>
              </>
            )}
          </div>

          {prefilledFromLink ? (
            isGrowVariant ? (
              <div className="mb-4 rounded-[18px] border border-[#3c6c49] bg-[#132418] px-4 py-3 text-sm leading-6 text-[#d8ffe8]">
                Der Reset-Code wurde aus dem E-Mail-Link übernommen. Du kannst direkt ein neues Passwort setzen.
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Der Reset-Code wurde aus dem E-Mail-Link übernommen. Du kannst direkt ein neues
                Passwort setzen.
              </div>
            )
          ) : null}

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setNotice("");
              if (newPassword !== confirmPassword) {
                setError("Passwoerter stimmen nicht ueberein.");
                return;
              }
              setSaving(true);
              try {
                const res = await fetch("/api/auth/password-reset/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, code, newPassword }),
                });
                if (!res.ok) {
                  if (res.status === 429) {
                    setError("Zu viele Versuche. Bitte später erneut versuchen.");
                    return;
                  }
                  const data = (await res.json()) as { error?: string };
                  setError(data.error ?? "Zurücksetzen fehlgeschlagen.");
                  return;
                }
                setNotice(
                  "Passwort aktualisiert. Du wirst jetzt zum Login weitergeleitet."
                );
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
                const nextDestination = buildSignInDestination(email, {
                  resetSuccess: true,
                });
                window.setTimeout(() => {
                  window.location.assign(nextDestination);
                }, 1800);
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-3"
          >
            <label
              className={
                isGrowVariant
                  ? "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91a191]"
                  : "block text-xs font-semibold text-stone-600"
              }
            >
              Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={
                isGrowVariant
                  ? "h-12 w-full rounded-[18px] border border-[#243328] bg-[#0d160f] px-4 text-sm text-[#edf2ed] outline-none placeholder:text-[#91a191] focus:border-[#a3e635]/40 focus:bg-[#132418] focus:ring-2 focus:ring-[#a3e635]/15"
                  : "w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              }
            />
            <button
              type="button"
              disabled={requestStatus === "sending"}
              onClick={async () => {
                setError("");
                setNotice("");
                if (!email) {
                  setError("Bitte Email eingeben.");
                  return;
                }
                setRequestStatus("sending");
                try {
                  const res = await fetch("/api/auth/password-reset/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                  });
                  if (res.status === 429) {
                    setRequestStatus("limited");
                    return;
                  }
                  if (!res.ok) {
                    setRequestStatus("error");
                    return;
                  }
                  setRequestStatus("sent");
                } catch {
                  setRequestStatus("error");
                }
              }}
              className={
                isGrowVariant
                  ? "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#243328] bg-[#101a12] px-4 text-sm font-semibold text-[#edf2ed] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a3e635]/30 hover:bg-[#132418] disabled:cursor-not-allowed disabled:opacity-60"
                  : "h-11 w-full rounded-md border border-black/20 px-4 text-sm font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90 disabled:opacity-60"
              }
            >
              {requestStatus === "sending" ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Senden...
                </span>
              ) : (
                "Code senden"
              )}
            </button>

            <label
              className={
                isGrowVariant
                  ? "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91a191]"
                  : "block text-xs font-semibold text-stone-600"
              }
            >
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
                  className={
                    isGrowVariant
                      ? "h-12 w-full rounded-[16px] border border-[#243328] bg-[#0d160f] text-center text-lg font-semibold text-[#edf2ed] outline-none focus:border-[#a3e635]/40 focus:bg-[#132418] focus:ring-2 focus:ring-[#a3e635]/15"
                      : "h-12 w-full rounded-md border border-black/10 text-center text-lg font-semibold text-stone-800 outline-none focus:border-black/30"
                  }
                />
              ))}
            </div>
            <label
              className={
                isGrowVariant
                  ? "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91a191]"
                  : "block text-xs font-semibold text-stone-600"
              }
            >
              Neues Passwort *
            </label>
            <input
              type="password"
              required
              ref={passwordRef}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={
                isGrowVariant
                  ? "h-12 w-full rounded-[18px] border border-[#243328] bg-[#0d160f] px-4 text-sm text-[#edf2ed] outline-none placeholder:text-[#91a191] focus:border-[#a3e635]/40 focus:bg-[#132418] focus:ring-2 focus:ring-[#a3e635]/15"
                  : "w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              }
            />
            <label
              className={
                isGrowVariant
                  ? "block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#91a191]"
                  : "block text-xs font-semibold text-stone-600"
              }
            >
              Passwort bestätigen *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={
                isGrowVariant
                  ? "h-12 w-full rounded-[18px] border border-[#243328] bg-[#0d160f] px-4 text-sm text-[#edf2ed] outline-none placeholder:text-[#91a191] focus:border-[#a3e635]/40 focus:bg-[#132418] focus:ring-2 focus:ring-[#a3e635]/15"
                  : "w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              }
            />

            {requestStatus === "sent" && (
              renderMessage("success", "Code wurde gesendet.")
            )}
            {requestStatus === "limited" && (
              renderMessage("error", "Zu viele Anfragen. Bitte später erneut versuchen.")
            )}
            {requestStatus === "error" && (
              renderMessage("error", "Code konnte nicht gesendet werden.")
            )}
            {notice ? renderMessage("success", notice) : null}
            {error ? renderMessage("error", error) : null}

            <button
              type="submit"
              disabled={saving}
              className={
                isGrowVariant
                  ? "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-[#a3e635] px-4 text-sm font-semibold text-[#081109] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  : "h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              }
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner
                    size="sm"
                    className="border-white/40 border-t-white"
                  />
                  Bitte warten...
                </span>
              ) : (
                "Passwort aktualisieren"
              )}
            </button>
            <button
              type="button"
              onClick={() => window.location.assign(buildSignInDestination(email))}
              className={
                isGrowVariant
                  ? "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#243328] bg-[#101a12] px-4 text-sm font-semibold text-[#edf2ed] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a3e635]/30 hover:bg-[#132418]"
                  : "h-12 w-full rounded-md border border-black/20 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
              }
            >
              Zurück zum login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
