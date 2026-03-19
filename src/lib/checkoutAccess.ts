import { randomBytes } from "crypto";
import { hashToken } from "@/lib/security";

const GUEST_CHECKOUT_ACCESS_PREFIX = "guest-checkout";
const DEFAULT_GUEST_CHECKOUT_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;

const buildGuestCheckoutAccessPayload = (token: string, expiresAt: number) =>
  `${GUEST_CHECKOUT_ACCESS_PREFIX}.${token}.${expiresAt}`;

export const createGuestCheckoutAccess = (
  windowMs = DEFAULT_GUEST_CHECKOUT_ACCESS_WINDOW_MS
) => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + windowMs;
  const tokenHash = hashToken(buildGuestCheckoutAccessPayload(token, expiresAt));

  return {
    token,
    expiresAt,
    tokenHash,
  };
};

export const verifyGuestCheckoutAccess = ({
  token,
  expiresAt,
  expectedHash,
}: {
  token: string;
  expiresAt: number;
  expectedHash: string | null | undefined;
}) => {
  if (!token || !expectedHash) return false;
  if (!Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  const actualHash = hashToken(buildGuestCheckoutAccessPayload(token, expiresAt));
  return actualHash === expectedHash;
};

