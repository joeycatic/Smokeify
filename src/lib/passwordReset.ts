import { prisma } from "@/lib/prisma";
import { sendVerificationCodeEmail } from "@/lib/email";
import { type StorefrontCode } from "@/lib/storefronts";
import { generateVerificationCode, hashToken } from "@/lib/security";
import {
  getPreferredUserAuthOrigin,
  resolvePreferredUserStorefront,
} from "@/lib/userStorefront";

const CODE_EXPIRY_MS = 10 * 60 * 1000;

type PasswordResetUser = {
  id: string;
  email: string;
  registeredStorefront?: string | null;
};

function buildSignInUrl(origin: string, email: string) {
  const url = new URL("/auth/signin", origin);
  url.searchParams.set("email", email);
  return url.toString();
}

function buildPasswordResetUrl(
  origin: string,
  email: string,
  code: string,
  storefront: StorefrontCode
) {
  const url = new URL("/auth/reset", origin);
  url.searchParams.set("email", email);
  url.searchParams.set("code", code);
  url.searchParams.set("storefront", storefront);
  return url.toString();
}

export async function issuePasswordResetForUser(
  user: PasswordResetUser,
  options?: { fallbackOrigin?: string | null }
) {
  const email = user.email.trim().toLowerCase();
  const code = generateVerificationCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  const storefront = resolvePreferredUserStorefront(user.registeredStorefront ?? null, [
    options?.fallbackOrigin,
  ]);
  const origin = getPreferredUserAuthOrigin(storefront, options?.fallbackOrigin);
  const actionUrl = buildPasswordResetUrl(origin, email, code, storefront);
  const signInUrl = buildSignInUrl(origin, email);

  await prisma.verificationCode.deleteMany({
    where: { userId: user.id, purpose: "PASSWORD_RESET" },
  });

  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      email,
      codeHash,
      purpose: "PASSWORD_RESET",
      expiresAt,
    },
  });

  await sendVerificationCodeEmail({
    email,
    code,
    purpose: "PASSWORD_RESET",
    actionUrl,
    storefront,
  });

  return { email, expiresAt, actionUrl, signInUrl, storefront };
}

export async function requestPasswordResetByEmail(
  rawEmail: string,
  options?: { fallbackOrigin?: string | null }
) {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, registeredStorefront: true },
  });

  if (!user?.email) {
    return { ok: true as const, userFound: false as const };
  }

  await issuePasswordResetForUser(
    {
      id: user.id,
      email: user.email,
      registeredStorefront: user.registeredStorefront,
    },
    options
  );

  return { ok: true as const, userFound: true as const, userId: user.id, email };
}
