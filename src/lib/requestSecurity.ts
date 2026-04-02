import { getConfiguredRequestHosts } from "@/lib/orderSource";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const isSameOrigin = (request: Request) => {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const allowedHosts = getConfiguredRequestHosts();
  if (allowedHosts.size === 0) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      return allowedHosts.has(originHost);
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    const refererHost = new URL(referer).host.toLowerCase();
    return allowedHosts.has(refererHost);
  } catch {
    return false;
  }
};
