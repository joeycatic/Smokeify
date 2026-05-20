import { prisma } from "@/lib/prisma";
import { sendVerificationCodeEmail } from "@/lib/email";
import { generateVerificationCode, hashToken } from "@/lib/security";

const CODE_EXPIRY_MS = 10 * 60 * 1000;

type PasswordResetUser = {
  id: string;
  email: string;
};

function buildPasswordResetUrl(origin: string, email: string, code: string) {
  const url = new URL("/auth/reset", origin);
  url.searchParams.set("email", email);
  url.searchParams.set("code", code);
  return url.toString();
}

export async function issuePasswordResetForUser(
  user: PasswordResetUser,
  options?: { origin?: string | null }
) {
  const email = user.email.trim().toLowerCase();
  const code = generateVerificationCode();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  const actionUrl = options?.origin?.trim()
    ? buildPasswordResetUrl(options.origin.trim(), email, code)
    : null;

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
  });

  return { email, expiresAt, actionUrl };
}

export async function requestPasswordResetByEmail(
  rawEmail: string,
  options?: { origin?: string | null }
) {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user?.email) {
    return { ok: true as const, userFound: false as const };
  }

  await issuePasswordResetForUser(
    { id: user.id, email: user.email },
    options
  );

  return { ok: true as const, userFound: true as const, userId: user.id, email };
}
