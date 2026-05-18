import { NextResponse } from "next/server";

type TimedResult<T> = {
  result: T;
  durationMs: number;
};

type ServerTimingMetric = {
  name: string;
  durationMs: number;
  description?: string;
};

const roundDuration = (value: number) => Math.round(value * 100) / 100;

export function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export async function measureServerExecution<T>(
  label: string,
  fn: () => Promise<T> | T,
): Promise<TimedResult<T>> {
  const startedAt = getNow();
  const result = await fn();
  const durationMs = roundDuration(getNow() - startedAt);
  console.info(`[perf] ${label} ${durationMs}ms`);
  return { result, durationMs };
}

export function formatServerTiming(metrics: ServerTimingMetric[]) {
  return metrics
    .filter((metric) => Number.isFinite(metric.durationMs))
    .map((metric) => {
      const parts = [metric.name, `dur=${roundDuration(metric.durationMs)}`];
      if (metric.description) {
        parts.push(`desc="${metric.description.replace(/"/g, '\\"')}"`);
      }
      return parts.join(";");
    })
    .join(", ");
}

export function attachServerTiming(
  response: NextResponse,
  metrics: ServerTimingMetric[],
) {
  const headerValue = formatServerTiming(metrics);
  if (headerValue) {
    response.headers.set("Server-Timing", headerValue);
  }
  const totalDuration = metrics.reduce((sum, metric) => sum + metric.durationMs, 0);
  response.headers.set("X-Response-Time", `${roundDuration(totalDuration)}ms`);
  return response;
}

