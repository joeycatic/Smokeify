const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const getConfiguredHosts = () => {
  const hosts = new Set<string>();
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const rawAuthUrl = process.env.NEXTAUTH_URL?.trim();
  [rawAppUrl, rawAuthUrl].forEach((value) => {
    if (!value) return;
    try {
      hosts.add(new URL(value).host.toLowerCase());
    } catch {
      // Ignore malformed env values to avoid breaking every request.
    }
  });
  return hosts;
};

export const isSameOrigin = (request: Request) => {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const allowedHosts = getConfiguredHosts();
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
