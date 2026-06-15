"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRightIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import LoadingSpinner from "@/components/LoadingSpinner";
import { sanitizeAdminReturnTo } from "@/lib/adminReturnTo";

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Bitte bestätige zuerst dein Konto.",
  RATE_LIMIT: "Zu viele Anmeldeversuche. Bitte warte kurz und versuche es erneut.",
  AccessDenied: "Anmeldung nicht möglich.",
  CredentialsSignin: "E-Mail, Benutzername oder Passwort ist nicht korrekt.",
  ADMIN_MFA_REQUIRED:
    "Für diese Anmeldung wird ein Authenticator-Code benötigt.",
  INVALID_TOTP: "Der eingegebene Code konnte nicht bestätigt werden.",
};

function getAdminErrorMessage(code?: string | null) {
  if (!code) {
    return "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
  }

  return ADMIN_ERROR_MESSAGES[code] ?? "Anmeldung fehlgeschlagen. Bitte versuche es erneut.";
}

function SmokeifyField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      <span className="flex items-baseline justify-between gap-3">
        {label}
        {optional ? (
          <span className="text-xs font-normal text-zinc-500">
            {optional}
          </span>
        ) : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function SmokeifyInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-emerald-300/45 focus:bg-white/[0.065] focus:ring-4 focus:ring-emerald-300/10 ${
        props.className ?? ""
      }`}
    />
  );
}

export default function AdminSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [referrerReturnTo, setReferrerReturnTo] = useState("");
  const [error, setError] = useState(() =>
    searchError ? getAdminErrorMessage(searchError) : "",
  );
  const [loading, setLoading] = useState(false);

  const searchReturnTo = useMemo(() => {
    return sanitizeAdminReturnTo(searchParams.get("returnTo"));
  }, [searchParams]);
  const returnTo = referrerReturnTo || searchReturnTo;

  useEffect(() => {
    if (searchReturnTo !== "/admin" || !document.referrer) {
      setReferrerReturnTo("");
      return;
    }

    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) {
        setReferrerReturnTo("");
        return;
      }

      if (referrer.pathname === "/admin" || referrer.pathname.startsWith("/admin/")) {
        setReferrerReturnTo(`${referrer.pathname}${referrer.search}`);
        return;
      }
    } catch {
      // Ignore malformed referrer values and keep the safe default.
    }

    setReferrerReturnTo("");
  }, [searchReturnTo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await signIn("credentials", {
        email,
        password,
        totpCode,
        adminIntent: "1",
        redirect: false,
        callbackUrl: returnTo,
      });

      if (response?.ok) {
        router.replace(returnTo);
        router.refresh();
        return;
      }

      setError(getAdminErrorMessage(response?.error));
    } catch {
      setError("Anmeldung fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-[#090b0c] px-4 py-8 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_32%),repeating-linear-gradient(90deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_88px)]"
      />
      <section className="relative w-full max-w-[25rem] overflow-hidden rounded-lg border border-white/10 bg-[#111416]/95 shadow-[0_24px_80px_rgba(0,0,0,0.52)]">
        <div className="h-1 w-full bg-[linear-gradient(90deg,#34d399,#f5d48b)]" />
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
              <LockClosedIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/70">
                Smokeify
              </p>
              <h1 className="text-2xl font-semibold tracking-normal text-white">
                Admin Login
              </h1>
            </div>
          </div>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <SmokeifyField label="E-Mail oder Benutzername">
              <SmokeifyInput
                type="text"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="name@smokeify.de"
              />
            </SmokeifyField>

            <SmokeifyField label="Passwort">
              <SmokeifyInput
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Passwort eingeben"
              />
            </SmokeifyField>

            <SmokeifyField label="Authenticator-Code" optional="Optional">
              <SmokeifyInput
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(event) =>
                  setTotpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
                }
                placeholder="6-stelliger Code"
              />
            </SmokeifyField>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-red-400/20 bg-red-400/10 px-3.5 py-3 text-sm text-red-100"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 shadow-[0_12px_30px_rgba(52,211,153,0.18)] hover:bg-emerald-200 focus:outline-none focus:ring-4 focus:ring-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" className="border-zinc-950/25 border-t-zinc-950" />
                  Anmeldung wird geprüft
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  Weiter
                  <ArrowRightIcon className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          <Link
            href="/auth/reset"
            className="mt-5 inline-flex text-sm font-medium text-zinc-400 hover:text-white focus:outline-none focus:ring-4 focus:ring-emerald-300/15"
          >
            Passwort vergessen?
          </Link>
        </div>
      </section>
    </main>
  );
}
