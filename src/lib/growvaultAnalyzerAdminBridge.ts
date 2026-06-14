import "server-only";

import { GROWVAULT_PUBLIC_URL } from "@/lib/growvaultPublicStorefront";

const LOCAL_GROWVAULT_DEV_URL = "http://127.0.0.1:3000";
const SHARED_CONTROL_PLANE_TOKEN =
  process.env.SHARED_CONTROL_PLANE_TOKEN?.trim() ||
  process.env.INTERNAL_ADMIN_BRIDGE_TOKEN?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  "";
const EXPLICIT_GROWVAULT_ADMIN_BRIDGE_URL =
  process.env.GROWVAULT_ADMIN_BRIDGE_URL?.trim() ||
  process.env.INTERNAL_GROWVAULT_APP_URL?.trim() ||
  "";

type AdminBridgeFetchOptions = {
  method?: string;
  body?: string;
  actor?: {
    id: string;
    email: string | null;
  };
};

const BRIDGE_FETCH_TIMEOUT_MS = 5000;

function buildBridgeHeaders(input: AdminBridgeFetchOptions) {
  const headers = new Headers({
    Accept: "application/json",
  });

  if (input.body) {
    headers.set("Content-Type", "application/json");
  }
  if (SHARED_CONTROL_PLANE_TOKEN) {
    headers.set("Authorization", `Bearer ${SHARED_CONTROL_PLANE_TOKEN}`);
    headers.set("x-shared-control-plane-token", SHARED_CONTROL_PLANE_TOKEN);
  }
  if (input.actor?.id) {
    headers.set("x-shared-admin-actor-id", input.actor.id);
  }
  if (input.actor?.email) {
    headers.set("x-shared-admin-actor-email", input.actor.email);
  }
  return headers;
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function getGrowvaultAnalyzerAdminBridgeTargets() {
  const explicitTarget = normalizeUrl(EXPLICIT_GROWVAULT_ADMIN_BRIDGE_URL);
  if (explicitTarget) {
    return [explicitTarget];
  }

  const publicTarget = normalizeUrl(GROWVAULT_PUBLIC_URL);
  if (!publicTarget) {
    return [];
  }

  if (process.env.NODE_ENV !== "production") {
    return Array.from(new Set([LOCAL_GROWVAULT_DEV_URL, publicTarget]));
  }

  return [publicTarget];
}

export function hasGrowvaultAnalyzerAdminBridge() {
  return getGrowvaultAnalyzerAdminBridgeTargets().length > 0 && Boolean(SHARED_CONTROL_PLANE_TOKEN);
}

export function getGrowvaultAnalyzerAdminBridgeTarget() {
  return getGrowvaultAnalyzerAdminBridgeTargets()[0] ?? null;
}

export async function fetchGrowvaultAnalyzerAdminJson<T>(
  pathname: string,
  search = "",
  input: AdminBridgeFetchOptions = {},
) {
  if (!hasGrowvaultAnalyzerAdminBridge()) {
    return null;
  }

  const targets = getGrowvaultAnalyzerAdminBridgeTargets();
  let lastError: unknown = null;
  let lastTargetUrl: string | null = null;

  for (const baseUrl of targets) {
    lastTargetUrl = baseUrl;
    const target = new URL(pathname, `${baseUrl}/`);
    target.search = search;

    try {
      const response = await fetch(target, {
        method: input.method ?? "GET",
        headers: buildBridgeHeaders(input),
        body: input.body,
        cache: "no-store",
        signal: AbortSignal.timeout(BRIDGE_FETCH_TIMEOUT_MS),
      });

      const payload = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };

      if (!response.ok && response.status >= 500 && baseUrl !== targets.at(-1)) {
        lastError =
          payload.error ??
          `Growvault analyzer admin bridge returned ${response.status}.`;
        continue;
      }

      return {
        ok: response.ok,
        status: response.status,
        payload,
        targetUrl: baseUrl,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : "Growvault analyzer admin bridge request failed.";

  return {
    ok: false,
    status: null,
    payload: {
      error: message,
    } as T & { error?: string },
    targetUrl: lastTargetUrl,
  };
}
