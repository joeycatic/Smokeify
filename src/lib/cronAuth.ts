import { createHash, timingSafeEqual } from "crypto";

// Hashes both values before comparing so timingSafeEqual always receives
// equal-length buffers, regardless of the input lengths.
const safeEqual = (a: string | null, b: string): boolean => {
  if (!a) return false;
  try {
    const bufA = createHash("sha256").update(a).digest();
    const bufB = createHash("sha256").update(b).digest();
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

export const getBearerToken = (authorizationHeader: string | null) => {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token || null;
};

export const isCronRequestAuthorized = ({
  authorizationHeader,
  headerSecret,
  expectedSecret,
}: {
  authorizationHeader: string | null;
  headerSecret: string | null;
  expectedSecret: string;
}) => {
  const bearerToken = getBearerToken(authorizationHeader);
  return safeEqual(bearerToken, expectedSecret) || safeEqual(headerSecret, expectedSecret);
};
