import crypto from "crypto";

const CODE_LENGTH = 6;
const TOTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;

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

function getSensitiveDataKey() {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for encrypted auth data.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function base32Decode(value: string) {
  const normalized = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const character of normalized) {
    const index = TOTP_ALPHABET.indexOf(character);
    if (index === -1) {
      throw new Error("Invalid base32 secret.");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(length = 32) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (const byte of bytes) {
    result += TOTP_ALPHABET[byte % TOTP_ALPHABET.length];
  }
  return result;
}

export function normalizeTotpCode(value: string) {
  return value.replace(/\s+/g, "").replace(/[^0-9]/g, "").slice(0, TOTP_DIGITS);
}

export function resolveTotpWindowSteps(windowSteps?: number) {
  if (typeof windowSteps === "number" && Number.isInteger(windowSteps) && windowSteps >= 0) {
    return windowSteps;
  }

  const configured = process.env.ADMIN_TOTP_WINDOW_STEPS?.trim();
  if (!configured) {
    return TOTP_WINDOW_STEPS;
  }

  const parsed = Number.parseInt(configured, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : TOTP_WINDOW_STEPS;
}

export function buildTotpOtpAuthUrl({
  issuer,
  accountName,
  secret,
}: {
  issuer: string;
  accountName: string;
  secret: string;
}) {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function encryptSensitiveValue(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSensitiveDataKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitiveValue(payload: string) {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getSensitiveDataKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function generateTotpCodeForCounter(secret: string, counter: number) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  now = Date.now(),
  windowSteps = resolveTotpWindowSteps(),
) {
  const normalizedCode = normalizeTotpCode(code);
  if (normalizedCode.length !== TOTP_DIGITS) {
    return false;
  }

  const counter = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -windowSteps; offset <= windowSteps; offset += 1) {
    if (generateTotpCodeForCounter(secret, counter + offset) === normalizedCode) {
      return true;
    }
  }

  return false;
}
