import { getConfiguredRequestHosts } from "@/lib/orderSource";
import { normalizeStorefrontHost, parseStorefrontHostFromUrl } from "@/lib/storefrontHosts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getRequestHostCandidates = (request: Request) => [
  parseStorefrontHostFromUrl(request.url),
  normalizeStorefrontHost(request.headers.get("host")),
  normalizeStorefrontHost(request.headers.get("x-forwarded-host")),
].filter((host): host is string => Boolean(host));

const getRequestHostState = (request: Request) => {
  const candidates = Array.from(new Set(getRequestHostCandidates(request)));
  if (candidates.length > 1) {
    return { host: null, hasConflict: true };
  }
  return { host: candidates[0] ?? null, hasConflict: false };
};

const isAllowedOriginHost = (host: string, requestHost: string | null, allowedHosts: Set<string>) =>
  host === requestHost || allowedHosts.has(host);

export const isSameOrigin = (request: Request) => {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const allowedHosts = getConfiguredRequestHosts();
  const { host: requestHost, hasConflict } = getRequestHostState(request);
  if (hasConflict) return false;
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
