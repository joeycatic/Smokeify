import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

const getSecret = (): string => {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("No secret configured for unsubscribe tokens");
  return s;
};

export const generateUnsubscribeToken = (email: string): string =>
  createHmac("sha256", getSecret())
    .update(email.toLowerCase().trim())
    .digest("hex");

export const verifyUnsubscribeToken = (email: string, token: string): boolean => {
  try {
    const expected = generateUnsubscribeToken(email);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(token, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

export const buildUnsubscribeUrl = (baseUrl: string, email: string): string => {
  const token = generateUnsubscribeToken(email);
  return `${baseUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
};
