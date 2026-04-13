import { getConfiguredRequestHosts } from "@/lib/orderSource";
import { normalizeStorefrontHost, parseStorefrontHostFromUrl } from "@/lib/storefrontHosts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getRequestHost = (request: Request) =>
  normalizeStorefrontHost(request.headers.get("x-forwarded-host")) ??
  normalizeStorefrontHost(request.headers.get("host")) ??
  parseStorefrontHostFromUrl(request.url);

const isAllowedOriginHost = (host: string, requestHost: string | null, allowedHosts: Set<string>) =>
  host === requestHost || allowedHosts.has(host);

export const isSameOrigin = (request: Request) => {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const allowedHosts = getConfiguredRequestHosts();
  const requestHost = getRequestHost(request);
  if (!requestHost && allowedHosts.size === 0) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = normalizeStorefrontHost(new URL(origin).host);
      return originHost ? isAllowedOriginHost(originHost, requestHost, allowedHosts) : false;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    const refererHost = normalizeStorefrontHost(new URL(referer).host);
    return refererHost ? isAllowedOriginHost(refererHost, requestHost, allowedHosts) : false;
  } catch {
    return false;
  }
};
