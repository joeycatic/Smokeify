const DEFAULT_ADMIN_REAUTH_TTL_MINUTES = 120;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAdminReauthTtlMs() {
  const minutes = parsePositiveInteger(
    process.env.ADMIN_REAUTH_TTL_MINUTES,
    DEFAULT_ADMIN_REAUTH_TTL_MINUTES
  );
  return minutes * 60 * 1000;
}

export function isFreshAdminReauth(adminVerifiedAt: unknown) {
  if (typeof adminVerifiedAt !== "number" || !Number.isFinite(adminVerifiedAt)) {
    return false;
  }

  return Date.now() - adminVerifiedAt <= getAdminReauthTtlMs();
}

export function hasAdminAccess({
  role,
  adminVerifiedAt,
  adminAccessDisabledAt,
  invalidated,
}: {
  role: unknown;
  adminVerifiedAt: unknown;
  adminAccessDisabledAt?: unknown;
  invalidated?: unknown;
}) {
  if (invalidated) {
    return false;
  }

  if (typeof adminAccessDisabledAt === "number" && Number.isFinite(adminAccessDisabledAt)) {
    return false;
  }

  return role === "ADMIN" && isFreshAdminReauth(adminVerifiedAt);
}

export function isAdminTotpEnabled(value: unknown) {
  return value === true;
}
