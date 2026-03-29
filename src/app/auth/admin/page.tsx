"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Verify the account email before requesting admin access.",
  RATE_LIMIT: "Too many attempts. Admin login is temporarily rate-limited.",
  AccessDenied: "Admin access is restricted to admin accounts.",
  CredentialsSignin: "Invalid email or password.",
  ADMIN_MFA_REQUIRED:
    "This admin account requires an authenticator code after password verification.",
  INVALID_TOTP: "The authenticator code is invalid or has expired.",
};

function getAdminErrorMessage(code?: string | null) {
  if (!code) {
    return "Admin sign-in failed. Check your credentials and try again.";
  }

  return ADMIN_ERROR_MESSAGES[code] ?? "Admin sign-in failed. Check your credentials and try again.";
}

export default function AdminSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState(() => getAdminErrorMessage(searchParams.get("error")));
  const [errorHint, setErrorHint] = useState("");
  const [loading, setLoading] = useState(false);

  const returnTo = useMemo(() => {
    const next = searchParams.get("returnTo");
    if (!next || !next.startsWith("/")) {
      return "/admin";
    }
    return next;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setErrorHint("");

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
      if (response?.error === "RATE_LIMIT") {
        setErrorHint("Current admin limit: 4 attempts per identifier, 5 per IP, 3 per IP+identifier within 15 minutes.");
      } else if (response?.error === "ADMIN_MFA_REQUIRED") {
        setErrorHint("Enter the 6-digit code from your authenticator app to continue.");
      } else if (response?.error === "INVALID_TOTP") {
        setErrorHint("Codes rotate every 30 seconds. Wait for a fresh code and retry.");
      } else if (response?.error === "CredentialsSignin") {
        setErrorHint("Password re-entry is mandatory for admin access, even with an existing session.");
      }
    } catch {
      setError("Admin sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10 text-stone-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-500">
              Smokeify Admin
            </p>
            <h1 className="text-2xl font-semibold text-stone-950">
              Admin login
            </h1>
            <p className="text-sm leading-6 text-stone-600">
              Re-enter your credentials to continue to{" "}
              <span className="font-medium text-stone-900">{returnTo}</span>.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Email or username
              </span>
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-950"
                placeholder="admin@smokeify.de"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-950"
                placeholder="Enter your password"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Authenticator code
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                className="h-11 w-full rounded-xl border border-stone-300 bg-white px-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-950"
                placeholder="Optional unless MFA is enabled"
              />
            </label>

            <p className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
              Only admin accounts can continue. Every entry requires a fresh password, and MFA codes are required when enabled.
            </p>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{error}</p>
                {errorHint ? <p className="mt-2 text-xs text-red-600">{errorHint}</p> : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <LoadingSpinner size="sm" className="border-white/30 border-t-white" />
                  Verifying
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-500">
            <Link href="/auth/reset" className="transition hover:text-stone-900">
              Reset password
            </Link>
            <Link href="/" className="transition hover:text-stone-900">
              Return to storefront
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
