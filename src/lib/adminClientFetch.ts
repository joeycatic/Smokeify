"use client";

import {
  reportAdminRequestStatus,
  type AdminRequestStatusDetail,
} from "@/lib/adminClientRequestStatus";

type FetchAdminJsonOptions = RequestInit & {
  slowThresholdMs?: number;
  slowMessage?: string;
  slowDetail?: string;
  failureMessage?: string;
  failureDetail?: string;
};

async function emitSlowRequestStatus(
  startedAt: number,
  options: FetchAdminJsonOptions,
) {
  const slowThresholdMs = options.slowThresholdMs ?? 8_000;
  const elapsedMs = performance.now() - startedAt;
  if (elapsedMs < slowThresholdMs) return;

  reportAdminRequestStatus({
    kind: "warning",
    message: options.slowMessage ?? "Admin request was slow.",
    detail:
      options.slowDetail ??
      "Wait for the saved state to appear before repeating the action.",
  });
}

function emitFailureStatus(options: FetchAdminJsonOptions) {
  reportAdminRequestStatus({
    kind: "error",
    message: options.failureMessage ?? "Admin request failed.",
    detail:
      options.failureDetail ??
      "Reconnect and refresh the current workspace before retrying.",
  });
}

export async function fetchAdminJson<T>(
  input: RequestInfo | URL,
  options: FetchAdminJsonOptions = {},
) {
  const startedAt = performance.now();

  try {
    const response = await fetch(input, options);
    await emitSlowRequestStatus(startedAt, options);
    const data = (await response.json().catch(() => ({}))) as T;
    return { response, data };
  } catch (error) {
    emitFailureStatus(options);
    throw error;
  }
}

export function reportAdminFailureStatus(detail: Omit<AdminRequestStatusDetail, "kind">) {
  reportAdminRequestStatus({
    kind: "error",
    ...detail,
  });
}
