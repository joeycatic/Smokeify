"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <div className="rounded-md border border-black/10 bg-white p-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
              Registrieren
            </h1>
            <p className="text-sm text-stone-600 mb-6">
              Erstelle ein Konto. Du erhältst einen Code zur Bestaetigung.
            </p>
          </div>

          <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setLoading(true);
            try {
              const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
              });
              if (!res.ok) {
                const data = (await res.json()) as { error?: string };
                setError(data.error ?? "Registrierung fehlgeschlagen.");
                return;
              }
              const returnTo = searchParams.get("returnTo") || "/";
              sessionStorage.setItem("smokeify_verify_email", email);
              sessionStorage.setItem("smokeify_return_to", returnTo);
              router.push(
                `/auth/verify?email=${encodeURIComponent(
                  email
                )}&returnTo=${encodeURIComponent(returnTo)}`
              );
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-3"
          >
          <label className="block text-xs font-semibold text-stone-600">
            Username *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
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
            Passwort *
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full cursor-pointer rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Bitte warten..." : "Registrieren"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/auth/signin")}
            className="h-12 w-full cursor-pointer rounded-md border border-black/20 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
          >
            Zurück zum login
          </button>
        </form>
        </div>
      </div>
    </PageLayout>
  );
}

