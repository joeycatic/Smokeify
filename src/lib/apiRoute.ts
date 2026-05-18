import { NextResponse } from "next/server";

type ApiRateLimitMeta = {
  limit?: number;
  remaining?: number;
  resetAt?: Date | null;
};

type ApiResponseOptions = {
  noStore?: boolean;
  noIndex?: boolean;
  rateLimit?: ApiRateLimitMeta;
};

const applyCacheHeaders = (headers: Headers, noStore: boolean) => {
  if (!noStore) return;
  headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
};

const applyIndexHeaders = (headers: Headers, noIndex: boolean) => {
  if (!noIndex) return;
  headers.set("X-Robots-Tag", "noindex, nofollow");
};

const applyRateLimitHeaders = (headers: Headers, rateLimit?: ApiRateLimitMeta) => {
  if (!rateLimit) return;
  if (typeof rateLimit.limit === "number") {
    headers.set("X-RateLimit-Limit", String(rateLimit.limit));
  }
  if (typeof rateLimit.remaining === "number") {
    headers.set("X-RateLimit-Remaining", String(Math.max(0, rateLimit.remaining)));
  }
  if (rateLimit.resetAt instanceof Date) {
    headers.set("X-RateLimit-Reset", rateLimit.resetAt.toISOString());
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000),
    );
    headers.set("Retry-After", String(retryAfterSeconds));
  }
};

export const finalizeApiResponse = (
  response: NextResponse,
  options: ApiResponseOptions = {},
) => {
  const { noStore = true, noIndex = true, rateLimit } = options;
  applyCacheHeaders(response.headers, noStore);
  applyIndexHeaders(response.headers, noIndex);
  applyRateLimitHeaders(response.headers, rateLimit);
  return response;
};

export const jsonApi = (
  body: unknown,
  init?: ResponseInit,
  options?: ApiResponseOptions,
) => finalizeApiResponse(NextResponse.json(body, init), options);

export const emptyApi = (
  status = 204,
  options?: ApiResponseOptions,
) => finalizeApiResponse(new NextResponse(null, { status }), options);

export const hasJsonContentType = (request: Request) => {
  const contentType = request.headers.get("content-type");
  return typeof contentType === "string" && contentType.includes("application/json");
};
