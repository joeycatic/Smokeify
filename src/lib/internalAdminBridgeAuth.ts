import "server-only";

import { timingSafeEqual } from "crypto";

const SHARED_CONTROL_PLANE_TOKEN =
  process.env.SHARED_CONTROL_PLANE_TOKEN?.trim() ||
  process.env.INTERNAL_ADMIN_BRIDGE_TOKEN?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  "";

function tokenMatches(candidate: string) {
  if (!SHARED_CONTROL_PLANE_TOKEN || !candidate) return false;
  const expected = Buffer.from(SHARED_CONTROL_PLANE_TOKEN);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isAuthorizedInternalAdminBridgeRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
  const headerToken = request.headers.get("x-shared-control-plane-token")?.trim() ?? "";
  return tokenMatches(bearerToken) || tokenMatches(headerToken);
}

export function getInternalAdminBridgeActor(request: Request) {
  return {
    id: request.headers.get("x-shared-admin-actor-id")?.trim() || null,
    email: request.headers.get("x-shared-admin-actor-email")?.trim() || null,
  };
}
