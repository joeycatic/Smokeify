import crypto from "crypto";

const CODE_LENGTH = 6;

export function generateVerificationCode() {
  const max = 10 ** CODE_LENGTH;
  const code = String(crypto.randomInt(0, max)).padStart(CODE_LENGTH, "0");
  return code;
}

export function hashToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateDeviceToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function buildDeviceFingerprint(userAgent?: string | null) {
  return (userAgent ?? "").slice(0, 256);
}
