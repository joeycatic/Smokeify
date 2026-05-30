"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function DeleteAccountButton() {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [modalError, setModalError] = useState("");

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => {
          setModalError("");
          setConfirmText("");
          setPassword("");
          setModalOpen(true);
        }}
        disabled={status === "loading"}
        className="inline-flex h-12 w-full items-center justify-center rounded-full border border-[rgba(239,143,127,0.28)] bg-[rgba(62,26,24,0.82)] px-5 text-sm font-semibold text-[#ef8f7f] transition hover:-translate-y-0.5 hover:bg-[rgba(76,32,29,0.9)] disabled:opacity-60 sm:w-auto"
      >
        {status === "loading" ? (
          <span className="inline-flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Löschen...
          </span>
        ) : (
          "Account löschen"
        )}
      </button>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="smk-panel w-full max-w-sm rounded-[28px] p-4 text-sm text-[var(--smk-text)] shadow-xl sm:p-5">
            <h3 className="text-base font-semibold text-[var(--smk-text)]">
              Account löschen
            </h3>
            <p className="mt-2 text-xs text-[var(--smk-text-muted)]">
              Tippe{" "}
              <span className="font-semibold text-[#ef8f7f]">Bestätigen</span>{" "}
              ein, um den Account endgültig zu löschen.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="smk-input mt-3 w-full rounded-[18px] px-3 py-2.5 text-sm outline-none"
              placeholder="Bestätigen"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="smk-input mt-3 w-full rounded-[18px] px-3 py-2.5 text-sm outline-none"
              placeholder="Passwort"
            />
            {modalError && (
              <p className="mt-2 text-xs text-[#ef8f7f]">{modalError}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalError("");
                }}
                className="smk-button-secondary rounded-full px-3 py-2 text-xs font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirmText !== "Bestätigen") {
                    setModalError("Bitte Bestätigen eingeben.");
                    return;
                  }
                  setStatus("loading");
                  setModalError("");
                  try {
                    const res = await fetch("/api/account/delete", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password }),
                    });
                    if (!res.ok) {
                      const data = (await res.json()) as { error?: string };
                      setModalError(data.error ?? "Löschen fehlgeschlagen.");
                      setStatus("idle");
                      return;
                    }
                    await signOut({ callbackUrl: "/" });
                    setModalOpen(false);
                    setStatus("idle");
                  } catch {
                    setModalError("Löschen fehlgeschlagen.");
                    setStatus("idle");
                  }
                }}
                disabled={status === "loading"}
                className="rounded-full bg-[#8d3a32] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#a2443a] disabled:opacity-60"
              >
                {status === "loading" ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner
                      size="sm"
                      className="border-white/40 border-t-white"
                    />
                    Löschen...
                  </span>
                ) : (
                  "Löschen"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
