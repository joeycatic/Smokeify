"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PasswordChangeClient() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("saving");
    setError("");

    if (!currentPassword || !newPassword) {
      setError("Bitte alle Felder ausfuellen.");
      setStatus("error");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwoerter stimmen nicht ueberein.");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        setStatus("error");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setError("Update failed");
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-xs font-semibold text-stone-600">
        Aktuelles Passwort *
      </label>
      <input
        type="password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        required
      />
      <label className="block text-xs font-semibold text-stone-600">
        Neues Passwort *
      </label>
      <input
        type="password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        required
      />
      <label className="block text-xs font-semibold text-stone-600">
        Neues Passwort wiederholen *
      </label>
      <input
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        className="w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
        required
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {status === "ok" && <p className="text-xs text-green-700">Updated.</p>}
      <button
        type="submit"
        disabled={status === "saving"}
        className="h-12 w-full rounded-md bg-[#3a4b41] px-4 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Passwort ändern"}
      </button>
      <button
        type="button"
        onClick={() => router.push("/account")}
        className="h-12 w-full rounded-md border border-black/10 px-4 text-base font-semibold text-stone-700 transition hover:border-black/30 hover:opacity-90"
      >
        Zurück
      </button>
    </form>
  );
}
