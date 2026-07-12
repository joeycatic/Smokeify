"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  subscribeAdminRequestStatus,
  type AdminRequestStatusDetail,
} from "@/lib/adminClientRequestStatus";

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
  tone: "warning" | "error";
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
    return subscribeAdminRequestStatus((detail: AdminRequestStatusDetail) => {
      setProblem({
        id: Date.now(),
        message: detail.message,
        detail: detail.detail,
        tone: detail.kind,
      });
    });
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
        tone: visibleProblem.tone,
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
    state.tone === "critical" || state.tone === "error"
      ? "border-[var(--adm-error)] bg-[#fae7e3] text-[var(--adm-error)]"
      : "border-[#e2a136] bg-[#fff4dd] text-[#81560e]";

  return (
    <div className={`border-t px-2.5 py-1.5 text-xs sm:px-6 sm:py-2 sm:text-sm lg:px-8 ${toneClass}`}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{state.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] opacity-85 sm:text-xs">{state.detail}</p>
        </div>
        {visibleProblem ? (
          <button
            type="button"
            onClick={() => setDismissedProblemId(visibleProblem.id)}
            className="inline-flex h-8 items-center justify-center rounded-[10px] border border-current bg-[var(--adm-surface-2)]0 px-3 text-xs font-semibold"
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
