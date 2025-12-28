"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        <h1 className="text-3xl font-bold mb-3" style={{ color: "#2f3e36" }}>
          Verify code
        </h1>
        <p className="text-sm text-stone-600 mb-8">
          Gib den 6-stelligen Code aus der Email ein.
        </p>

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
                const data = (await res.json()) as { error?: string };
                setError(data.error ?? "Code ungueltig.");
                return;
              }
              const storedEmail =
                sessionStorage.getItem("smokeify_verify_email") || email;
              const storedPassword = sessionStorage.getItem(
                "smokeify_verify_password"
              );
              const returnTo =
                searchParams.get("returnTo") ||
                sessionStorage.getItem("smokeify_return_to") ||
                "/account";

              sessionStorage.removeItem("smokeify_verify_email");
              sessionStorage.removeItem("smokeify_verify_password");
              sessionStorage.removeItem("smokeify_return_to");

              if (storedPassword) {
                const signInResult = await signIn("credentials", {
                  email: storedEmail,
                  password: storedPassword,
                  redirect: false,
                  callbackUrl: returnTo,
                });
                if (signInResult?.ok) {
                  router.push(returnTo);
                  return;
                }
              }

              router.push(
                `/auth/signin?verified=1&email=${encodeURIComponent(email)}`
              );
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-3 rounded-md border border-black/10 bg-white p-4"
        >
          <label className="block text-xs font-semibold text-stone-600">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <label className="block text-xs font-semibold text-stone-600">
            Code
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
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Bitte warten..." : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/auth/signin")}
            className="w-full rounded-md border border-black/10 px-4 py-2 text-sm font-semibold text-stone-700"
          >
            Back to login
          </button>
        </form>
      </div>
    </PageLayout>
  );
}
