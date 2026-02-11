import crypto from "crypto";

const getSecret = () =>
  process.env.ORDER_VIEW_LINK_SECRET ?? process.env.INVOICE_DOWNLOAD_SECRET ?? "";

const sign = (payload: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(payload).digest("hex");

export const buildOrderViewToken = (orderId: string, expiresAt: number) => {
  const secret = getSecret();
  if (!secret) return null;
  return sign(`order-view.${orderId}.${expiresAt}`, secret);
};

export const verifyOrderViewToken = (
  orderId: string,
  expiresAt: number,
  token: string
) => {
  const secret = getSecret();
  if (!secret) return false;
  if (!Number.isFinite(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;
  const expected = sign(`order-view.${orderId}.${expiresAt}`, secret);
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
};

export const buildOrderViewUrl = (origin: string, orderId: string, daysValid = 30) => {
  const expiresAt = Date.now() + daysValid * 24 * 60 * 60 * 1000;
  const token = buildOrderViewToken(orderId, expiresAt);
  if (!token) return null;
  const url = new URL(`/order/view/${orderId}`, origin);
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("token", token);
  return url.toString();
};
