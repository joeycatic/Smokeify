"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";

type PerfPayload =
  | {
      kind: "web-vital";
      name: string;
      value: number;
      rating: string;
      id: string;
      path: string;
      navigationType?: string;
    }
  | {
      kind: "page-resources";
      path: string;
      htmlTransferSize: number;
      staticTransferSize: number;
      scriptTransferSize: number;
      stylesheetTransferSize: number;
      scriptResourceCount: number;
      stylesheetResourceCount: number;
    };

const PERF_ENDPOINT = "/api/monitoring/perf";

function sendPayload(payload: PerfPayload) {
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

function reportPageResources(path: string) {
  if (typeof performance === "undefined") return;

  const navigationEntries = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  const navigationEntry = navigationEntries[0];
  const resourceEntries = performance.getEntriesByType(
    "resource",
  ) as PerformanceResourceTiming[];

  let staticTransferSize = 0;
  let scriptTransferSize = 0;
  let stylesheetTransferSize = 0;
  let scriptResourceCount = 0;
  let stylesheetResourceCount = 0;

  for (const entry of resourceEntries) {
    if (!entry.name.includes("/_next/static/")) continue;
    staticTransferSize += entry.transferSize || 0;
    if (entry.initiatorType === "script") {
      scriptTransferSize += entry.transferSize || 0;
      scriptResourceCount += 1;
      continue;
    }
    if (entry.initiatorType === "link") {
      stylesheetTransferSize += entry.transferSize || 0;
      stylesheetResourceCount += 1;
    }
  }

  sendPayload({
    kind: "page-resources",
    path,
    htmlTransferSize: navigationEntry?.transferSize || 0,
    staticTransferSize,
    scriptTransferSize,
    stylesheetTransferSize,
    scriptResourceCount,
    stylesheetResourceCount,
  });
}

export default function WebVitalsReporter() {
  const pathname = usePathname() ?? "/";
  const lastReportedPathRef = useRef<string | null>(null);

  useReportWebVitals((metric) => {
    sendPayload({
      kind: "web-vital",
      id: metric.id,
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: pathname,
      navigationType:
        "navigationType" in metric ? String(metric.navigationType) : undefined,
    });
  });

  useEffect(() => {
    if (lastReportedPathRef.current === pathname) return;
    lastReportedPathRef.current = pathname;

    const timeoutId = window.setTimeout(() => {
      reportPageResources(pathname);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}

