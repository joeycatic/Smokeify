const DEFAULT_ADMIN_RETURN_TO = "/admin";

export function sanitizeAdminReturnTo(value?: string | null) {
  if (!value) {
    return DEFAULT_ADMIN_RETURN_TO;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_ADMIN_RETURN_TO;
  }

  return trimmed;
}

export function buildAdminReturnTo(pathname: string, search = "") {
  const safePathname = sanitizeAdminReturnTo(pathname);
  const safeSearch = search.startsWith("?") ? search : "";
  return `${safePathname}${safeSearch}`;
}

export function buildAdminLoginPath(returnTo?: string | null) {
  return `/auth/admin?returnTo=${encodeURIComponent(sanitizeAdminReturnTo(returnTo))}`;
}
