import { createHmac, timingSafeEqual } from "node:crypto";

export const SMOKEIFY_DISCORD_LINK_TOKEN_TTL_SECONDS = 10 * 60;

const DISCORD_USER_ID_PATTERN = /^\d{17,20}$/;
const CHALLENGE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export type SmokeifyDiscordLinkTokenPayload = {
  v: 1;
  provider: "SMOKEIFY";
  discordUserId: string;
  challenge: string;
  customerId: string;
  customerRef?: string;
  displayName?: string;
  iat: number;
  exp: number;
};

type BuildSmokeifyDiscordLinkTokenInput = {
  discordUserId: string;
  challenge: string;
  customerId: string;
  customerRef?: string | null;
  displayName?: string | null;
  issuedAt?: Date;
  ttlSeconds?: number;
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string) =>
  Buffer.from(value, "base64url").toString("utf8");

const signSegment = (payloadSegment: string, secret: string) =>
  createHmac("sha256", secret).update(payloadSegment).digest("base64url");

const compactOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const normalizeDiscordUserId = (value: string) => value.trim();

export const isValidDiscordUserId = (value: string) =>
  DISCORD_USER_ID_PATTERN.test(normalizeDiscordUserId(value));

export const normalizeDiscordLinkChallenge = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/[\s-]+/g, "");
  if (/^[A-Z0-9]{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
  }

  return CHALLENGE_PATTERN.test(trimmed) ? trimmed : null;
};

export const getSmokeifyLinkTokenSecret = () =>
  process.env.SMOKEIFY_LINK_TOKEN_SECRET?.trim() || null;

export const requireSmokeifyLinkTokenSecret = () => {
  const secret = getSmokeifyLinkTokenSecret();
  if (!secret) {
    throw new Error("SMOKEIFY_LINK_TOKEN_SECRET is not configured");
  }
  return secret;
};

export const buildSmokeifyDiscordLinkTokenPayload = ({
  discordUserId,
  challenge,
  customerId,
  customerRef,
  displayName,
  issuedAt = new Date(),
  ttlSeconds = SMOKEIFY_DISCORD_LINK_TOKEN_TTL_SECONDS,
}: BuildSmokeifyDiscordLinkTokenInput): SmokeifyDiscordLinkTokenPayload => {
  const normalizedDiscordUserId = normalizeDiscordUserId(discordUserId);
  if (!isValidDiscordUserId(normalizedDiscordUserId)) {
    throw new Error("Discord user ID must be a valid Discord snowflake.");
  }

  const normalizedChallenge = normalizeDiscordLinkChallenge(challenge);
  if (!normalizedChallenge) {
    throw new Error("Challenge code must match the ABCD-EFGH format.");
  }

  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) {
    throw new Error("Customer ID is required.");
  }

  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error("Token expiry must be a positive duration.");
  }

  const iat = Math.floor(issuedAt.getTime() / 1000);
  const exp = iat + Math.floor(ttlSeconds);

  return {
    v: 1,
    provider: "SMOKEIFY",
    discordUserId: normalizedDiscordUserId,
    challenge: normalizedChallenge,
    customerId: normalizedCustomerId,
    ...(compactOptionalString(customerRef)
      ? { customerRef: compactOptionalString(customerRef) }
      : {}),
    ...(compactOptionalString(displayName)
      ? { displayName: compactOptionalString(displayName) }
      : {}),
    iat,
    exp,
  };
};

export const signSmokeifyDiscordLinkToken = (
  payload: SmokeifyDiscordLinkTokenPayload,
  secret = requireSmokeifyLinkTokenSecret(),
) => {
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signature = signSegment(payloadSegment, secret);
  return `${payloadSegment}.${signature}`;
};

export const createSmokeifyDiscordLinkToken = (
  input: BuildSmokeifyDiscordLinkTokenInput,
) => {
  const payload = buildSmokeifyDiscordLinkTokenPayload(input);
  return {
    payload,
    token: signSmokeifyDiscordLinkToken(payload),
  };
};

export const verifySmokeifyDiscordLinkToken = (
  token: string,
  secret: string,
) => {
  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    throw new Error("Malformed link token.");
  }

  const expectedSignature = signSegment(payloadSegment, secret);
  const actualBuffer = Buffer.from(signatureSegment);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid link token signature.");
  }

  const payload = JSON.parse(
    decodeBase64Url(payloadSegment),
  ) as SmokeifyDiscordLinkTokenPayload;

  if (payload.v !== 1) {
    throw new Error("Unsupported link token version.");
  }

  if (payload.provider !== "SMOKEIFY") {
    throw new Error("This token was not issued for Smokeify.");
  }

  if (!isValidDiscordUserId(payload.discordUserId)) {
    throw new Error("Malformed Discord user ID.");
  }

  if (!normalizeDiscordLinkChallenge(payload.challenge)) {
    throw new Error("Malformed challenge code.");
  }

  if (!payload.customerId?.trim()) {
    throw new Error("Malformed customer ID.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("Link token has expired.");
  }

  return payload;
};
