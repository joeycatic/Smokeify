import "server-only";

import { GROWVAULT_PUBLIC_URL } from "@/lib/growvaultPublicStorefront";

const SHARED_CONTROL_PLANE_TOKEN =
  process.env.SHARED_CONTROL_PLANE_TOKEN?.trim() ||
  process.env.INTERNAL_ADMIN_BRIDGE_TOKEN?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  "";

type AdminBridgeFetchOptions = {
  method?: string;
  body?: string;
  actor?: {
    id: string;
    email: string | null;
  };
};

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

export function hasGrowvaultAnalyzerAdminBridge() {
  return Boolean(GROWVAULT_PUBLIC_URL && SHARED_CONTROL_PLANE_TOKEN);
}

export async function fetchGrowvaultAnalyzerAdminJson<T>(
  pathname: string,
  search = "",
  input: AdminBridgeFetchOptions = {},
) {
  if (!hasGrowvaultAnalyzerAdminBridge()) {
    return null;
  }

  const target = new URL(pathname, `${GROWVAULT_PUBLIC_URL}/`);
  target.search = search;

  const response = await fetch(target, {
    method: input.method ?? "GET",
    headers: buildBridgeHeaders(input),
    body: input.body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}
