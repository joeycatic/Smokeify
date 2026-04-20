"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type NetworkInformation = EventTarget & {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

type ConnectionProblem = {
  id: number;
  message: string;
  detail: string;
};

function getConnection() {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function isSlowConnection(connection: NetworkInformation | null) {
  if (!connection) return false;
  if (connection.saveData) return true;
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
    return true;
  }
  if (typeof connection.rtt === "number" && connection.rtt >= 1200) return true;
  if (typeof connection.downlink === "number" && connection.downlink > 0 && connection.downlink < 0.7) {
    return true;
  }
  return false;
}

function getConnectionDetail(connection: NetworkInformation | null) {
  if (!connection) return "Browser did not expose detailed network metrics.";
  const parts = [
    connection.effectiveType ? `type ${connection.effectiveType}` : null,
    typeof connection.rtt === "number" ? `${connection.rtt}ms RTT` : null,
    typeof connection.downlink === "number" ? `${connection.downlink} Mbps` : null,
    connection.saveData ? "data saver enabled" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Connection looks constrained.";
}

function subscribeNetworkState(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  const connection = getConnection();
  connection?.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
    connection?.removeEventListener("change", onStoreChange);
  };
}

function getNetworkSnapshot() {
  if (typeof navigator === "undefined") return getServerNetworkSnapshot();
  const connection = getConnection();
  return [
    navigator.onLine ? "1" : "0",
    isSlowConnection(connection) ? "1" : "0",
    getConnectionDetail(connection),
  ].join("\n");
}

function getServerNetworkSnapshot() {
  return "1\n0\n";
}

function isAdminRequest(input: Parameters<typeof fetch>[0]) {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.toString()
          : "";
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl, window.location.origin);
    return url.pathname.startsWith("/api/admin");
  } catch {
    return rawUrl.startsWith("/api/admin");
  }
}

function getRequestMethod(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

export default function AdminConnectionStatus() {
  const [problem, setProblem] = useState<ConnectionProblem | null>(null);
  const [dismissedProblemId, setDismissedProblemId] = useState<number | null>(null);
  const networkSnapshot = useSyncExternalStore(
    subscribeNetworkState,
    getNetworkSnapshot,
    getServerNetworkSnapshot,
  );
  const [onlineValue, slowConnectionValue, connectionDetail] = networkSnapshot.split("\n");
  const online = onlineValue === "1";
  const slowConnection = slowConnectionValue === "1";

  useEffect(() => {
    const originalFetch = window.fetch;
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const adminRequest = isAdminRequest(input);
      const method = getRequestMethod(input, init);
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
      const startedAt = performance.now();

      try {
        const response = await originalFetch(input, init);
        const elapsedMs = performance.now() - startedAt;
        if (adminRequest && elapsedMs >= 8000) {
          setProblem({
            id: Date.now(),
            message: "Admin request was slow.",
            detail: mutating
              ? "Wait for the saved state to appear before repeating this action."
              : "The page may be showing delayed operational data.",
          });
        }
        return response;
      } catch (error) {
        if (adminRequest) {
          setProblem({
            id: Date.now(),
            message: mutating ? "Admin change did not reach the server." : "Admin data request failed.",
            detail: mutating
              ? "Keep this tab open, reconnect, then refresh the record before retrying."
              : "Reconnect and reload this workspace if the data looks stale.",
          });
        }
        throw error;
      }
    };

    window.fetch = wrappedFetch;
    return () => {
      if (window.fetch === wrappedFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  const visibleProblem = problem && problem.id !== dismissedProblemId ? problem : null;
  const state = useMemo(() => {
    if (!online) {
      return {
        tone: "critical",
        title: "Offline",
        detail: "Admin changes will not save until the connection returns. Keep this tab open.",
      };
    }
    if (visibleProblem) {
      return {
        tone: "warning",
        title: visibleProblem.message,
        detail: visibleProblem.detail,
      };
    }
    if (slowConnection) {
      return {
        tone: "warning",
        title: "Slow connection detected",
        detail: `Confirm saved states before repeating actions. ${connectionDetail}`,
      };
    }
    return null;
  }, [connectionDetail, online, slowConnection, visibleProblem]);

  if (!state) return null;

  const toneClass =
    state.tone === "critical"
      ? "border-rose-400/25 bg-rose-500/15 text-rose-100"
      : "border-amber-400/25 bg-amber-400/15 text-amber-100";

  return (
    <div className={`border-t px-3 py-2 text-sm sm:px-6 lg:px-8 ${toneClass}`}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold">{state.title}</p>
          <p className="mt-0.5 text-xs opacity-85">{state.detail}</p>
        </div>
        {visibleProblem ? (
          <button
            type="button"
            onClick={() => setDismissedProblemId(visibleProblem.id)}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-black/10 px-3 text-xs font-semibold"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
