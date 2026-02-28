import crypto from "crypto";

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
  exp: number;
};

const getTokenSecret = () =>
  process.env.MOBILE_API_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-mobile-secret";

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

export const signMobileToken = (payload: TokenPayload) => {
  const body = encode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getTokenSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
};

export const parseMobileToken = (rawHeader: string | null) => {
  if (!rawHeader?.startsWith("Bearer ")) return null;
  const token = rawHeader.slice("Bearer ".length).trim();
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac("sha256", getTokenSecret()).update(body).digest("base64url");
  const sigBuffer = Buffer.from(sig);
  const expectedSigBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedSigBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(decode(body)) as TokenPayload;
    if (!payload.sub || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};
