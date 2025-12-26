"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  return (
    <PageLayout>
      <div className="mx-auto max-w-md px-6 py-12 text-stone-800">
        <h1 className="text-3xl font-bold mb-3" style={{ color: "#2f3e36" }}>
          Register
        </h1>
        <p className="text-sm text-stone-600 mb-8">
          Erstelle ein Konto. Du erhaeltst einen Code zur Bestaetigung.
        </p>

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
              router.push(`/auth/verify?email=${encodeURIComponent(email)}`);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-3 rounded-md border border-black/10 bg-white p-4"
        >
          <label className="block text-xs font-semibold text-stone-600">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
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
            Passwort
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
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Bitte warten..." : "Register"}
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
