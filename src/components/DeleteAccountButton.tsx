"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function DeleteAccountButton() {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [modalError, setModalError] = useState("");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setModalError("");
          setConfirmText("");
          setModalOpen(true);
        }}
        disabled={status === "loading"}
        className="inline-flex h-12 items-center rounded-md border border-red-200 bg-red-50 px-5 text-base font-semibold text-red-700 transition hover:border-red-300 hover:opacity-90 disabled:opacity-60"
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
          <div className="w-full max-w-sm rounded-lg bg-white p-5 text-sm text-stone-800 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">
              Account löschen
            </h3>
            <p className="mt-2 text-xs text-stone-600">
              Tippe{" "}
              <span className="font-semibold text-red-600">Bestätigen</span>{" "}
              ein, um den Account endgültig zu löschen.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="mt-3 w-full rounded-md border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
              placeholder="Bestätigen"
            />
            {modalError && (
              <p className="mt-2 text-xs text-red-600">{modalError}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setModalError("");
                }}
                className="rounded-md border border-black/10 px-3 py-2 text-xs font-semibold text-stone-700 hover:border-black/30"
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
                className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
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
