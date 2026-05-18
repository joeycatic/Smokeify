const sanitizeHeaderValue = (value: string | null) =>
  value?.split(",")[0]?.trim() ?? "";

const getOriginFromEnv = () => {
  const candidates = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL];
  for (const candidate of candidates) {
    const raw = candidate?.trim();
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      // Ignore malformed values and continue with other candidates.
    }
  }
  return "";
};

export const getAppOrigin = (request?: Request) => {
  if (request) {
    const headerOrigin = sanitizeHeaderValue(request.headers.get("origin"));
    if (headerOrigin) {
      try {
        return new URL(headerOrigin).origin;
      } catch {
        // Fall through to host-based derivation.
      }
    }

    const host =
      sanitizeHeaderValue(request.headers.get("x-forwarded-host")) ||
      sanitizeHeaderValue(request.headers.get("host"));
    if (host) {
      const proto =
        sanitizeHeaderValue(request.headers.get("x-forwarded-proto")) || "https";
      try {
        return new URL(`${proto}://${host}`).origin;
      } catch {
        // Fall through to env fallback.
      }
    }
  }

  return getOriginFromEnv() || "http://localhost:3000";
};
