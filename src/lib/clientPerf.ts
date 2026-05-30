"use client";

type CustomPerfPayload = {
  kind: "custom-metric";
  name: string;
  value: number;
  path: string;
  detail?: string;
};

const PERF_ENDPOINT = "/api/monitoring/perf";

function sendPayload(payload: CustomPerfPayload) {
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(PERF_ENDPOINT, blob);
    return;
  }

  void fetch(PERF_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function reportClientPerfMetric(
  name: string,
  value: number,
  detail?: string,
  path?: string,
) {
  if (!Number.isFinite(value) || value < 0) return;
  sendPayload({
    kind: "custom-metric",
    name,
    value: Math.round(value * 100) / 100,
    detail,
    path:
      path ??
      (typeof window !== "undefined" ? window.location.pathname : "/"),
  });
}

