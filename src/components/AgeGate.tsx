"use client";

import { useEffect, useState } from "react";

type GateStatus = "verified" | "denied" | null;

const STORAGE_KEY = "smokeify_age_gate";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readStatus(): GateStatus {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "verified" || stored === "denied") {
    return stored;
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]+)`)
  );
  const value = match?.[1];
  if (value === "verified" || value === "denied") {
    window.localStorage.setItem(STORAGE_KEY, value);
    return value;
  }
  return null;
}

function persistStatus(value: Exclude<GateStatus, null>) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  window.localStorage.setItem(STORAGE_KEY, value);
  document.cookie = `${STORAGE_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

export default function AgeGate() {
  const [status, setStatus] = useState<GateStatus>(null);

  useEffect(() => {
    setStatus(readStatus());
  }, []);

  if (status) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-black/10 bg-white p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.22)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/40">
          Altersbeschränkung
        </p>
        <h2 className="mt-3 text-xl font-semibold text-[#2f3e36] sm:text-2xl">
          Dieser Shop ist nur für Personen ab 18 Jahren.
        </h2>
        <p className="mt-3 text-sm text-stone-600">
          Bitte bestätige, dass du volljährig bist.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              persistStatus("verified");
              setStatus("verified");
              window.dispatchEvent(new Event("age-gate-verified"));
            }}
            className="h-11 rounded-full bg-[#21483b] px-5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-[#1c3d32]"
          >
            Ich bin 18+
          </button>
          <button
            type="button"
            onClick={() => {
              persistStatus("denied");
              setStatus("denied");
              window.location.href = "/pages/jugendschutzhinweise";
            }}
            className="h-11 rounded-full border border-black/15 px-5 text-xs font-semibold uppercase tracking-wide text-stone-700 hover:border-black/30"
          >
            Ich bin unter 18
          </button>
        </div>
      </div>
    </div>
  );
}
